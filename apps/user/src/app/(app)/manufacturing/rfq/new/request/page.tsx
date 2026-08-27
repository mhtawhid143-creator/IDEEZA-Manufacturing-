import { notFound, redirect } from 'next/navigation';
import { PageHeader } from '@ideeza/ui';
import { Crumbs } from '@/components/crumbs.js';
import { RequestQuoteForm } from '@/components/rfq/request-quote-form.js';
import { DRAFT_CURRENCY, getDraft } from '@/data/drafts.js';
import { listManufacturers } from '@/data/requests.js';
import { requireBuyer } from '@/lib/auth.js';
import { openRequestHref } from '@/lib/routes.js';
import { PACKAGE_COPY, parseSelection, selectHref } from '@/lib/rfq-copy.js';
import { asId, type QuotedService, type RfqId } from '@ideeza/domain';

export const dynamic = 'force-dynamic';

/**
 * Step two: the request itself.
 *
 * The recipients come from the selection step in the query string, so the back
 * button works and a request in progress can be shared or reopened.
 */
const RequestQuotePage = async ({
  searchParams,
}: {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}) => {
  const actor = await requireBuyer('/manufacturing/rfq/new/request');
  const params = await searchParams;
  const raw = params['draft'];
  const draftId = typeof raw === 'string' ? raw : undefined;
  if (draftId === undefined) notFound();

  const draft = await getDraft(actor.userId, asId<RfqId>(draftId));
  if (draft === null) notFound();
  if (draft.status !== 'draft') redirect(openRequestHref(draft.rfqId, draft.status));

  const selection = parseSelection(params['m']);
  if (selection.length === 0) redirect(selectHref(draft.rfqId));

  const impliedServices: readonly QuotedService[] =
    draft.kind === 'module_3d'
      ? ['enclosure_3d']
      : draft.assembly === 'none'
        ? ['pcb_fabrication']
        : ['pcb_fabrication', 'pcb_assembly'];

  const manufacturers = await listManufacturers({
    requestedServices: impliedServices,
    quantity: draft.quantity,
    leadTimeDays: draft.leadTimeDays,
  });
  const chosen = manufacturers.filter((manufacturer) => selection.includes(manufacturer.id));
  if (chosen.length === 0) redirect(selectHref(draft.rfqId));

  // The spec chips are the draft's own requirements, not decoration.
  const specChips = [
    draft.material,
    draft.tolerance,
    `${draft.leadTimeDays} days`,
    draft.qualityCheckRequirement,
  ].filter((chip) => chip.trim() !== '');

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Request quote"
        description={`${draft.productName} · ${PACKAGE_COPY[draft.kind]}`}
        breadcrumbs={
          <Crumbs
            items={[
              { label: 'Draft', href: `/manufacturing/draft/${draft.rfqId}` },
              { label: 'Select manufacturer', href: selectHref(draft.rfqId) },
              { label: 'Request quote' },
            ]}
          />
        }
      />

      <RequestQuoteForm
        draftId={draft.rfqId}
        productName={draft.productName}
        packageKind={draft.kind}
        packageLabel={PACKAGE_COPY[draft.kind]}
        specChips={specChips}
        fileCount={draft.includedFileIds.length}
        bomLineCount={draft.includedBomLineIds.length}
        quantity={draft.quantity}
        leadTimeDays={draft.leadTimeDays}
        currency={DRAFT_CURRENCY}
        assembly={draft.assembly}
        assemblySides={draft.assemblySides ?? null}
        notes={draft.notes ?? ''}
        recipients={chosen.map((manufacturer) => ({
          id: manufacturer.id,
          displayName: manufacturer.displayName,
          city: manufacturer.city,
          countryCode: manufacturer.countryCode,
          rating: manufacturer.rating,
          fitVerdict: manufacturer.fit?.verdict ?? 'meets',
          missingServices: manufacturer.fit?.missingServices ?? [],
        }))}
        deliveryAddress={{
          line1: draft.deliveryAddress.line1,
          line2: draft.deliveryAddress.line2 ?? '',
          city: draft.deliveryAddress.city,
          region: draft.deliveryAddress.region ?? '',
          postalCode: draft.deliveryAddress.postalCode ?? '',
          countryCode: draft.deliveryAddress.countryCode,
        }}
      />
    </div>
  );
};

export default RequestQuotePage;
