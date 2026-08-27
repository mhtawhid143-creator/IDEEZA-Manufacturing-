import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import {
  Alert,
  Card,
  CardHeader,
  DefinitionList,
  PageHeader,
  StatusChip,
  Text,
  buttonAppearance,
} from '@ideeza/ui';
import { Crumbs } from '@/components/crumbs.js';
import { DraftForm } from '@/components/draft-form.js';
import { WithdrawDraft } from '@/components/withdraw-draft.js';
import { boardSpecRows, getBoardSpec } from '@/data/board-spec.js';
import { getDraft } from '@/data/drafts.js';
import { getProductDetail } from '@/data/products.js';
import { requireBuyer } from '@/lib/auth.js';
import { openRequestHref } from '@/lib/routes.js';
import { asId, fileKindOf, type RfqId } from '@ideeza/domain';

export const dynamic = 'force-dynamic';

const PACKAGE_LABEL: Readonly<Record<string, string>> = {
  pcb: 'PCB only',
  module_3d: '3D module',
  full_product: 'Full product',
};

/**
 * A saved draft: the same step, reopened.
 *
 * A request that has already been sent is not editable, so this route sends the
 * buyer to the request itself rather than to a form that could not be saved.
 */
const DraftPage = async ({
  params,
  searchParams,
}: {
  readonly params: Promise<{ readonly draftId: string }>;
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}) => {
  const { draftId } = await params;
  const actor = await requireBuyer(`/manufacturing/draft/${draftId}`);
  const [draft, spec] = await Promise.all([
    getDraft(actor.userId, asId<RfqId>(draftId)),
    getBoardSpec(actor.userId, asId<RfqId>(draftId)),
  ]);

  if (draft === null) notFound();
  if (draft.status !== 'draft') redirect(openRequestHref(draft.rfqId, draft.status));

  const product = await getProductDetail(actor.userId, draft.productId);
  if (product === null) notFound();

  const query = await searchParams;
  const justSaved = query['saved'] === '1';

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Manufacturing request draft"
        description={`${draft.productName} · ${PACKAGE_LABEL[draft.kind] ?? draft.kind}`}
        breadcrumbs={
          <Crumbs
            items={[
              { label: 'Manufacturing', href: '/manufacturing' },
              { label: 'Draft' },
            ]}
          />
        }
        actions={
          <div className="flex items-center gap-2">
            <StatusChip status={draft.status} withDot />
            <Link href="/manufacturing" className={buttonAppearance({ variant: 'secondary' })}>
              All drafts
            </Link>
          </div>
        }
      />

      {justSaved && (
        <Alert tone="success" title="Draft saved">
          Nothing has been sent yet. Select the manufacturers when the
          requirements are how you want them.
        </Alert>
      )}

      {spec !== null && spec.hasBoard && (
        <Card>
          <CardHeader
            title="Board specification"
            description="What every manufacturer will quote against. Anything left open is their choice, and their quote says what they chose."
            actions={
              <Link
                href={`/manufacturing/draft/${draft.rfqId}/specification`}
                className={buttonAppearance({ variant: 'secondary' })}
              >
                Edit specification
              </Link>
            }
          />
          <DefinitionList
            className="mt-4"
            columns={2}
            items={boardSpecRows(spec)
              .slice(0, 8)
              .map((row) => ({ label: row.label, value: row.value }))}
          />
          <Text tone="muted" size="xs" className="mt-3">
            {spec.specifiedCount} of the detailed options are set. The rest are left to
            the manufacturer.
          </Text>
        </Card>
      )}

      <Card tone="brand">
        <CardHeader
          title="Ready to send?"
          description="The request goes to the manufacturers you choose, and each answers with its own quote."
          actions={
            <Link
              href={`/manufacturing/rfq/new?draft=${draft.rfqId}`}
              className={buttonAppearance()}
            >
              Select manufacturers
            </Link>
          }
        />
        <DefinitionList
          className="mt-4"
          columns={2}
          items={[
            { label: 'Product', value: draft.productName },
            { label: 'Package', value: PACKAGE_LABEL[draft.kind] ?? draft.kind },
            { label: 'Quantity', value: String(draft.quantity) },
            { label: 'Lead time', value: `${draft.leadTimeDays} days` },
            { label: 'Files included', value: String(draft.includedFileIds.length) },
            {
              label: 'Ships to',
              value: `${draft.deliveryAddress.city}, ${draft.deliveryAddress.countryCode}`,
            },
          ]}
        />
      </Card>

      <DraftForm
        draftId={draft.rfqId}
        product={{
          id: product.id,
          name: product.name,
          creatorName: product.creatorName,
          files: product.files.map((file) => ({
            id: file.id,
            name: file.name,
            revision: file.revision,
            // What kind of work the file implies decides what the package is.
            kind: fileKindOf(file.name),
          })),
          bomLines: product.bomLines.map((line) => ({
            id: line.id,
            reference: line.reference,
            componentName: line.componentName,
          })),
        }}
        values={{
          kind: draft.kind,
          printTechnology: draft.printTechnology ?? '',
          printMaterial: draft.printMaterial ?? '',
          printColor: draft.printColor ?? '',
          surfaceFinish: draft.surfaceFinish ?? '',
          infillPercent:
            draft.infillPercent === null ? '' : String(draft.infillPercent),
          includedFileIds: draft.includedFileIds,
          includedBomLineIds: draft.includedBomLineIds,
          quantity: draft.quantity,
          material: draft.material,
          manufacturingMethod: draft.manufacturingMethod,
          tolerance: draft.tolerance,
          leadTimeDays: draft.leadTimeDays,
          shippingRequirement: draft.shippingRequirement,
          assembly: draft.assembly,
          qualityCheckRequirement: draft.qualityCheckRequirement,
          substitutionPolicy: draft.substitutionPolicy,
          notes: draft.notes ?? '',
          deliveryAddress: {
            line1: draft.deliveryAddress.line1,
            line2: draft.deliveryAddress.line2 ?? '',
            city: draft.deliveryAddress.city,
            region: draft.deliveryAddress.region ?? '',
            postalCode: draft.deliveryAddress.postalCode ?? '',
            countryCode: draft.deliveryAddress.countryCode,
          },
        }}
      />

      <Card tone="warning">
        <CardHeader
          title="Drop this draft"
          description="Withdrawing keeps the record that you started it and frees the product for a new request."
          actions={<WithdrawDraft draftId={draft.rfqId} productName={draft.productName} />}
        />
        <Text tone="muted" size="xs" className="mt-2">
          Nothing has been sent, so no manufacturer sees this.
        </Text>
      </Card>
    </div>
  );
};

export default DraftPage;
