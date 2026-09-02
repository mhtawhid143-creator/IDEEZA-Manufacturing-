import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import type { ManufacturerId } from '@ideeza/domain';
import { database } from '@/lib/db.js';

/**
 * Everything the settings screen reads and writes.
 *
 * The design gives settings ten panes. What each one needs is small, but there
 * are ten of them, so they live together here rather than as ten files that
 * would each hold one query. Every write is scoped by the actor on its first
 * statement — by `userId` for a person's own settings, by `manufacturerId` for
 * the shop's — and none of these switches is a permission: what an actor may do
 * is still decided by `ActorRole` and the route rules.
 */

export interface SettingsOutcome {
  readonly ok: boolean;
  readonly message?: string | undefined;
}

const ok: SettingsOutcome = { ok: true };
const no = (message: string): SettingsOutcome => ({ ok: false, message });

const blankToNull = (value: string): string | null =>
  value.trim() === '' ? null : value.trim();

// ---------------------------------------------------------------------------
// The person: name, email, phone, picture
// ---------------------------------------------------------------------------

export interface ProfileRow {
  readonly firstName: string;
  readonly lastName: string;
  readonly displayName: string;
  readonly email: string;
  readonly phone: string | null;
  readonly phoneVerified: boolean;
  readonly avatarPreset: string | null;
}

export interface ProfileEdit {
  readonly firstName: string;
  readonly lastName: string;
}

/**
 * Saves the two halves of a name, and keeps `displayName` in step.
 *
 * `displayName` is what every other screen shows. Letting the halves drift from
 * it is how a profile ends up introducing somebody by one name and signing them
 * off by another, so the whole is written from the parts whenever both are
 * given.
 */
export const saveProfileName = async (
  userId: string,
  edit: ProfileEdit,
): Promise<SettingsOutcome> => {
  const firstName = edit.firstName.trim();
  const lastName = edit.lastName.trim();
  if (firstName === '') return no('A first name is needed.');
  if (lastName === '') return no('A last name is needed.');

  await database().user.update({
    where: { id: userId },
    data: {
      firstName,
      lastName,
      displayName: `${firstName} ${lastName}`,
    },
  });
  return ok;
};

/** Chooses one of the preset pictures, or takes the picture away. */
export const saveAvatarPreset = async (
  userId: string,
  preset: string | null,
): Promise<SettingsOutcome> => {
  await database().user.update({
    where: { id: userId },
    data: { avatarPreset: preset === null ? null : preset.trim() },
  });
  return ok;
};

/**
 * The code a change of email or phone is confirmed with.
 *
 * Six digits derived from the account, the target and the current ten-minute
 * window, so the same request yields the same code for as long as it is valid
 * and no code has to be stored. Nothing here sends an email or an SMS — there
 * is no mail service in this build — so the code is returned to the caller and
 * the screen says out loud that it is showing it rather than sending it. That
 * is the honest version of a step whose delivery does not exist yet.
 */
export const verificationCode = (userId: string, target: string): string => {
  const window = Math.floor(Date.now() / 600_000);
  const digest = createHash('sha256')
    .update(`${userId}:${target.trim().toLowerCase()}:${String(window)}`)
    .digest('hex');
  return String(parseInt(digest.slice(0, 8), 16) % 1_000_000).padStart(6, '0');
};

const codeMatches = (userId: string, target: string, given: string): boolean => {
  const clean = given.replace(/\D/g, '');
  if (clean.length !== 6) return false;
  // The window before this one is accepted too, so a code does not expire
  // between being read and being typed.
  const now = verificationCode(userId, target);
  const digest = createHash('sha256')
    .update(
      `${userId}:${target.trim().toLowerCase()}:${String(Math.floor(Date.now() / 600_000) - 1)}`,
    )
    .digest('hex');
  const previous = String(parseInt(digest.slice(0, 8), 16) % 1_000_000).padStart(6, '0');
  return clean === now || clean === previous;
};

export const changeEmail = async (
  userId: string,
  email: string,
  code: string,
): Promise<SettingsOutcome> => {
  const next = email.trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(next)) return no('That is not an email address.');
  if (!codeMatches(userId, next, code)) return no('That code does not match. Check it and retry.');

  const taken = await database().user.findFirst({
    where: { email: next, NOT: { id: userId } },
    select: { id: true },
  });
  if (taken !== null) return no('Another account already uses that address.');

  await database().user.update({ where: { id: userId }, data: { email: next } });
  return ok;
};

export const changePhone = async (
  userId: string,
  phone: string,
  code: string,
): Promise<SettingsOutcome> => {
  const next = phone.trim();
  if (next.replace(/\D/g, '').length < 8) return no('That is not a phone number.');
  if (!codeMatches(userId, next, code)) return no('That code does not match. Check it and retry.');

  await database().user.update({
    where: { id: userId },
    data: { phone: next, phoneVerifiedAt: new Date() },
  });
  return ok;
};

export const removePhone = async (userId: string): Promise<SettingsOutcome> => {
  await database().user.update({
    where: { id: userId },
    data: { phone: null, phoneVerifiedAt: null },
  });
  return ok;
};

// ---------------------------------------------------------------------------
// Security
// ---------------------------------------------------------------------------

export interface SecurityRow {
  readonly hasPassword: boolean;
  readonly twoStepEnabled: boolean;
  readonly twoStepMethod: string;
  readonly securityQuestion: string | null;
  readonly loginAlerts: boolean;
  readonly deactivatedAt: Date | null;
  readonly reactivateAfter: Date | null;
  readonly deletionRequestedAt: Date | null;
}

export interface DeviceRow {
  readonly id: string;
  readonly userAgent: string | null;
  readonly ipAddress: string | null;
  readonly lastSeenAt: Date;
  readonly current: boolean;
}

const securityDefaults = { twoStepEnabled: false, loginAlerts: false } as const;

/** Reads the switches, making the row if this person has never touched them. */
export const readSecurity = async (userId: string): Promise<SecurityRow> => {
  const [row, credential] = await Promise.all([
    database().userSecurity.findUnique({ where: { userId } }),
    database().userCredential.findUnique({ where: { userId }, select: { userId: true } }),
  ]);
  return {
    hasPassword: credential !== null,
    twoStepEnabled: row?.twoStepEnabled ?? securityDefaults.twoStepEnabled,
    twoStepMethod: row?.twoStepMethod ?? 'email',
    securityQuestion: row?.securityQuestion ?? null,
    loginAlerts: row?.loginAlerts ?? securityDefaults.loginAlerts,
    deactivatedAt: row?.deactivatedAt ?? null,
    reactivateAfter: row?.reactivateAfter ?? null,
    deletionRequestedAt: row?.deletionRequestedAt ?? null,
  };
};

const upsertSecurity = async (
  userId: string,
  data: Record<string, unknown>,
): Promise<void> => {
  await database().userSecurity.upsert({
    where: { userId },
    update: data,
    create: { userId, ...data },
  });
};

export const setTwoStep = async (
  userId: string,
  enabled: boolean,
  method: 'email' | 'sms',
): Promise<SettingsOutcome> => {
  if (enabled && method === 'sms') {
    const user = await database().user.findUnique({
      where: { id: userId },
      select: { phoneVerifiedAt: true },
    });
    if (user?.phoneVerifiedAt === null || user?.phoneVerifiedAt === undefined) {
      return no('Verify a mobile number first, or a code by SMS could not reach you.');
    }
  }
  await upsertSecurity(userId, { twoStepEnabled: enabled, twoStepMethod: method });
  return ok;
};

export const setLoginAlerts = async (
  userId: string,
  enabled: boolean,
): Promise<SettingsOutcome> => {
  await upsertSecurity(userId, { loginAlerts: enabled });
  return ok;
};

/**
 * scrypt with the same parameters the password uses, because an answer is one.
 *
 * `maxmem` has to be raised for those parameters — 2^15 blocks of 8 needs more
 * than Node's default allowance, and without it scrypt refuses outright rather
 * than running slowly. The formula is `packages/auth`'s, deliberately: two
 * different memory ceilings for the same primitive is a difference nobody would
 * remember was intentional.
 */
const SCRYPT = {
  N: 2 ** 15,
  r: 8,
  p: 1,
  maxmem: Math.max(32 * 1024 * 1024, 256 * 2 ** 15 * 8),
} as const;
const hashAnswer = (answer: string): string => {
  const salt = randomBytes(16);
  const derived = scryptSync(answer.trim().toLowerCase(), salt, 32, SCRYPT);
  return `${salt.toString('hex')}:${derived.toString('hex')}`;
};

const answerMatches = (stored: string, answer: string): boolean => {
  const [saltHex, expectedHex] = stored.split(':');
  if (saltHex === undefined || expectedHex === undefined) return false;
  const derived = scryptSync(answer.trim().toLowerCase(), Buffer.from(saltHex, 'hex'), 32, SCRYPT);
  const expected = Buffer.from(expectedHex, 'hex');
  return derived.length === expected.length && timingSafeEqual(derived, expected);
};

export const setSecurityQuestion = async (
  userId: string,
  question: string,
  answer: string,
): Promise<SettingsOutcome> => {
  const trimmedQuestion = question.trim();
  const trimmedAnswer = answer.trim();
  if (trimmedQuestion === '') return no('Pick a question.');
  if (trimmedAnswer.length < 3) return no('An answer that short is not an answer.');
  await upsertSecurity(userId, {
    securityQuestion: trimmedQuestion,
    securityAnswerHash: hashAnswer(trimmedAnswer),
  });
  return ok;
};

export const clearSecurityQuestion = async (userId: string): Promise<SettingsOutcome> => {
  await upsertSecurity(userId, { securityQuestion: null, securityAnswerHash: null });
  return ok;
};

/** Used when the answer is asked for again; never returns the answer itself. */
export const checkSecurityAnswer = async (
  userId: string,
  answer: string,
): Promise<boolean> => {
  const row = await database().userSecurity.findUnique({
    where: { userId },
    select: { securityAnswerHash: true },
  });
  return row?.securityAnswerHash === null || row?.securityAnswerHash === undefined
    ? false
    : answerMatches(row.securityAnswerHash, answer);
};

/** The sessions this account has, newest first, with the current one marked. */
export const readDevices = async (
  userId: string,
  currentSessionId: string | null,
): Promise<readonly DeviceRow[]> => {
  const rows = await database().session.findMany({
    where: { userId, revokedAt: null, absoluteExpiresAt: { gt: new Date() } },
    orderBy: { lastSeenAt: 'desc' },
    select: { id: true, userAgent: true, ipAddress: true, lastSeenAt: true },
  });
  return rows.map((row) => ({
    id: row.id,
    userAgent: row.userAgent,
    ipAddress: row.ipAddress,
    lastSeenAt: row.lastSeenAt,
    current: row.id === currentSessionId,
  }));
};

/**
 * Signs one other device out.
 *
 * Scoped by `userId`, and the current session is refused: signing yourself out
 * from the list that shows where you are signed in reads as a mistake, and the
 * sign-out in the rail is the way to do it on purpose.
 */
export const signOutDevice = async (
  userId: string,
  sessionId: string,
  currentSessionId: string | null,
): Promise<SettingsOutcome> => {
  if (sessionId === currentSessionId) {
    return no('That is this device. Use Sign out in the menu to leave here.');
  }
  const { count } = await database().session.updateMany({
    where: { id: sessionId, userId, revokedAt: null },
    data: { revokedAt: new Date(), revocationReason: 'signed_out' },
  });
  return count === 0 ? no('That device is already signed out.') : ok;
};

export const deactivateAccount = async (
  userId: string,
  reason: string,
  days: number,
): Promise<SettingsOutcome> => {
  if (reason.trim().length < 5) return no('Tell us why, in a sentence.');
  if (!Number.isInteger(days) || days < 1 || days > 90) {
    return no('Between one and ninety days.');
  }
  await upsertSecurity(userId, {
    deactivatedAt: new Date(),
    deactivateReason: reason.trim(),
    reactivateAfter: new Date(Date.now() + days * 86_400_000),
  });
  return ok;
};

export const reactivateAccount = async (userId: string): Promise<SettingsOutcome> => {
  await upsertSecurity(userId, {
    deactivatedAt: null,
    deactivateReason: null,
    reactivateAfter: null,
  });
  return ok;
};

/**
 * Asks for the account to be deleted.
 *
 * A request, not a deletion. This account may be a counterparty to an order
 * with money in escrow, and the platform cannot honour a delivery for a shop
 * that no longer exists — so ops answers it, and the pane says so.
 */
export const requestDeletion = async (
  userId: string,
  reason: string,
): Promise<SettingsOutcome> => {
  await upsertSecurity(userId, {
    deletionRequestedAt: new Date(),
    deletionReason: blankToNull(reason),
  });
  return ok;
};

export const withdrawDeletion = async (userId: string): Promise<SettingsOutcome> => {
  await upsertSecurity(userId, { deletionRequestedAt: null, deletionReason: null });
  return ok;
};

// ---------------------------------------------------------------------------
// Preferences: language, formats, locking, privacy
// ---------------------------------------------------------------------------

export interface PreferenceRow {
  readonly language: string;
  readonly dateLocale: string;
  readonly profileLocked: boolean;
  readonly shareActivityOnFacebook: boolean;
  readonly publishWishlistOnFacebook: boolean;
  readonly linkWithSearchEngine: boolean;
}

export const readPreferences = async (userId: string): Promise<PreferenceRow> => {
  const row = await database().userPreference.findUnique({ where: { userId } });
  return {
    language: row?.language ?? 'en-US',
    dateLocale: row?.dateLocale ?? 'en-US',
    profileLocked: row?.profileLocked ?? false,
    shareActivityOnFacebook: row?.shareActivityOnFacebook ?? false,
    publishWishlistOnFacebook: row?.publishWishlistOnFacebook ?? false,
    linkWithSearchEngine: row?.linkWithSearchEngine ?? false,
  };
};

export const savePreferences = async (
  userId: string,
  patch: Partial<PreferenceRow>,
): Promise<SettingsOutcome> => {
  // Only tags Intl already understands, so a stored value can always be used
  // to format a date rather than throwing at the point of display.
  for (const tag of [patch.language, patch.dateLocale]) {
    if (tag === undefined) continue;
    try {
      new Intl.DateTimeFormat(tag);
    } catch {
      return no('That is not a language this build knows.');
    }
  }
  await database().userPreference.upsert({
    where: { userId },
    update: patch,
    create: { userId, ...patch },
  });
  return ok;
};

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------

export const NOTIFICATION_TOPICS = [
  'product',
  'message',
  'dispute',
  'blog',
  'policy_community',
  'other',
] as const;

export const NOTIFICATION_CHANNELS = ['web', 'email', 'mobile'] as const;

export type NotificationTopic = (typeof NOTIFICATION_TOPICS)[number];
export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number];

export interface NoticeChoiceRow {
  readonly topic: string;
  readonly channel: string;
  readonly enabled: boolean;
  readonly locked: boolean;
}

/**
 * Which channel is not a shop's to switch off.
 *
 * The design marks some notifications mandatory. These are the ones a shop
 * cannot miss without the platform breaking its own promises: a request it was
 * routed, a decision on its quote, a dispute opened against it. Web is the
 * channel that stays on, because it is the one the platform itself controls.
 */
const LOCKED_ON: readonly (readonly [NotificationTopic, NotificationChannel])[] = [
  ['product', 'web'],
  ['dispute', 'web'],
];

const isLocked = (topic: string, channel: string): boolean =>
  LOCKED_ON.some(([t, c]) => t === topic && c === channel);

/** Reads every pair, defaulting anything never touched to on. */
export const readNoticeChoices = async (
  userId: string,
): Promise<readonly NoticeChoiceRow[]> => {
  const rows = await database().notificationChoice.findMany({ where: { userId } });
  return NOTIFICATION_TOPICS.flatMap((topic) =>
    NOTIFICATION_CHANNELS.map((channel) => {
      const stored = rows.find((row) => row.topic === topic && row.channel === channel);
      return {
        topic,
        channel,
        enabled: isLocked(topic, channel) ? true : (stored?.enabled ?? true),
        locked: isLocked(topic, channel),
      };
    }),
  );
};

export const setNoticeChoice = async (
  userId: string,
  topic: string,
  channel: string,
  enabled: boolean,
): Promise<SettingsOutcome> => {
  if (!NOTIFICATION_TOPICS.includes(topic as NotificationTopic)) return no('Unknown topic.');
  if (!NOTIFICATION_CHANNELS.includes(channel as NotificationChannel)) {
    return no('Unknown channel.');
  }
  if (isLocked(topic, channel) && !enabled) {
    return no('This one stays on: the platform cannot keep its promises if you miss it.');
  }

  const id = `notice_${userId}_${topic}_${channel}`;
  await database().notificationChoice.upsert({
    where: { userId_topic_channel: { userId, topic: topic as never, channel: channel as never } },
    update: { enabled },
    create: {
      id,
      userId,
      topic: topic as never,
      channel: channel as never,
      enabled,
      locked: isLocked(topic, channel),
    },
  });
  return ok;
};

// ---------------------------------------------------------------------------
// KYC
// ---------------------------------------------------------------------------

export interface KycRow {
  readonly level: number;
  readonly status: string;
  readonly rejectReason: string | null;
  readonly fullLegalName: string | null;
  readonly contactEmail: string | null;
  readonly mobileNumber: string | null;
  readonly countryOfResidence: string | null;
  readonly agreedToTerms: boolean;
  readonly dateOfBirth: string | null;
  readonly residentialAddress: string | null;
  readonly taxResidencyCountry: string | null;
  readonly documentNames: readonly string[];
  readonly submittedAt: Date | null;
}

/** All three levels, whether or not this person has started them. */
export const readKyc = async (userId: string): Promise<readonly KycRow[]> => {
  const rows = await database().kycSubmission.findMany({
    where: { userId },
    orderBy: { level: 'asc' },
  });
  return [1, 2, 3].map((level) => {
    const stored = rows.find((row) => row.level === level);
    return {
      level,
      status: stored?.status ?? 'not_submitted',
      rejectReason: stored?.rejectReason ?? null,
      fullLegalName: stored?.fullLegalName ?? null,
      contactEmail: stored?.contactEmail ?? null,
      mobileNumber: stored?.mobileNumber ?? null,
      countryOfResidence: stored?.countryOfResidence ?? null,
      agreedToTerms: stored?.agreedToTerms ?? false,
      dateOfBirth:
        stored?.dateOfBirth === null || stored?.dateOfBirth === undefined
          ? null
          : stored.dateOfBirth.toISOString().slice(0, 10),
      residentialAddress: stored?.residentialAddress ?? null,
      taxResidencyCountry: stored?.taxResidencyCountry ?? null,
      documentNames: stored?.documentNames ?? [],
      submittedAt: stored?.submittedAt ?? null,
    };
  });
};

export interface KycLevelOneEdit {
  readonly fullLegalName: string;
  readonly contactEmail: string;
  readonly mobileNumber: string;
  readonly countryOfResidence: string;
  readonly agreedToTerms: boolean;
}

/**
 * Submits level one for review.
 *
 * IDEEZA decides; a shop submits. Nothing here approves anything, and the pane
 * says so — a platform that marked its own identity checks passed would be
 * vouching for nobody's work.
 */
export const submitKycLevelOne = async (
  userId: string,
  edit: KycLevelOneEdit,
): Promise<SettingsOutcome> => {
  if (edit.fullLegalName.trim().length < 3) return no('Your full legal name, as it is written.');
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(edit.contactEmail.trim())) {
    return no('That is not an email address.');
  }
  if (edit.mobileNumber.replace(/\D/g, '').length < 8) return no('A mobile number is needed.');
  if (edit.countryOfResidence.trim() === '') return no('Which country do you live in?');
  if (!edit.agreedToTerms) return no('The seller terms have to be agreed to.');

  const id = `kyc_${userId}_1`;
  const fields = {
    status: 'in_review' as const,
    rejectReason: null,
    fullLegalName: edit.fullLegalName.trim(),
    contactEmail: edit.contactEmail.trim().toLowerCase(),
    mobileNumber: edit.mobileNumber.trim(),
    countryOfResidence: edit.countryOfResidence.trim(),
    agreedToTerms: true,
    submittedAt: new Date(),
  };
  await database().kycSubmission.upsert({
    where: { userId_level: { userId, level: 1 } },
    update: fields,
    create: { id, userId, level: 1, ...fields },
  });
  return ok;
};

export interface KycHigherEdit {
  readonly level: 2 | 3;
  readonly dateOfBirth: string;
  readonly residentialAddress: string;
  readonly taxResidencyCountry: string;
  readonly documentNames: readonly string[];
}

export const submitKycHigher = async (
  userId: string,
  edit: KycHigherEdit,
): Promise<SettingsOutcome> => {
  const levels = await readKyc(userId);
  const below = levels.find((row) => row.level === edit.level - 1);
  if (below?.status !== 'approved') {
    return no(`Level ${String(edit.level - 1)} has to be approved first.`);
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(edit.dateOfBirth)) return no('A date of birth is needed.');
  if (edit.residentialAddress.trim().length < 6) return no('A full residential address.');
  if (edit.taxResidencyCountry.trim() === '') return no('Which country are you taxed in?');
  const names = edit.documentNames.map((name) => name.trim()).filter((name) => name !== '');
  if (names.length === 0) return no('A government photo ID has to be attached.');

  const id = `kyc_${userId}_${String(edit.level)}`;
  const fields = {
    status: 'in_review' as const,
    rejectReason: null,
    dateOfBirth: new Date(`${edit.dateOfBirth}T00:00:00.000Z`),
    residentialAddress: edit.residentialAddress.trim(),
    taxResidencyCountry: edit.taxResidencyCountry.trim(),
    documentNames: names,
    submittedAt: new Date(),
  };
  await database().kycSubmission.upsert({
    where: { userId_level: { userId, level: edit.level } },
    update: fields,
    create: { id, userId, level: edit.level, ...fields },
  });
  return ok;
};

// ---------------------------------------------------------------------------
// Get paid: methods and tax
// ---------------------------------------------------------------------------

export interface PayoutMethodRow {
  readonly id: string;
  readonly kind: string;
  readonly label: string;
  readonly accountName: string;
  readonly accountLast4: string;
  readonly bankName: string | null;
  readonly swiftCode: string | null;
  readonly countryCode: string;
  readonly isDefault: boolean;
}

export const readPayoutMethods = async (
  manufacturerId: ManufacturerId,
): Promise<readonly PayoutMethodRow[]> => {
  const rows = await database().payoutMethod.findMany({
    where: { manufacturerId },
    orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
  });
  return rows.map((row) => ({
    id: row.id,
    kind: row.kind,
    label: row.label,
    accountName: row.accountName,
    accountLast4: row.accountLast4,
    bankName: row.bankName,
    swiftCode: row.swiftCode,
    countryCode: row.countryCode,
    isDefault: row.isDefault,
  }));
};

export interface PayoutMethodEdit {
  readonly kind: 'direct_bank' | 'swift';
  readonly label: string;
  readonly accountName: string;
  readonly accountNumber: string;
  readonly bankName: string;
  readonly swiftCode: string;
  readonly countryCode: string;
}

/**
 * Adds a method, keeping only the last four digits of the account.
 *
 * The rest is not needed to show a shop which account it chose, and what is
 * not stored cannot leak. The first method added becomes the default, because
 * a shop with one account should not have to say which one to use.
 */
export const addPayoutMethod = async (
  manufacturerId: ManufacturerId,
  edit: PayoutMethodEdit,
): Promise<SettingsOutcome> => {
  const digits = edit.accountNumber.replace(/\D/g, '');
  if (edit.accountName.trim().length < 3) return no('The name on the account.');
  if (digits.length < 6) return no('That account number is too short to be one.');
  if (edit.countryCode.trim().length !== 2) return no('Which country is the bank in?');
  if (edit.kind === 'swift' && edit.swiftCode.trim().length < 8) {
    return no('A SWIFT/BIC code is 8 or 11 characters.');
  }
  if (edit.kind === 'direct_bank' && edit.bankName.trim() === '') {
    return no('Which bank is it?');
  }

  const existing = await database().payoutMethod.count({ where: { manufacturerId } });
  await database().payoutMethod.create({
    data: {
      id: `payout_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`,
      manufacturerId,
      kind: edit.kind,
      label: blankToNull(edit.label) ?? (edit.kind === 'swift' ? 'SWIFT transfer' : 'Direct bank'),
      accountName: edit.accountName.trim(),
      accountLast4: digits.slice(-4),
      bankName: blankToNull(edit.bankName),
      swiftCode: blankToNull(edit.swiftCode)?.toUpperCase() ?? null,
      countryCode: edit.countryCode.trim().toUpperCase(),
      isDefault: existing === 0,
    },
  });
  return ok;
};

export const setDefaultPayoutMethod = async (
  manufacturerId: ManufacturerId,
  methodId: string,
): Promise<SettingsOutcome> => {
  const mine = await database().payoutMethod.findFirst({
    where: { id: methodId, manufacturerId },
    select: { id: true },
  });
  if (mine === null) return no('That method is not one of yours.');

  await database().$transaction([
    database().payoutMethod.updateMany({ where: { manufacturerId }, data: { isDefault: false } }),
    database().payoutMethod.update({ where: { id: methodId }, data: { isDefault: true } }),
  ]);
  return ok;
};

export const removePayoutMethod = async (
  manufacturerId: ManufacturerId,
  methodId: string,
): Promise<SettingsOutcome> => {
  const { count } = await database().payoutMethod.deleteMany({
    where: { id: methodId, manufacturerId },
  });
  if (count === 0) return no('That method is not one of yours.');

  // The shop should never be left with methods but no default.
  const remaining = await database().payoutMethod.findFirst({
    where: { manufacturerId },
    orderBy: { createdAt: 'asc' },
    select: { id: true, isDefault: true },
  });
  if (remaining !== null && !remaining.isDefault) {
    await database().payoutMethod.update({
      where: { id: remaining.id },
      data: { isDefault: true },
    });
  }
  return ok;
};

export interface TaxRow {
  readonly residenceCountry: string | null;
  readonly isUsPerson: boolean;
  readonly taxIdKind: string | null;
  readonly taxIdLast4: string | null;
  readonly submittedAt: Date | null;
}

export const readTaxProfile = async (userId: string): Promise<TaxRow> => {
  const row = await database().taxProfile.findUnique({ where: { userId } });
  return {
    residenceCountry: row?.residenceCountry ?? null,
    isUsPerson: row?.isUsPerson ?? false,
    taxIdKind: row?.taxIdKind ?? null,
    taxIdLast4: row?.taxIdLast4 ?? null,
    submittedAt: row?.submittedAt ?? null,
  };
};

export const saveTaxResidence = async (
  userId: string,
  countryCode: string,
  isUsPerson: boolean,
): Promise<SettingsOutcome> => {
  if (countryCode.trim().length !== 2) return no('Pick a country.');
  const data = {
    residenceCountry: countryCode.trim().toUpperCase(),
    isUsPerson,
  };
  await database().taxProfile.upsert({
    where: { userId },
    update: data,
    create: { userId, ...data },
  });
  return ok;
};

export const saveTaxIdentification = async (
  userId: string,
  kind: string,
  number: string,
): Promise<SettingsOutcome> => {
  const digits = number.replace(/[^\dA-Za-z]/g, '');
  if (kind.trim() === '') return no('Which kind of number is it?');
  if (digits.length < 4) return no('That number is too short to be one.');
  const data = {
    taxIdKind: kind.trim(),
    // Same reasoning as the account number: the last four are enough to show a
    // person which number they gave.
    taxIdLast4: digits.slice(-4),
    submittedAt: new Date(),
  };
  await database().taxProfile.upsert({
    where: { userId },
    update: data,
    create: { userId, ...data },
  });
  return ok;
};

// ---------------------------------------------------------------------------
// Activity and disputes
// ---------------------------------------------------------------------------

export interface ActivityRow {
  readonly id: string;
  readonly at: Date;
  readonly kind: string;
  readonly subject: string;
}

/**
 * What this person has done, from the events the platform already writes.
 *
 * No new table: `DomainEvent` is append-only and is written in the same
 * transaction as the act it records, so it is the truthful account of what
 * happened. A second log kept for a settings screen would be a second story.
 */
export const readActivity = async (
  userId: string,
  limit = 60,
): Promise<readonly ActivityRow[]> => {
  const rows = await database().domainEvent.findMany({
    where: { actorUserId: userId },
    orderBy: { occurredAt: 'desc' },
    take: limit,
    select: { id: true, occurredAt: true, kind: true, subjectKind: true, subjectId: true },
  });
  return rows.map((row) => ({
    id: row.id,
    at: row.occurredAt,
    kind: row.kind,
    subject: `${row.subjectKind} ${row.subjectId}`,
  }));
};

export interface DisputeRow {
  readonly id: string;
  readonly orderId: string;
  readonly status: string;
  readonly reason: string;
  readonly outcome: string | null;
  readonly openedAt: Date;
  readonly resolvedAt: Date | null;
  readonly productName: string;
  readonly openedByYou: boolean;
}

/**
 * Every dispute touching this shop's orders, open ones first.
 *
 * Read through the order, which is what ties a dispute to a shop — a dispute
 * has an opener and an order, and the opener is often the buyer.
 */
export const readDisputes = async (
  manufacturerId: ManufacturerId,
  userId: string,
): Promise<readonly DisputeRow[]> => {
  const rows = await database().dispute.findMany({
    where: { order: { manufacturerId } },
    orderBy: [{ resolvedAt: 'asc' }, { createdAt: 'desc' }],
    include: {
      order: {
        select: {
          id: true,
          rfq: { select: { package: { select: { product: { select: { name: true } } } } } },
        },
      },
    },
  });
  return rows.map((row) => ({
    id: row.id,
    orderId: row.orderId,
    status: row.status,
    reason: row.reason,
    outcome: row.outcome,
    openedAt: row.createdAt,
    resolvedAt: row.resolvedAt,
    productName: row.order.rfq.package.product.name,
    openedByYou: row.openedById === userId,
  }));
};

export interface WithdrawalRow {
  readonly id: string;
  readonly amountMinor: number;
  readonly currency: string;
  readonly status: string;
  readonly requestedAt: Date;
  readonly settledAt: Date | null;
}

/** Every withdrawal this shop has asked for, newest first. */
export const readWithdrawals = async (
  manufacturerId: ManufacturerId,
): Promise<readonly WithdrawalRow[]> => {
  const rows = await database().withdrawalRequest.findMany({
    where: { manufacturerId },
    orderBy: { requestedAt: 'desc' },
    take: 50,
  });
  return rows.map((row) => ({
    id: row.id,
    amountMinor: Number(row.amountMinor),
    currency: row.currency,
    status: row.status,
    requestedAt: row.requestedAt,
    settledAt: row.settledAt,
  }));
};
