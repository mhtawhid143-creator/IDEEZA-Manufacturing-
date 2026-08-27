import { notFound, redirect } from 'next/navigation';
import { Alert, PageHeader } from '@ideeza/ui';
import { Crumbs } from '@/components/crumbs.js';
import { DraftForm } from '@/components/draft-form.js';
import { defaultDeliveryAddress } from '@/data/drafts.js';
import { getProductDetail, openRequestForProduct } from '@/data/products.js';
import { requireBuyer } from '@/lib/auth.js';
import { openRequestHref } from '@/lib/routes.js';
import { asId, fileKindOf, type ProductId } from '@ideeza/domain';

export const dynamic = 'force-dynamic';

/**
 * Step one of a new request, opened from a product.
 *
 * Nothing is written until the buyer saves: a draft that was started and
 * abandoned would otherwise block the product from being started again.
 */
const NewDraftPage = async ({
  searchParams,
}: {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}) => {
  const actor = await requireBuyer('/manufacturing/draft/new');
  const params = await searchParams;
  const raw = params['product'];
  const productId = typeof raw === 'string' ? raw : undefined;

  if (productId === undefined) notFound();

  const product = await getProductDetail(actor.userId, asId<ProductId>(productId));
  if (product === null) notFound();

  // The rule that guards the button guards the route as well.
  const open = await openRequestForProduct(actor.userId, asId<ProductId>(productId));
  if (open !== undefined) redirect(openRequestHref(open.rfqId, open.status));

  const address = await defaultDeliveryAddress(actor.userId);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="New manufacturing request"
        description={`Started from ${product.name}.`}
        breadcrumbs={
          <Crumbs
            items={[
              { label: 'Manufacturing', href: '/manufacturing' },
              { label: 'New request' },
            ]}
          />
        }
      />

      {product.availability !== 'available' && (
        <Alert tone="warning" title="Currently unavailable">
          The creator has taken this product out of circulation, so this request
          cannot be saved.
        </Alert>
      )}

      <Alert tone="info" title="What this request starts from">
        {product.name} travels with its {product.fileCount} model{' '}
        {product.fileCount === 1 ? 'file' : 'files'} and {product.bomLineCount} BOM{' '}
        {product.bomLineCount === 1 ? 'line' : 'lines'}. Manufacturers are chosen
        after the requirements are saved.
      </Alert>

      <DraftForm
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
          kind: 'full_product',
          printTechnology: '',
          printMaterial: '',
          printColor: '',
          surfaceFinish: '',
          infillPercent: '',
          includedFileIds: product.files.map((file) => file.id),
          includedBomLineIds: product.bomLines.map((line) => line.id),
          quantity: '',
          material: '',
          manufacturingMethod: '',
          tolerance: '',
          leadTimeDays: '',
          shippingRequirement: '',
          assembly: 'smt',
          qualityCheckRequirement: '',
          substitutionPolicy: 'with_approval',
          notes: '',
          deliveryAddress: {
            line1: address?.line1 ?? '',
            line2: address?.line2 ?? '',
            city: address?.city ?? '',
            region: address?.region ?? '',
            postalCode: address?.postalCode ?? '',
            countryCode: address?.countryCode ?? '',
          },
        }}
      />
    </div>
  );
};

export default NewDraftPage;
