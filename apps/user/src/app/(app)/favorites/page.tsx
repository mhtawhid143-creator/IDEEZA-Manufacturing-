import Link from 'next/link';
import { Card, EmptyState, PageHeader, Text, buttonAppearance } from '@ideeza/ui';
import { ProductCard } from '@/components/product-card.js';
import { listFavoriteProducts } from '@/data/products.js';
import { requireBuyer } from '@/lib/auth.js';

export const dynamic = 'force-dynamic';

/**
 * Favourites: the buyer's own entry point into manufacturing.
 *
 * A card is where the journey starts, so the card carries the state that
 * decides what can happen next: whether the creator still offers the product,
 * and whether a request for it is already open.
 */
const FavoritesPage = async () => {
  const actor = await requireBuyer('/favorites');
  const products = await listFavoriteProducts(actor.userId);

  const openRequests = products.filter((product) => product.openRequest !== undefined).length;
  const unavailable = products.filter((product) => product.availability !== 'available').length;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Favorites"
        description="Products you have kept. Open one to see what would be sent to manufacture, then start a request."
      />

      {products.length === 0 ? (
        <EmptyState
          title="Nothing kept yet"
          description="Products you keep appear here, and manufacturing starts from one of them."
          action={
            <Link href="/manufacturing" className={buttonAppearance({ variant: 'secondary' })}>
              Go to Manufacturing
            </Link>
          }
        />
      ) : (
        <>
          <Card tone="brand" className="flex flex-wrap items-center gap-x-6 gap-y-1">
            <Text size="sm">
              <span className="font-semibold">{products.length}</span> kept
            </Text>
            <Text size="sm">
              <span className="font-semibold">{openRequests}</span> with an open request
            </Text>
            <Text size="sm">
              <span className="font-semibold">{unavailable}</span> currently unavailable
            </Text>
          </Card>

          <ul
            aria-label="Favourite products"
            className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3"
          >
            {products.map((product) => (
              <li key={product.id} className="flex">
                <ProductCard product={product} />
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
};

export default FavoritesPage;
