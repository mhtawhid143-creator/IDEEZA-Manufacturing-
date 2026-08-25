/** The three actor kinds in the platform. */
export const ACTOR_ROLES = ['buyer', 'manufacturer', 'ops_admin'] as const;
export type ActorRole = (typeof ACTOR_ROLES)[number];

/** Message threads are always bound to a business object. */
export const MESSAGE_CONTEXT_KINDS = [
  'rfq',
  'quote',
  'order',
  'shipping',
  'dispute',
] as const;
export type MessageContextKind = (typeof MESSAGE_CONTEXT_KINDS)[number];

/** Evidence kinds required to decide a dispute on the documented record. */
export const EVIDENCE_KINDS = [
  'accepted_quote',
  'order_terms',
  'design_file',
  'bom_revision',
  'approved_substitution',
  'change_order',
  'quality_report',
  'measurement_data',
  'photo',
  'shipping_record',
  'delivery_record',
  'buyer_statement',
  'manufacturer_statement',
] as const;
export type EvidenceKind = (typeof EVIDENCE_KINDS)[number];
