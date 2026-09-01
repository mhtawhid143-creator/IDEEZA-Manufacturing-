import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Card, StatusChip, Text, buttonAppearance } from '@ideeza/ui';
import { ProfilePanels } from '@/components/profile/profile-panels.js';
import { getShopProfile } from '@/data/profile.js';
import { requireManufacturer } from '@/lib/auth.js';

export const dynamic = 'force-dynamic';

const day = (value: Date): string => value.toISOString().slice(0, 10);

/**
 * The shop's own profile.
 *
 * The header numbers are live counts rather than a summary somebody keeps up to
 * date: reviews, quotes sent, orders built. What buyers are matched on is edited
 * here too, because it is the same record — and it is the difference between
 * being reachable and being invisible.
 */
const ProfilePage = async () => {
  const actor = await requireManufacturer('/profile');
  const shop = await getShopProfile(actor.manufacturerId);
  if (shop === null) notFound();

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-4">
              <span
                aria-hidden
                className="inline-flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-bg-brand text-lg font-bold text-text-on-brand"
              >
                {shop.displayName.slice(0, 2).toUpperCase()}
              </span>
              <div className="min-w-0">
                <h1 className="truncate text-xl font-bold text-text-primary">
                  {shop.displayName}
                </h1>
                {shop.tagline !== null && (
                  <Text size="sm" className="mt-0.5 block max-w-measure text-text-secondary">
                    {shop.tagline}
                  </Text>
                )}
                <Text tone="muted" size="xs" className="mt-1 block">
                  {shop.city}, {shop.countryCode} · on IDEEZA since{' '}
                  {day(shop.memberSince)}
                </Text>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-6">
              <div>
                <p className="text-lg font-bold text-text-primary">
                  {shop.rating === null ? '—' : shop.rating.toFixed(1)}
                  <span className="ml-1 text-text-brand">★</span>
                </p>
                <Text tone="muted" size="xs">
                  {shop.reviewCount} review{shop.reviewCount === 1 ? '' : 's'}
                </Text>
              </div>
              <div>
                <p className="text-lg font-bold text-text-primary">{shop.orderCount}</p>
                <Text tone="muted" size="xs">
                  orders built
                </Text>
              </div>
              <div>
                <p className="text-lg font-bold text-text-primary">{shop.quoteCount}</p>
                <Text tone="muted" size="xs">
                  quotes sent
                </Text>
              </div>
              <div>
                <p className="text-lg font-bold text-text-primary">{shop.partCount}</p>
                <Text tone="muted" size="xs">
                  parts held
                </Text>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <StatusChip
                status={shop.verified ? 'accepted' : 'pending'}
                label={shop.verified ? 'Verified shop' : 'Verification pending'}
                withDot
              />
              <Link
                href="/settings"
                className={buttonAppearance({ variant: 'secondary', size: 'sm' })}
              >
                Settings
              </Link>
              <Link
                href="/inventory"
                className={buttonAppearance({ variant: 'secondary', size: 'sm' })}
              >
                Inventory
              </Link>
            </div>
          </div>

          <div className="rounded-xl border border-border-subtle bg-bg-page p-4">
            <p className="text-sm font-semibold text-text-primary">
              What this profile decides
            </p>
            <Text size="sm" className="mt-2 block">
              A buyer&rsquo;s request only reaches shops whose published services cover
              it, and a minimum order quantity above their volume refuses you outright.
              The rest of this page is what a buyer reads before choosing.
            </Text>
          </div>
        </div>
      </Card>

      <ProfilePanels
        data={{
          displayName: shop.displayName,
          legalName: shop.legalName,
          addressLine1: shop.addressLine1,
          addressLine2: shop.addressLine2 ?? '',
          city: shop.city,
          region: shop.region ?? '',
          postalCode: shop.postalCode ?? '',
          countryCode: shop.countryCode,
          tagline: shop.tagline ?? '',
          about: shop.about ?? '',
          phone: shop.phone ?? '',
          websiteUrl: shop.websiteUrl ?? '',
          employeeBand: shop.employeeBand ?? '',
          shippingMethods: shop.shippingMethods,
          facebookUrl: shop.facebookUrl ?? '',
          twitterUrl: shop.twitterUrl ?? '',
          instagramUrl: shop.instagramUrl ?? '',
          linkedinUrl: shop.linkedinUrl ?? '',
          verified: shop.verified,
          rating: shop.rating,
          onTimeDeliveryRate: shop.onTimeDeliveryRate,
          completedOrderCount: shop.completedOrderCount,
          memberSince: day(shop.memberSince),
          services: shop.services,
          certifications: shop.certifications,
          servedRegions: shop.servedRegions,
          minimumOrderQuantity:
            shop.minimumOrderQuantity === null ? '' : String(shop.minimumOrderQuantity),
          standardLeadTimeDays:
            shop.standardLeadTimeDays === null ? '' : String(shop.standardLeadTimeDays),
          reviewCount: shop.reviewCount,
          quoteCount: shop.quoteCount,
          orderCount: shop.orderCount,
          partCount: shop.partCount,
          members: shop.members,
          machines: shop.machines,
          capabilitySheets: shop.capabilitySheets,
          articles: shop.articles.map((article) => ({
            id: article.id,
            title: article.title,
            category: article.category,
            status: article.status,
            rejectReason: article.rejectReason,
            on: day(article.on),
          })),
          reviews: shop.reviews.map((review) => ({
            id: review.id,
            rating: review.rating,
            body: review.body,
            buyerName: review.buyerName,
            productName: review.productName,
            on: day(review.publishedAt),
          })),
        }}
      />
    </div>
  );
};

export default ProfilePage;
