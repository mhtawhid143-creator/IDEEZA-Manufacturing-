'use server';

import { verifyPassword, hashPassword } from '@ideeza/auth';
import {
  addPayoutMethod,
  changeEmail,
  changePhone,
  clearSecurityQuestion,
  deactivateAccount,
  reactivateAccount,
  removePayoutMethod,
  removePhone,
  requestDeletion,
  saveAvatarPreset,
  saveProfileName,
  savePreferences,
  saveTaxIdentification,
  saveTaxResidence,
  setDefaultPayoutMethod,
  setLoginAlerts,
  setNoticeChoice,
  setSecurityQuestion,
  setTwoStep,
  signOutDevice,
  submitKycHigher,
  submitKycLevelOne,
  verificationCode,
  withdrawDeletion,
  type KycHigherEdit,
  type KycLevelOneEdit,
  type PayoutMethodEdit,
  type PreferenceRow,
  type ProfileEdit,
} from '@/data/settings.js';
import { database } from '@/lib/db.js';
import { requireManufacturer } from '@/lib/auth.js';

export interface SettingsState {
  readonly saved: boolean;
  readonly error?: string | undefined;
  /**
   * The verification code, when a step would have sent one.
   *
   * Nothing in this build sends email or SMS, so a code that was only "sent"
   * would be a step nobody could finish. It is handed back and the dialog says
   * it is showing it rather than sending it.
   */
  readonly code?: string | undefined;
}

const done = { saved: true } as const;

// ── the person ─────────────────────────────────────────────────────────────

export const saveProfileNameAction = async (edit: ProfileEdit): Promise<SettingsState> => {
  const actor = await requireManufacturer('/settings');
  const result = await saveProfileName(actor.userId, edit);
  return result.ok ? done : { saved: false, error: result.message };
};

export const saveAvatarAction = async (preset: string | null): Promise<SettingsState> => {
  const actor = await requireManufacturer('/settings');
  const result = await saveAvatarPreset(actor.userId, preset);
  return result.ok ? done : { saved: false, error: result.message };
};

/** Asks for the code that a change of address or number is confirmed with. */
export const requestCodeAction = async (target: string): Promise<SettingsState> => {
  const actor = await requireManufacturer('/settings');
  if (target.trim() === '') return { saved: false, error: 'Fill that in first.' };
  return { saved: true, code: verificationCode(actor.userId, target) };
};

export const changeEmailAction = async (
  email: string,
  code: string,
): Promise<SettingsState> => {
  const actor = await requireManufacturer('/settings');
  const result = await changeEmail(actor.userId, email, code);
  return result.ok ? done : { saved: false, error: result.message };
};

export const changePhoneAction = async (
  phone: string,
  code: string,
): Promise<SettingsState> => {
  const actor = await requireManufacturer('/settings');
  const result = await changePhone(actor.userId, phone, code);
  return result.ok ? done : { saved: false, error: result.message };
};

export const removePhoneAction = async (): Promise<SettingsState> => {
  const actor = await requireManufacturer('/settings');
  const result = await removePhone(actor.userId);
  return result.ok ? done : { saved: false, error: result.message };
};

// ── security ───────────────────────────────────────────────────────────────

/**
 * Changes the password, and signs every other device out.
 *
 * A password is changed because it might be known, so leaving the sessions it
 * opened alive would change the lock and leave the old keys working. The
 * current session stays, because throwing somebody out of the screen they just
 * used is not a security measure.
 */
export const changePasswordAction = async (
  current: string,
  next: string,
  confirm: string,
): Promise<SettingsState> => {
  const actor = await requireManufacturer('/settings');
  if (next !== confirm) return { saved: false, error: 'The two new passwords do not match.' };
  if (next.length < 12) {
    return { saved: false, error: 'Twelve characters at least — this protects money.' };
  }

  const credential = await database().userCredential.findUnique({
    where: { userId: actor.userId },
  });
  if (credential === null) {
    return { saved: false, error: 'This account has no password to change.' };
  }
  if (!(await verifyPassword(current, credential.passwordHash))) {
    return { saved: false, error: 'That is not your current password.' };
  }

  await database().$transaction([
    database().userCredential.update({
      where: { userId: actor.userId },
      data: { passwordHash: await hashPassword(next), passwordChangedAt: new Date() },
    }),
    database().session.updateMany({
      where: { userId: actor.userId, revokedAt: null, NOT: { id: actor.sessionId } },
      data: { revokedAt: new Date(), revocationReason: 'password_changed' },
    }),
  ]);
  return done;
};

export const setTwoStepAction = async (
  enabled: boolean,
  method: 'email' | 'sms',
): Promise<SettingsState> => {
  const actor = await requireManufacturer('/settings');
  const result = await setTwoStep(actor.userId, enabled, method);
  return result.ok ? done : { saved: false, error: result.message };
};

export const setLoginAlertsAction = async (enabled: boolean): Promise<SettingsState> => {
  const actor = await requireManufacturer('/settings');
  const result = await setLoginAlerts(actor.userId, enabled);
  return result.ok ? done : { saved: false, error: result.message };
};

export const setSecurityQuestionAction = async (
  question: string,
  answer: string,
): Promise<SettingsState> => {
  const actor = await requireManufacturer('/settings');
  const result = await setSecurityQuestion(actor.userId, question, answer);
  return result.ok ? done : { saved: false, error: result.message };
};

export const clearSecurityQuestionAction = async (): Promise<SettingsState> => {
  const actor = await requireManufacturer('/settings');
  const result = await clearSecurityQuestion(actor.userId);
  return result.ok ? done : { saved: false, error: result.message };
};

export const signOutDeviceAction = async (sessionId: string): Promise<SettingsState> => {
  const actor = await requireManufacturer('/settings');
  const result = await signOutDevice(actor.userId, sessionId, actor.sessionId);
  return result.ok ? done : { saved: false, error: result.message };
};

export const deactivateAccountAction = async (
  reason: string,
  days: number,
): Promise<SettingsState> => {
  const actor = await requireManufacturer('/settings');
  const result = await deactivateAccount(actor.userId, reason, days);
  return result.ok ? done : { saved: false, error: result.message };
};

export const reactivateAccountAction = async (): Promise<SettingsState> => {
  const actor = await requireManufacturer('/settings');
  const result = await reactivateAccount(actor.userId);
  return result.ok ? done : { saved: false, error: result.message };
};

export const requestDeletionAction = async (reason: string): Promise<SettingsState> => {
  const actor = await requireManufacturer('/settings');
  const result = await requestDeletion(actor.userId, reason);
  return result.ok ? done : { saved: false, error: result.message };
};

export const withdrawDeletionAction = async (): Promise<SettingsState> => {
  const actor = await requireManufacturer('/settings');
  const result = await withdrawDeletion(actor.userId);
  return result.ok ? done : { saved: false, error: result.message };
};

// ── preferences, notifications, privacy ────────────────────────────────────

export const savePreferencesAction = async (
  patch: Partial<PreferenceRow>,
): Promise<SettingsState> => {
  const actor = await requireManufacturer('/settings');
  const result = await savePreferences(actor.userId, patch);
  return result.ok ? done : { saved: false, error: result.message };
};

export const setNoticeChoiceAction = async (
  topic: string,
  channel: string,
  enabled: boolean,
): Promise<SettingsState> => {
  const actor = await requireManufacturer('/settings');
  const result = await setNoticeChoice(actor.userId, topic, channel, enabled);
  return result.ok ? done : { saved: false, error: result.message };
};

// ── KYC ────────────────────────────────────────────────────────────────────

export const submitKycLevelOneAction = async (
  edit: KycLevelOneEdit,
): Promise<SettingsState> => {
  const actor = await requireManufacturer('/settings');
  const result = await submitKycLevelOne(actor.userId, edit);
  return result.ok ? done : { saved: false, error: result.message };
};

export const submitKycHigherAction = async (edit: KycHigherEdit): Promise<SettingsState> => {
  const actor = await requireManufacturer('/settings');
  const result = await submitKycHigher(actor.userId, edit);
  return result.ok ? done : { saved: false, error: result.message };
};

// ── get paid ───────────────────────────────────────────────────────────────

export const addPayoutMethodAction = async (
  edit: PayoutMethodEdit,
): Promise<SettingsState> => {
  const actor = await requireManufacturer('/settings');
  const result = await addPayoutMethod(actor.manufacturerId, edit);
  return result.ok ? done : { saved: false, error: result.message };
};

export const setDefaultPayoutMethodAction = async (
  methodId: string,
): Promise<SettingsState> => {
  const actor = await requireManufacturer('/settings');
  const result = await setDefaultPayoutMethod(actor.manufacturerId, methodId);
  return result.ok ? done : { saved: false, error: result.message };
};

export const removePayoutMethodAction = async (methodId: string): Promise<SettingsState> => {
  const actor = await requireManufacturer('/settings');
  const result = await removePayoutMethod(actor.manufacturerId, methodId);
  return result.ok ? done : { saved: false, error: result.message };
};

export const saveTaxResidenceAction = async (
  countryCode: string,
  isUsPerson: boolean,
): Promise<SettingsState> => {
  const actor = await requireManufacturer('/settings');
  const result = await saveTaxResidence(actor.userId, countryCode, isUsPerson);
  return result.ok ? done : { saved: false, error: result.message };
};

export const saveTaxIdentificationAction = async (
  kind: string,
  number: string,
): Promise<SettingsState> => {
  const actor = await requireManufacturer('/settings');
  const result = await saveTaxIdentification(actor.userId, kind, number);
  return result.ok ? done : { saved: false, error: result.message };
};
