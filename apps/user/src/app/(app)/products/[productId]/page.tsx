import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Alert, Avatar, buttonAppearance, Card, CardHeader, DataTable, DefinitionList, EmptyState, Heading, Icon, PageHeader, StatusChip, Text } from '@ideeza/ui';
import { Crumbs } from '@/components/crumbs.js';
import { FavoriteToggle } from '@/components/favorite-toggle.js';
import { ModelPreview } from '@/components/model-preview.js';
import { StartManufacturing } from '@/components/start-manufacturing.js';
import { getProductDetail } from '@/data/products.js';
import { requireBuyer } from '@/lib/auth.js';
import { asId, type ProductId } from '@ideeza/domain';

export const dynamic = 'force-dynamic';

const KILOBYTE = 1024;

const sizeOf = (bytes: number): string =>
  bytes < KILOBYTE
    ? `${bytes} B`
    : bytes < KILOBYTE * KILOBYTE
      ? `${(bytes / KILOBYTE).toFixed(1)} kB`
      : `${(bytes / (KILOBYTE * KILOBYTE)).toFixed(1)} MB`;

const Stars = ({ rating }: { readonly rating: number }) => (
  <span className="inline-flex items-center gap-0.5" aria-label={`${rating} out of 5`}>
    {[1, 2, 3, 4, 5].map((step) => (
      <Icon
        key={step}
        name="star"
        size={14}
        filled={step <= Math.round(rating)}
        className={step <= Math.round(rating) ? 'text-text-warning' : 'text-border-strong'}
      />
    ))}
  </span>
);

/**
 * The single product page: everything the buyer should see before deciding to
 * send this model to manufacture.
 */
const ProductPage = async ({
  params,
}: {
  readonly params: Promise<{ readonly productId: string }>;
}) => {
  const { productId } = await params;
  const actor = await requireBuyer(`/products/${productId}`);
  const product = await getProductDetail(actor.userId, asId<ProductId>(productId));

  if (product === null) notFound();

  const available = product.availability === 'available';

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={product.name}
        description={`Published by ${product.creatorName}`}
        breadcrumbs={
          <Crumbs
            items={[{ label: 'Favorites', href: '/favorites' }, { label: product.name }]}
          />
        }
        actions={
          <div className="flex items-center gap-2">
            <FavoriteToggle
              productId={product.id}
              productName={product.name}
              favorite={product.isFavorite}
            />
            <StartManufacturing
              productId={product.id}
              productName={product.name}
              available={available}
            />
          </div>
        }
      />

      {!available && (
        <Alert tone="warning" title="Currently unavailable">
          The creator has taken this product out of circulation, so it cannot be
          sent to manufacture. It stays in your favourites, and the files stay on
          record.
        </Alert>
      )}

      {product.openRequest !== undefined && (
        <Alert
          tone="info"
          title="You already have an open request for this product"
          actions={
            <Link
              href={
                product.openRequest.status === 'draft'
                  ? `/manufacturing/draft/${product.openRequest.rfqId}`
                  : `/manufacturing/rfq/${product.openRequest.rfqId}`
              }
              className={buttonAppearance({ variant: 'secondary', size: 'sm' })}
            >
              View Request
            </Link>
          }
        >
          {product.openRequest.status === 'draft'
            ? 'It is still a draft, so you can keep editing it — or withdraw it and start again.'
            : 'It has been sent to the manufacturers you chose and is collecting quotes.'}
        </Alert>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-6">
          <Card padded={false} className="overflow-hidden">
            <ModelPreview name={product.name} fileCount={product.fileCount} tall />
            <div className="flex flex-wrap gap-2 p-4">
              {product.files.length === 0 ? (
                <Text tone="muted" size="sm">
                  No model files on record yet.
                </Text>
              ) : (
                product.files.map((file) => (
                  <span
                    key={file.id}
                    className="inline-flex items-center gap-2 rounded-full border border-border-subtle bg-bg-surface-raised px-3 py-1 text-xs text-text-secondary"
                  >
                    <span className="font-semibold text-text-primary">{file.name}</span>
                    <span className="text-text-tertiary">
                      rev {file.revision} · {sizeOf(file.byteSize)}
                    </span>
                  </span>
                ))
              )}
            </div>
          </Card>

          <Card>
            <CardHeader
              title="Product details"
              description="What a manufacturer would receive with the request."
            />
            <DefinitionList
              className="mt-4"
              columns={2}
              items={[
                { label: 'Product', value: product.name },
                { label: 'Creator', value: product.creatorName },
                {
                  label: 'Availability',
                  value: available ? 'Available' : 'Currently unavailable',
                },
                { label: 'Model files', value: String(product.fileCount) },
                { label: 'BOM lines', value: String(product.bomLineCount) },
                {
                  label: 'On IDEEZA since',
                  value: product.createdAt.toISOString().slice(0, 10),
                },
              ]}
            />
          </Card>

          <Card padded={false}>
            <div className="border-b border-border-subtle px-4 py-3 md:px-6">
              <Heading level={3}>Bill of materials</Heading>
            </div>
            {product.bomLines.length === 0 ? (
              <div className="p-4 md:p-6">
                <Text tone="muted" size="sm">
                  This product carries no bill of materials. The parts are agreed
                  with the manufacturer in the requirements step.
                </Text>
              </div>
            ) : (
              <DataTable
                caption={`Bill of materials for ${product.name}`}
                rows={[...product.bomLines]}
                rowKey={(line) => line.reference}
                columns={[
                  { id: 'reference', header: 'Ref', cell: (line) => line.reference },
                  { id: 'component', header: 'Component', cell: (line) => line.componentName },
                  {
                    id: 'mpn',
                    header: 'Part number',
                    cell: (line) => line.manufacturerPartNumber ?? '—',
                  },
                  {
                    id: 'qty',
                    header: 'Qty / unit',
                    align: 'right',
                    cell: (line) => String(line.quantityPerUnit),
                  },
                ]}
              />
            )}
          </Card>
        </div>

        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader title="Creator" />
            <div className="mt-3 flex items-center gap-3">
              <Avatar name={product.creatorName} />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-text-primary">
                  {product.creatorName}
                </p>
                <Text tone="muted" size="xs" className="truncate">
                  {product.creatorEmail}
                </Text>
              </div>
            </div>
            <Text tone="muted" size="xs" className="mt-3">
              The creator publishes the model. Manufacturing is quoted by the
              manufacturers you select in the request.
            </Text>
          </Card>

          <Card>
            <CardHeader
              title="Reviews"
              description="From buyers whose orders were produced from this product."
              actions={
                product.averageRating === undefined ? undefined : (
                  <span className="flex items-center gap-2 text-sm font-semibold text-text-primary">
                    <Stars rating={product.averageRating} />
                    {product.averageRating.toFixed(1)}
                  </span>
                )
              }
            />
            {product.reviews.length === 0 ? (
              <div className="mt-4">
                <EmptyState
                  framed={false}
                  title="No reviews yet"
                  description="A review is written after an order from this product has been delivered."
                />
              </div>
            ) : (
              <ul className="mt-4 flex flex-col gap-4">
                {product.reviews.map((review) => (
                  <li key={review.id} className="border-b border-border-subtle pb-4 last:border-0 last:pb-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-text-primary">{review.authorName}</p>
                      <Stars rating={review.rating} />
                    </div>
                    <Text tone="muted" size="xs" className="mt-0.5">
                      Produced by {review.manufacturerName} ·{' '}
                      {review.createdAt.toISOString().slice(0, 10)}
                    </Text>
                    {review.body !== null && (
                      <Text size="sm" className="mt-2">
                        {review.body}
                      </Text>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card tone="brand">
            <Heading level={3}>What happens next</Heading>
            <ol className="mt-3 flex flex-col gap-2">
              {[
                'Choose the package and fill in the manufacturing requirements.',
                'Select the manufacturers the request goes to, and send it.',
                'Compare the quotes that come back, then pay to confirm the order.',
              ].map((step, index) => (
                <li key={step} className="ids-measure flex gap-2 text-sm text-text-secondary">
                  <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-bg-brand-subtle text-[11px] font-semibold text-text-brand">
                    {index + 1}
                  </span>
                  {step}
                </li>
              ))}
            </ol>
            <div className="mt-4">
              <StatusChip status="awaiting_payment" label="Accepting a quote does not create a confirmed order" />
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default ProductPage;
