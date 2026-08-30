import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import {
  Card,
  EmptyState,
  PageHeader,
  Text,
  buttonAppearance,
} from '@ideeza/ui';
import { Crumbs } from '@/components/crumbs.js';
import { getDraft } from '@/data/drafts.js';
import { listManufacturers } from '@/data/requests.js';
import { requireBuyer } from '@/lib/auth.js';
import { openRequestHref } from '@/lib/routes.js';
import {
  FIT_COPY,
  parseSelection,
  requestHref,
  selectHref,
} from '@/lib/rfq-copy.js';
import { asId, type RfqId } from '@ideeza/domain';

export const dynamic = 'force-dynamic';

/**
 * The comparison the design puts between selecting and sending.
 *
 * Every row is a fact the platform holds about a manufacturer. Rows the design
 * shows that IDEEZA does not yet record — packaging, NDA terms, monthly
 * capacity — are left out rather than filled with numbers nobody published.
 */
const CompareManufacturersPage = async ({
  searchParams,
}: {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}) => {
  const actor = await requireBuyer('/manufacturing/rfq/new/compare');
  const params = await searchParams;
  const raw = params['draft'];
  const draftId = typeof raw === 'string' ? raw : undefined;
  if (draftId === undefined) notFound();

  const draft = await getDraft(actor.userId, asId<RfqId>(draftId));
  if (draft === null) notFound();
  if (draft.status !== 'draft') redirect(openRequestHref(draft.rfqId, draft.status));

  const selection = parseSelection(params['m']);
  const impliedServices =
    draft.kind === 'module_3d'
      ? (['enclosure_3d'] as const)
      : draft.assembly === 'none'
        ? (['pcb_fabrication'] as const)
        : (['pcb_fabrication', 'pcb_assembly'] as const);

  const all = await listManufacturers({
    requestedServices: [...impliedServices],
    quantity: draft.quantity,
    leadTimeDays: draft.leadTimeDays,
  });
  const chosen = all.filter((manufacturer) => selection.includes(manufacturer.id));

  const rows: readonly {
    readonly label: string;
    readonly value: (manufacturer: (typeof chosen)[number]) => string;
  }[] = [
    {
      label: 'Fit for this request',
      value: (manufacturer) => FIT_COPY[manufacturer.fit?.verdict ?? 'meets'].label,
    },
    {
      label: 'Minimum order quantity',
      value: (manufacturer) =>
        manufacturer.minimumOrderQuantity === null
          ? '—'
          : `${manufacturer.minimumOrderQuantity} units`,
    },
    {
      label: 'Standard lead time',
      value: (manufacturer) =>
        manufacturer.standardLeadTimeDays === null
          ? '—'
          : `${manufacturer.standardLeadTimeDays} days`,
    },
    {
      label: 'On-time delivery',
      value: (manufacturer) =>
        manufacturer.onTimeDeliveryRate === null
          ? '—'
          : `${Math.round(manufacturer.onTimeDeliveryRate * 100)}%`,
    },
    {
      label: 'Rating',
      value: (manufacturer) =>
        manufacturer.rating === null ? '—' : `★ ${manufacturer.rating.toFixed(1)}`,
    },
    {
      label: 'Completed orders',
      value: (manufacturer) => String(manufacturer.completedOrderCount),
    },
    {
      label: 'Services',
      value: (manufacturer) =>
        manufacturer.services.length === 0
          ? '—'
          : manufacturer.services.map((service) => service.replace(/_/g, ' ')).join(', '),
    },
    {
      label: 'Certifications',
      value: (manufacturer) =>
        manufacturer.certifications.length === 0 ? '—' : manufacturer.certifications.join(', '),
    },
    {
      label: 'Regions served',
      value: (manufacturer) =>
        manufacturer.servedRegions.length === 0 ? '—' : manufacturer.servedRegions.join(', '),
    },
    {
      label: 'Verified by IDEEZA',
      value: (manufacturer) => (manufacturer.verified ? 'Yes' : 'Not yet'),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Compare manufacturers"
        description={`Side by side, for ${draft.productName} · ${draft.quantity} units.`}
        breadcrumbs={
          <Crumbs
            items={[
              { label: 'Draft', href: `/manufacturing/draft/${draft.rfqId}` },
              { label: 'Select manufacturer', href: selectHref(draft.rfqId) },
              { label: 'Compare' },
            ]}
          />
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`${selectHref(draft.rfqId)}&m=${selection.join(',')}`}
              className={buttonAppearance({ variant: 'secondary' })}
            >
              Back to selection
            </Link>
            {chosen.length > 0 && (
              <Link
                href={requestHref(draft.rfqId, chosen.map((manufacturer) => manufacturer.id))}
                className={buttonAppearance()}
              >
                Continue to quotes
              </Link>
            )}
          </div>
        }
      />

      {chosen.length === 0 ? (
        <EmptyState
          title="Nothing to compare yet"
          description="Select at least two manufacturers, then come back to compare them."
          action={
            <Link href={selectHref(draft.rfqId)} className={buttonAppearance({ variant: 'secondary' })}>
              Select manufacturers
            </Link>
          }
        />
      ) : (
        <Card padded={false} className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-sm">
              <caption className="ids-sr-only">
                Manufacturers compared for {draft.productName}
              </caption>
              <thead>
                <tr className="bg-bg-page">
                  <th scope="col" className="px-4 py-3 text-left font-semibold text-text-primary">
                    Capability
                  </th>
                  {chosen.map((manufacturer) => (
                    <th
                      key={manufacturer.id}
                      scope="col"
                      className="px-4 py-3 text-left font-semibold text-text-primary"
                    >
                      <span className="flex items-center gap-2">
                        <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-bg-brand-subtle text-xs font-semibold text-text-brand">
                          {manufacturer.displayName.slice(0, 2).toUpperCase()}
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate">{manufacturer.displayName}</span>
                          <span className="block text-xs font-normal text-text-tertiary">
                            {manufacturer.city}, {manufacturer.countryCode}
                          </span>
                        </span>
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.label} className="border-t border-border-subtle">
                    <th scope="row" className="px-4 py-3 text-left font-medium text-text-secondary">
                      {row.label}
                    </th>
                    {chosen.map((manufacturer) => (
                      <td key={manufacturer.id} className="px-4 py-3 text-text-secondary">
                        {row.value(manufacturer)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Text tone="muted" size="xs">
        Price, exact lead time, shipping, warranty and expiry are not compared here:
        they are what each manufacturer answers with once the request is sent.
      </Text>
    </div>
  );
};

export default CompareManufacturersPage;
