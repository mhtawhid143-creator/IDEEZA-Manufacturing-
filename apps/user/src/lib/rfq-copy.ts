import type {
  AssemblyMode,
  AssemblySides,
  FitVerdict,
  PackageKind,
  QuotedService,
  RfqRecipientStatus,
} from '@ideeza/domain';

/**
 * The words the request flow uses, in one place.
 *
 * The labels follow the design file. Three of its strings are typos — "Bear
 * board", "Parts Scouring" and "Meets Board Spece" — and are spelled correctly
 * here, because a quote request is a commercial document.
 */
export const SERVICE_COPY: Readonly<
  Record<QuotedService, { readonly label: string; readonly hint: string }>
> = Object.freeze({
  pcb_fabrication: { label: 'PCB Fabrication', hint: 'Bare board manufacturing' },
  parts_sourcing: { label: 'Parts sourcing', hint: 'Manufacturer buys the components' },
  pcb_assembly: { label: 'PCB Assembly (PCBA)', hint: 'Populate the board with parts' },
  enclosure_3d: { label: '3D printing / enclosure', hint: 'Box build, case, mechanical parts' },
  stencil: { label: 'Stencil', hint: 'Solder paste stencil' },
  testing: { label: 'Testing', hint: 'AOI, X-ray, functional test' },
});

/** The order the request screen offers the services in, as in the design. */
export const SERVICE_ORDER: readonly QuotedService[] = Object.freeze([
  'pcb_fabrication',
  'parts_sourcing',
  'pcb_assembly',
  'enclosure_3d',
  'stencil',
  'testing',
]);

export const ASSEMBLY_COPY: Readonly<Record<AssemblyMode, string>> = Object.freeze({
  none: 'No assembly',
  smt: 'SMT',
  through_hole: 'Through-hole (THT)',
  mixed: 'Mixed',
});

export const SIDES_COPY: Readonly<Record<AssemblySides, string>> = Object.freeze({
  single_side: 'Single-side',
  double_side: 'Double-side',
});

export const PACKAGE_COPY: Readonly<Record<PackageKind, string>> = Object.freeze({
  pcb: 'PCB only',
  module_3d: '3D module',
  full_product: 'Full product',
});

export const FIT_COPY: Readonly<
  Record<FitVerdict, { readonly label: string; readonly tone: 'success' | 'warning' | 'danger' }>
> = Object.freeze({
  meets: { label: 'Meets board spec', tone: 'success' },
  partial: { label: 'Partial fit', tone: 'warning' },
  cannot: { label: 'Can’t build this', tone: 'danger' },
});

/** What each recipient's routing state means to the buyer. */
export const RECIPIENT_COPY: Readonly<
  Record<RfqRecipientStatus, { readonly label: string; readonly note: string }>
> = Object.freeze({
  routed: { label: 'Pending', note: 'Awaiting a quote' },
  viewed: { label: 'Pending', note: 'Opened, awaiting a quote' },
  quoted: { label: 'Quote received', note: 'A quote is waiting for you' },
  declined: { label: 'Declined', note: 'This manufacturer will not quote' },
  expired: { label: 'Expired', note: 'The response deadline passed' },
});

export const SERVICE_LIST = (services: readonly QuotedService[]): string =>
  services.length === 0
    ? '—'
    : services.map((service) => SERVICE_COPY[service].label).join(', ');

/** The manufacturer selection carried between the steps of the flow. */
export const parseSelection = (value: string | string[] | undefined): readonly string[] => {
  const raw = typeof value === 'string' ? value : '';
  return raw
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part !== '');
};

export const serialiseSelection = (ids: readonly string[]): string => ids.join(',');

export const selectHref = (draftId: string): string =>
  `/manufacturing/rfq/new?draft=${encodeURIComponent(draftId)}`;

export const compareHref = (draftId: string, ids: readonly string[]): string =>
  `/manufacturing/rfq/new/compare?draft=${encodeURIComponent(draftId)}&m=${encodeURIComponent(serialiseSelection(ids))}`;

export const requestHref = (draftId: string, ids: readonly string[]): string =>
  `/manufacturing/rfq/new/request?draft=${encodeURIComponent(draftId)}&m=${encodeURIComponent(serialiseSelection(ids))}`;
