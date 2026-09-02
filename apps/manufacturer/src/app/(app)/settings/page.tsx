import { notFound } from 'next/navigation';
import { PageHeader, majorAmount } from '@ideeza/ui';
import { SettingsPanels } from '@/components/settings/settings-panels.js';
import { earningsSummary } from '@/data/payouts.js';
import { getShopProfile } from '@/data/profile.js';
import {
  readActivity,
  readDevices,
  readDisputes,
  readKyc,
  readNoticeChoices,
  readPayoutMethods,
  readPreferences,
  readSecurity,
  readTaxProfile,
  readWithdrawals,
} from '@/data/settings.js';
import { requireManufacturer } from '@/lib/auth.js';
import { database } from '@/lib/db.js';

export const dynamic = 'force-dynamic';

const day = (value: Date): string => value.toISOString().slice(0, 10);

const time = (value: Date): string =>
  new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' }).format(value);

/** The browser a session was opened from, from the only clue a session has. */
const deviceName = (userAgent: string | null): string => {
  if (userAgent === null) return 'Unknown device';
  if (/iPhone|iPad/i.test(userAgent)) return 'iPhone';
  if (/Android/i.test(userAgent)) return 'Android phone';
  if (/Macintosh/i.test(userAgent)) return 'Mac';
  if (/Windows/i.test(userAgent)) return 'Windows PC';
  if (/Linux/i.test(userAgent)) return 'Linux';
  return 'Unknown device';
};

/** What an event was, in words rather than in its enum name. */
const eventWords = (kind: string, subject: string): string => {
  const readable = kind.replace(/_/g, ' ');
  return `You ${readable} — ${subject.replace(/_/g, ' ')}`;
};

/**
 * Settings, in the design's shape: a section rail and one pane.
 *
 * Every pane reads something real. The shop's details and the person's own
 * name, picture, password, devices, notification choices, language, privacy
 * switches, identity checks, payout methods and tax details are all stored;
 * the activity list is the platform's own append-only events rather than a
 * second log kept for this screen, and the disputes are the domain's.
 */
const SettingsPage = async ({
  searchParams,
}: {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}) => {
  const actor = await requireManufacturer('/settings');
  // Which pane to open on. A tour stop links straight to one, and so can
  // anybody sending a colleague to the right part of this screen.
  const asked = (await searchParams)['pane'];
  const opening = typeof asked === 'string' ? asked : undefined;

  const [
    shop,
    earnings,
    withdrawals,
    me,
    security,
    devices,
    preferences,
    notices,
    kyc,
    payoutMethods,
    tax,
    activity,
    disputes,
  ] = await Promise.all([
    getShopProfile(actor.manufacturerId),
    earningsSummary(actor.manufacturerId),
    readWithdrawals(actor.manufacturerId),
    database().user.findUnique({
      where: { id: actor.userId },
      select: {
        firstName: true,
        lastName: true,
        displayName: true,
        email: true,
        phone: true,
        phoneVerifiedAt: true,
        avatarPreset: true,
      },
    }),
    readSecurity(actor.userId),
    readDevices(actor.userId, actor.sessionId),
    readPreferences(actor.userId),
    readNoticeChoices(actor.userId),
    readKyc(actor.userId),
    readPayoutMethods(actor.manufacturerId),
    readTaxProfile(actor.userId),
    readActivity(actor.userId),
    readDisputes(actor.manufacturerId, actor.userId),
  ]);
  if (shop === null) notFound();

  const membership = shop.members.find((member) => member.email === actor.email);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Settings"
        description="Your account, the shop buyers see, and what the platform does with it."
      />

      <SettingsPanels
        {...(opening === undefined ? {} : { initialPane: opening })}
        data={{
          displayName: shop.displayName,
          legalName: shop.legalName,
          tagline: shop.tagline ?? '',
          about: shop.about ?? '',
          addressLine1: shop.addressLine1,
          addressLine2: shop.addressLine2 ?? '',
          city: shop.city,
          region: shop.region ?? '',
          postalCode: shop.postalCode ?? '',
          countryCode: shop.countryCode,
          phone: shop.phone ?? '',
          websiteUrl: shop.websiteUrl ?? '',
          employeeBand: shop.employeeBand ?? '',
          shippingMethods: shop.shippingMethods,
          facebookUrl: shop.facebookUrl ?? '',
          twitterUrl: shop.twitterUrl ?? '',
          instagramUrl: shop.instagramUrl ?? '',
          linkedinUrl: shop.linkedinUrl ?? '',
          verified: shop.verified,
          services: shop.services,

          firstName: me?.firstName ?? '',
          lastName: me?.lastName ?? '',
          memberName: me?.displayName ?? actor.email,
          memberEmail: me?.email ?? actor.email,
          memberPhone: me?.phone ?? '',
          phoneVerified: me?.phoneVerifiedAt !== null && me?.phoneVerifiedAt !== undefined,
          avatarPreset: me?.avatarPreset ?? null,
          isOwner: membership?.owner ?? false,

          hasPassword: security.hasPassword,
          twoStepEnabled: security.twoStepEnabled,
          twoStepMethod: security.twoStepMethod,
          securityQuestion: security.securityQuestion,
          loginAlerts: security.loginAlerts,
          deactivatedOn: security.deactivatedAt === null ? null : day(security.deactivatedAt),
          reactivateOn: security.reactivateAfter === null ? null : day(security.reactivateAfter),
          deletionRequestedOn:
            security.deletionRequestedAt === null ? null : day(security.deletionRequestedAt),
          devices: devices.map((device) => ({
            id: device.id,
            name: deviceName(device.userAgent),
            where: device.ipAddress ?? 'Unknown network',
            seen: `${day(device.lastSeenAt)}, ${time(device.lastSeenAt)}`,
            current: device.current,
          })),

          language: preferences.language,
          dateLocale: preferences.dateLocale,
          profileLocked: preferences.profileLocked,
          shareActivityOnFacebook: preferences.shareActivityOnFacebook,
          publishWishlistOnFacebook: preferences.publishWishlistOnFacebook,
          linkWithSearchEngine: preferences.linkWithSearchEngine,
          notices: notices.map((row) => ({
            topic: row.topic,
            channel: row.channel,
            enabled: row.enabled,
            locked: row.locked,
          })),

          kyc: kyc.map((level) => ({
            level: level.level,
            status: level.status,
            rejectReason: level.rejectReason,
            fullLegalName: level.fullLegalName,
            contactEmail: level.contactEmail,
            mobileNumber: level.mobileNumber,
            countryOfResidence: level.countryOfResidence,
            agreedToTerms: level.agreedToTerms,
            dateOfBirth: level.dateOfBirth,
            residentialAddress: level.residentialAddress,
            taxResidencyCountry: level.taxResidencyCountry,
            documentNames: level.documentNames,
            submittedOn: level.submittedAt === null ? null : day(level.submittedAt),
          })),

          heldMinor: earnings.pendingReleaseMinor,
          availableMinor: earnings.availableMinor,
          currency: earnings.currency,
          payoutMethods,
          withdrawals: withdrawals.map((row) => ({
            id: row.id,
            amount: `${row.currency} ${majorAmount(row.amountMinor)}`,
            status: row.status,
            on: day(row.requestedAt),
          })),
          tax: {
            residenceCountry: tax.residenceCountry,
            isUsPerson: tax.isUsPerson,
            taxIdKind: tax.taxIdKind,
            taxIdLast4: tax.taxIdLast4,
            submittedOn: tax.submittedAt === null ? null : day(tax.submittedAt),
          },

          activity: activity.map((row) => ({
            id: row.id,
            day: day(row.at),
            time: time(row.at),
            text: eventWords(row.kind, row.subject),
          })),
          disputes: disputes.map((dispute) => ({
            id: dispute.id,
            orderId: dispute.orderId,
            status: dispute.status,
            reason: dispute.reason,
            outcome: dispute.outcome,
            openedOn: day(dispute.openedAt),
            resolvedOn: dispute.resolvedAt === null ? null : day(dispute.resolvedAt),
            productName: dispute.productName,
            openedByYou: dispute.openedByYou,
          })),
        }}
      />
    </div>
  );
};

export default SettingsPage;
