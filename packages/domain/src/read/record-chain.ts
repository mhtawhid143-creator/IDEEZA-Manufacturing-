import { orderReference, projectReference, quoteReference, requestReference } from './resolution-document.js';

/**
 * The four records one piece of work passes through (UIUX-208).
 *
 * A buyer designs a **project**, asks for it to be made as a **request**, one
 * shop answers with a **quote**, and accepting it opens an **order**. They are
 * four rows in four tables, and the review found the chain broken in three
 * separate places — an order with no way back to its quote, a quote naming its
 * request by a bare number, a request that never said which project it came
 * from. Each read as its own copy defect; together they were one missing thing.
 *
 * Naming the stages here, once, is what stops the fourth break: a surface that
 * shows part of the chain has to say which part, and the type says what the
 * whole is.
 */
export const PIPELINE_STAGES = ['project', 'request', 'quote', 'order'] as const;

export type PipelineStage = (typeof PIPELINE_STAGES)[number];

export const PIPELINE_STAGE_LABEL: Readonly<Record<PipelineStage, string>> = Object.freeze({
  project: 'Project',
  request: 'Request',
  quote: 'Quote',
  order: 'Order',
});

export interface RecordChainInput {
  /** The buyer's design, which every later record descends from. */
  readonly projectId: string;
  readonly projectName: string;
  readonly rfqId: string;
  /** This shop's own quote, when it has written one. */
  readonly quoteId: string | null;
  /** The order that quote opened, when the buyer has accepted and paid. */
  readonly orderId: string | null;
}

export interface ChainLink {
  readonly stage: PipelineStage;
  readonly label: string;
  /** The stable, prefixed identifier — `PRJ-…`, `RFQ-…`, `QUOTE-…`, `ORDER-…`. */
  readonly reference: string;
  /** The record's own name, where it has one the reader would recognise. */
  readonly name: string | null;
}

/**
 * The chain as far as it has been built, oldest first.
 *
 * Only the records that exist appear: a request nobody has quoted has two
 * links, not four with two blanks. A blank would say the stage exists and is
 * empty, which is a different and untrue thing.
 *
 * Every reference is derived from the row's own id, so the same record is
 * quoted identically on the buyer's screens, the shop's, and in a support
 * conversation about either — which is the property the chain is for.
 */
export const recordChain = (input: RecordChainInput): readonly ChainLink[] => [
  {
    stage: 'project' as const,
    label: PIPELINE_STAGE_LABEL.project,
    reference: projectReference(input.projectId),
    name: input.projectName,
  },
  {
    stage: 'request' as const,
    label: PIPELINE_STAGE_LABEL.request,
    reference: requestReference(input.rfqId),
    name: null,
  },
  ...(input.quoteId === null
    ? []
    : [
        {
          stage: 'quote' as const,
          label: PIPELINE_STAGE_LABEL.quote,
          reference: quoteReference(input.quoteId),
          name: null,
        },
      ]),
  ...(input.orderId === null
    ? []
    : [
        {
          stage: 'order' as const,
          label: PIPELINE_STAGE_LABEL.order,
          reference: orderReference(input.orderId),
          name: null,
        },
      ]),
];

/**
 * How a request's files relate to the project they came from (UIUX-146).
 *
 * The review asked for this to be decided rather than left undefined, because
 * the undefined case is the expensive one: a shop quotes, the buyer keeps
 * editing, and neither side knows the drawing has moved. This platform freezes
 * it — the requirements carry a `lockedAt`, a quote records which frozen
 * version it answered, and an order carries a checksum of the terms — so the
 * answer is `frozen`, and `open` exists only for a request still being
 * prepared, which no shop can see.
 */
export type ProjectSync = 'frozen' | 'open';

export const projectSync = (lockedAt: Date | null): ProjectSync =>
  lockedAt === null ? 'open' : 'frozen';
