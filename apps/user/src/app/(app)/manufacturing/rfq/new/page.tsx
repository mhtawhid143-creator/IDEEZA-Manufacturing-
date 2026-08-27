import { notFound, redirect } from 'next/navigation';
import { Alert, Card, DefinitionList, PageHeader, Text } from '@ideeza/ui';
import { Crumbs } from '@/components/crumbs.js';
import { SelectManufacturers } from '@/components/rfq/select-manufacturers.js';
import { getDraft } from '@/data/drafts.js';
import { listManufacturers } from '@/data/requests.js';
import { requireBuyer } from '@/lib/auth.js';
import { openRequestHref } from '@/lib/routes.js';
import { PACKAGE_COPY, parseSelection } from '@/lib/rfq-copy.js';
import { asId, type QuotedService, type RfqId } from '@ideeza/domain';

export const dynamic = 'force-dynamic';

/**
 * Step one of sending a request: select the manufacturers.
 *
 * Fit is read against what the draft asks for, so a card can say whether that
 * manufacturer can build this board before anybody is contacted. The services
 * assumed here are the ones the package implies; the buyer confirms them on the
 * next step.
 */
const SelectManufacturerPage = async ({
  searchParams,
}: {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}) => {
  const actor = await requireBuyer('/manufacturing/rfq/new');
  const params = await searchParams;
  const raw = params['draft'];
  const draftId = typeof raw === 'string' ? raw : undefined;

  if (draftId === undefined) notFound();

  const draft = await getDraft(actor.userId, asId<RfqId>(draftId));
  if (draft === null) notFound();
  if (draft.status !== 'draft') redirect(openRequestHref(draft.rfqId, draft.status));

  const impliedServices: readonly QuotedService[] =
    draft.kind === 'pcb'
      ? draft.assembly === 'none'
        ? ['pcb_fabrication']
        : ['pcb_fabrication', 'pcb_assembly']
      : draft.kind === 'module_3d'
        ? ['enclosure_3d']
        : ['pcb_fabrication', 'pcb_assembly', 'enclosure_3d'];

  const manufacturers = await listManufacturers({
    requestedServices: impliedServices,
    quantity: draft.quantity,
    leadTimeDays: draft.leadTimeDays,
    billOfMaterials: draft.bomLines.map((line) => ({
      sku: line.sku,
      quantityPerUnit: line.quantityRequired,
    })),
  });

  const reasonsFor = (fit: (typeof manufacturers)[number]['fit']): readonly string[] => {
    if (fit === undefined) return [];
    const reasons: string[] = [];
    if (fit.belowMinimumOrderQuantity) reasons.push('Minimum order quantity is higher');
    if (fit.slowerThanAsked) reasons.push('Usually slower than asked');
    if (fit.missingServices.length > 0) {
      reasons.push(`${fit.missingServices.length} service(s) not published`);
    }
    return reasons;
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Select manufacturer"
        description="Every manufacturer you choose answers with its own quote. You accept at most one."
        breadcrumbs={
          <Crumbs
            items={[
              { label: 'Draft', href: `/manufacturing/draft/${draft.rfqId}` },
              { label: 'Select manufacturer' },
            ]}
          />
        }
      />

      <Card className="flex flex-col gap-3">
        <Text size="sm" className="font-semibold">
          This request
        </Text>
        <DefinitionList
          columns={2}
          items={[
            { label: 'Board', value: draft.productName },
            { label: 'Package', value: PACKAGE_COPY[draft.kind] },
            { label: 'Volume', value: `${draft.quantity} units` },
            { label: 'Lead time asked for', value: `${draft.leadTimeDays} days` },
            { label: 'Material', value: draft.material },
            { label: 'Files', value: String(draft.includedFileIds.length) },
          ]}
        />
      </Card>

      {manufacturers.length === 0 ? (
        <Alert tone="warning" title="No manufacturers to send to">
          There are no manufacturers on the platform yet, so this request cannot be
          routed.
        </Alert>
      ) : (
        <SelectManufacturers
          draftId={draft.rfqId}
          initialSelection={parseSelection(params['m'])}
          manufacturers={manufacturers.map((manufacturer) => ({
            id: manufacturer.id,
            displayName: manufacturer.displayName,
            city: manufacturer.city,
            countryCode: manufacturer.countryCode,
            rating: manufacturer.rating,
            onTimeDeliveryRate: manufacturer.onTimeDeliveryRate,
            completedOrderCount: manufacturer.completedOrderCount,
            verified: manufacturer.verified,
            services: manufacturer.services,
            certifications: manufacturer.certifications,
            servedRegions: manufacturer.servedRegions,
            minimumOrderQuantity: manufacturer.minimumOrderQuantity,
            standardLeadTimeDays: manufacturer.standardLeadTimeDays,
            fitVerdict: manufacturer.fit?.verdict ?? 'meets',
            fitReasons: reasonsFor(manufacturer.fit),
            partsInStock:
              manufacturer.fit?.partsTotalLines == null
                ? null
                : {
                    covered: manufacturer.fit.partsCoveredLines ?? 0,
                    total: manufacturer.fit.partsTotalLines,
                  },
          }))}
        />
      )}
    </div>
  );
};

export default SelectManufacturerPage;
