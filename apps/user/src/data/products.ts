import {
  isOpenRequestStatus,
  type OpenProductRequest,
  type ProductAvailability,
  type ProductId,
  type RfqId,
  type RfqStatus,
  type UserId,
  asId,
} from '@ideeza/domain';
import { database } from '@/lib/db.js';

/** One model file the product carries. Storage arrives with a later task. */
export interface ProductFileView {
  readonly id: string;
  readonly name: string;
  readonly revision: number;
  readonly byteSize: number;
}

export interface ProductCardView {
  readonly id: ProductId;
  readonly name: string;
  readonly creatorName: string;
  readonly availability: ProductAvailability;
  readonly fileCount: number;
  readonly bomLineCount: number;
  readonly favoritedAt?: string | undefined;
  /** The buyer's own open request for this product, when there is one. */
  readonly openRequest?: OpenProductRequest | undefined;
}

export interface ProductReviewView {
  readonly id: string;
  readonly rating: number;
  readonly body: string | null;
  readonly authorName: string;
  readonly manufacturerName: string;
  readonly createdAt: Date;
}

export interface ProductDetailView extends ProductCardView {
  readonly creatorEmail: string;
  readonly createdAt: Date;
  readonly files: readonly ProductFileView[];
  readonly bomLines: readonly {
    readonly id: string;
    readonly reference: string;
    readonly componentName: string;
    readonly manufacturerPartNumber: string | null;
    readonly quantityPerUnit: number;
  }[];
  readonly isFavorite: boolean;
  readonly reviews: readonly ProductReviewView[];
  readonly averageRating: number | undefined;
}

const openRequestOf = (
  rows: readonly { readonly id: string; readonly status: RfqStatus }[],
): OpenProductRequest | undefined => {
  const open = rows.find((row) => isOpenRequestStatus(row.status));
  return open === undefined
    ? undefined
    : { rfqId: asId<RfqId>(open.id), status: open.status };
};

/**
 * The buyer's own open request for a product, which is what decides whether
 * "Start manufacturing" opens a new draft or points at the request that is
 * already running.
 */
export const openRequestForProduct = async (
  buyerId: UserId,
  productId: ProductId,
): Promise<OpenProductRequest | undefined> => {
  const rows = await database().rfq.findMany({
    where: {
      buyerId,
      status: { in: ['draft', 'submitted'] },
      package: { productId },
    },
    select: { id: true, status: true },
    orderBy: { createdAt: 'desc' },
  });
  return openRequestOf(rows);
};

/** Everything the buyer has kept, newest first, with each card's live state. */
export const listFavoriteProducts = async (
  buyerId: UserId,
): Promise<readonly ProductCardView[]> => {
  const favorites = await database().productFavorite.findMany({
    where: { userId: buyerId },
    orderBy: { createdAt: 'desc' },
    include: {
      product: {
        include: {
          owner: { select: { displayName: true } },
          _count: { select: { files: true, bomLines: true } },
          packages: {
            select: {
              rfqs: {
                where: { buyerId, status: { in: ['draft', 'submitted'] } },
                select: { id: true, status: true },
                orderBy: { createdAt: 'desc' },
              },
            },
          },
        },
      },
    },
  });

  return favorites.map((favorite) => {
    const rfqs = favorite.product.packages.flatMap((pkg) => pkg.rfqs);
    return {
      id: asId<ProductId>(favorite.product.id),
      name: favorite.product.name,
      creatorName: favorite.product.owner.displayName,
      availability: favorite.product.availability,
      fileCount: favorite.product._count.files,
      bomLineCount: favorite.product._count.bomLines,
      favoritedAt: favorite.createdAt.toISOString(),
      openRequest: openRequestOf(rfqs),
    };
  });
};

/**
 * One product, as the single-product page needs it.
 *
 * The reviews are the real ones: a review belongs to a delivered order, and the
 * orders that reach this product are the orders that were produced from it.
 */
export const getProductDetail = async (
  buyerId: UserId,
  productId: ProductId,
): Promise<ProductDetailView | null> => {
  const product = await database().product.findUnique({
    where: { id: productId },
    include: {
      owner: { select: { displayName: true, email: true } },
      files: { include: { file: true } },
      bomLines: { orderBy: { reference: 'asc' } },
      favorites: { where: { userId: buyerId }, select: { createdAt: true } },
      packages: {
        select: {
          rfqs: {
            select: {
              id: true,
              status: true,
              buyerId: true,
              orders: {
                select: {
                  review: {
                    include: {
                      author: { select: { displayName: true } },
                      manufacturer: { select: { displayName: true } },
                    },
                  },
                },
              },
            },
            orderBy: { createdAt: 'desc' },
          },
        },
      },
    },
  });

  if (product === null) return null;

  const rfqs = product.packages.flatMap((pkg) => pkg.rfqs);
  const reviews = rfqs
    .flatMap((rfq) => rfq.orders)
    .flatMap((order) => (order.review === null ? [] : [order.review]))
    .map((review) => ({
      id: review.id,
      rating: review.rating,
      body: review.body,
      authorName: review.anonymous ? 'Verified buyer' : review.author.displayName,
      manufacturerName: review.manufacturer.displayName,
      createdAt: review.createdAt,
    }))
    .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime());

  const favorite = product.favorites[0];

  return {
    id: asId<ProductId>(product.id),
    name: product.name,
    creatorName: product.owner.displayName,
    creatorEmail: product.owner.email,
    availability: product.availability,
    createdAt: product.createdAt,
    fileCount: product.files.length,
    bomLineCount: product.bomLines.length,
    favoritedAt: favorite?.createdAt.toISOString(),
    isFavorite: favorite !== undefined,
    openRequest: openRequestOf(rfqs.filter((rfq) => rfq.buyerId === buyerId)),
    files: product.files.map((link) => ({
      id: link.file.id,
      name: link.file.name,
      revision: link.file.revision,
      byteSize: link.file.byteSize,
    })),
    bomLines: product.bomLines.map((line) => ({
      id: line.id,
      reference: line.reference,
      componentName: line.componentName,
      manufacturerPartNumber: line.manufacturerPartNumber,
      quantityPerUnit: line.quantityPerUnit,
    })),
    reviews,
    averageRating:
      reviews.length === 0
        ? undefined
        : reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length,
  };
};
