import {
  asId,
  asTimestamp,
  money,
  type AcceptedQuoteSnapshot,
  type DomainEvent,
  type DomainEventId,
  type DomainEventKind,
  type ManufacturerId,
  type ManufacturingOrder,
  type ManufacturingRequirements,
  type OrderId,
  type PackageId,
  type Payout,
  type PayoutId,
  type PaymentId,
  type ProductionStage,
  type ProductionStageId,
  type ProductionStageKey,
  type Quote,
  type QuoteId,
  type RequirementsId,
  type Rfq,
  type RfqId,
  type RfqRecipient,
  type RfqRecipientId,
  type UserId,
  CANONICAL_STAGES,
  recordDomainEvent,
} from '@ideeza/domain';

export const now = asTimestamp('2026-05-17T10:00:00.000Z');

export const buyerId = asId<UserId>('user_buyer_1');
export const manufacturerA = asId<ManufacturerId>('mfr_a');
export const manufacturerB = asId<ManufacturerId>('mfr_b');
export const rfqId = asId<RfqId>('rfq_1');
export const orderId = asId<OrderId>('order_1');
export const paymentId = asId<PaymentId>('pay_1');

export const requirements = (): ManufacturingRequirements => ({
  id: asId<RequirementsId>('req_1'),
  packageId: asId<PackageId>('pkg_1'),
  files: [],
  bom: [],
  quantity: 500,
  material: 'FR-4',
  manufacturingMethod: 'PCB fabrication + SMT assembly',
  tolerance: '+/-0.2mm',
  leadTimeDays: 18,
  shippingRequirement: 'Courier, tracked',
  assembly: 'smt',
  qualityCheckRequirement: 'Optical inspection, functional test',
  substitutionPolicy: 'with_approval',
});

export const address = {
  line1: '20/3, Sector 9',
  city: 'Dhaka',
  countryCode: 'BD',
} as const;

export const buildRfq = (overrides: Partial<Rfq> = {}): Rfq => ({
  id: rfqId,
  buyerId,
  packageId: asId<PackageId>('pkg_1'),
  requirementsId: asId<RequirementsId>('req_1'),
  requirementsSnapshot: requirements(),
  status: 'submitted',
  quantity: 500,
  volumeTiers: [],
  deliveryAddress: address,
  createdAt: now,
  ...overrides,
});

export const buildRecipient = (
  manufacturerId: ManufacturerId,
  overrides: Partial<RfqRecipient> = {},
): RfqRecipient => ({
  id: asId<RfqRecipientId>(`recipient_${manufacturerId}`),
  rfqId,
  manufacturerId,
  status: 'routed',
  ...overrides,
});

export const buildQuote = (overrides: Partial<Quote> = {}): Quote => ({
  id: asId<QuoteId>('quote_1'),
  rfqId,
  manufacturerId: manufacturerA,
  status: 'submitted',
  version: 1,
  quantity: 500,
  unitPrice: money(790, 'USD'),
  totalPrice: money(395000, 'USD'),
  shippingEstimate: money(2800, 'USD'),
  leadTimeDays: 24,
  materialProcessNotes: 'FR-4, ENIG finish, IPC Class 2',
  terms: 'Payment secured through the platform. Ex-works excluded.',
  attachments: [],
  expiresAt: asTimestamp('2026-05-31T10:00:00.000Z'),
  createdAt: now,
  ...overrides,
});

export const buildAcceptedSnapshot = (): AcceptedQuoteSnapshot => ({
  quoteId: asId<QuoteId>('quote_1'),
  quoteVersion: 1,
  manufacturerId: manufacturerA,
  quantity: 500,
  unitPrice: money(790, 'USD'),
  totalPrice: money(395000, 'USD'),
  leadTimeDays: 24,
  materialProcessNotes: 'FR-4, ENIG finish, IPC Class 2',
  terms: 'Payment secured through the platform.',
  requirements: requirements(),
  approvedSubstitutionIds: [],
  capturedAt: now,
  checksum: 'deadbeef',
});

export const buildOrder = (
  overrides: Partial<ManufacturingOrder> = {},
): ManufacturingOrder => ({
  id: orderId,
  rfqId,
  buyerId,
  manufacturerId: manufacturerA,
  status: 'awaiting_payment',
  acceptedQuote: buildAcceptedSnapshot(),
  deliveryAddress: address,
  createdAt: now,
  ...overrides,
});

export const buildStages = (
  completedThrough?: ProductionStageKey,
): readonly ProductionStage[] => {
  const completedPosition =
    completedThrough === undefined
      ? 0
      : (CANONICAL_STAGES.find((stage) => stage.key === completedThrough)?.position ?? 0);
  return CANONICAL_STAGES.map((stage) => ({
    id: asId<ProductionStageId>(`stage_${stage.key}`),
    orderId,
    key: stage.key,
    position: stage.position,
    status: stage.position <= completedPosition ? 'completed' : 'pending',
  }));
};

export const buildPayout = (overrides: Partial<Payout> = {}): Payout => ({
  id: asId<PayoutId>('payout_1'),
  orderId,
  paymentId,
  manufacturerId: manufacturerA,
  status: 'pending_release',
  orderAmount: money(395000, 'USD'),
  platformFee: money(19750, 'USD'),
  netAmount: money(375250, 'USD'),
  createdAt: now,
  ...overrides,
});

export const buildEvent = (
  kind: DomainEventKind,
  overrides: { readonly orderId?: string | undefined; readonly id?: string } = {},
): DomainEvent =>
  recordDomainEvent({
    id: asId<DomainEventId>(overrides.id ?? `event_${kind}`),
    kind,
    actor: { role: 'buyer', userId: buyerId },
    subject: { kind: 'order', id: orderId },
    orderId: overrides.orderId ?? orderId,
    occurredAt: now,
    payload: {},
  });
