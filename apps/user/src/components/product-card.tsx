import Link from 'next/link';
import { Card, StatusChip, Text, buttonAppearance } from '@ideeza/ui';
import { FavoriteToggle } from './favorite-toggle.js';
import { ModelPreview } from './model-preview.js';
import type { ProductCardView } from '@/data/products.js';

export interface ProductCardProps {
  readonly product: ProductCardView;
}

/**
 * One kept product.
 *
 * "Manufacture this" opens the single-product page, which is where the buyer
 * sees what they would be sending to manufacture before they send it. An
 * unavailable product keeps the card and loses only the action.
 */
export const ProductCard = ({ product }: ProductCardProps) => {
  const available = product.availability === 'available';
  const href = `/products/${product.id}`;

  return (
    <Card padded={false} interactive className="flex w-full flex-col overflow-hidden">
      <ModelPreview name={product.name} fileCount={product.fileCount} />

      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <Link
              href={href}
              className="text-sm font-semibold text-heading hover:text-brand focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus"
            >
              {product.name}
            </Link>
            <Text tone="muted" size="xs" className="mt-0.5 truncate">
              by {product.creatorName}
            </Text>
          </div>
          <FavoriteToggle productId={product.id} productName={product.name} favorite />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {available ? (
            <StatusChip status="available" label="Available" />
          ) : (
            <StatusChip status="unavailable" label="Currently unavailable" />
          )}
          {product.openRequest !== undefined && (
            <StatusChip status={product.openRequest.status} withDot />
          )}
        </div>

        <Text tone="muted" size="xs">
          {product.fileCount} model {product.fileCount === 1 ? 'file' : 'files'} ·{' '}
          {product.bomLineCount} BOM {product.bomLineCount === 1 ? 'line' : 'lines'}
        </Text>

        <div className="mt-auto pt-1">
          {available ? (
            <Link href={href} className={buttonAppearance({ fullWidth: true })}>
              Manufacture this
            </Link>
          ) : (
            <span
              aria-disabled
              className={buttonAppearance({
                fullWidth: true,
                className:
                  'cursor-not-allowed bg-disabled-bg text-disabled-text shadow-none hover:bg-disabled-bg',
              })}
            >
              Currently unavailable
            </span>
          )}
        </div>
      </div>
    </Card>
  );
};
