import { notFound } from 'next/navigation';
import { PageHeader } from '@ideeza/ui';
import { SettingsPanels } from '@/components/settings/settings-panels.js';
import { earningsSummary } from '@/data/payouts.js';
import { getShopProfile } from '@/data/profile.js';
import { listDisputes } from '@/data/resolution.js';
import { requireManufacturer } from '@/lib/auth.js';

export const dynamic = 'force-dynamic';

/**
 * Settings, in the design's shape: a section rail and one pane.
 *
 * The company details are stored, because an order ships to them. Everything the
 * design puts here that the platform cannot keep yet says so in its own pane —
 * the section is not quietly dropped, and no form loses what is typed into it.
 */
const SettingsPage = async () => {
  const actor = await requireManufacturer('/settings');

  const [shop, earnings, disputes] = await Promise.all([
    getShopProfile(actor.manufacturerId),
    earningsSummary(actor.manufacturerId),
    listDisputes(actor.manufacturerId),
  ]);
  if (shop === null) notFound();

  const me = shop.members.find((member) => member.email === actor.email);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Settings"
        description="Your account, the shop buyers see, and what the platform does with it."
      />

      <SettingsPanels
        data={{
          displayName: shop.displayName,
          legalName: shop.legalName,
          addressLine1: shop.addressLine1,
          addressLine2: shop.addressLine2 ?? '',
          city: shop.city,
          region: shop.region ?? '',
          postalCode: shop.postalCode ?? '',
          countryCode: shop.countryCode,
          verified: shop.verified,
          memberEmail: actor.email,
          memberName: me?.name ?? actor.email,
          isOwner: me?.owner ?? false,
          services: shop.services,
          openCaseCount: disputes.filter((dispute) => dispute.status !== 'resolved').length,
          heldMinor: earnings.pendingReleaseMinor,
          currency: earnings.currency,
        }}
      />
    </div>
  );
};

export default SettingsPage;
