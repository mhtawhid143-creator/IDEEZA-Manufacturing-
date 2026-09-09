'use client';

import { useRouter } from 'next/navigation';
import {
  counted,
  QUOTE_COST_LABEL,
  TRANSIT_DAYS,
  type QuoteCostKind,
} from '@ideeza/domain';
import { useEffect, useMemo, useState, useTransition } from 'react';
import {
  Alert,
  Button,
  Card,
  Checkbox,
  FormField,
  Input,
  Modal,
  Text,
  Textarea,
  useToast,
  majorAmount,
} from '@ideeza/ui';
import { reviseQuoteAction, submitQuoteAction } from '@/app/(app)/quotes/actions.js';
import { goTo } from '@/lib/navigate.js';

export interface QuoteFormOverview {
  /** What the buyer said they hope to pay, when they said anything. */
  readonly targetPriceMinor: number | null;
  readonly bomLineCount: number;
  readonly shortLineCount: number;
  readonly suggestionCount: number;
  readonly quantity: number;
  readonly currency: string;
  readonly volumeTiers: readonly number[];
  readonly neededByDays: number | null;
  /** The date the buyer said they need the units by, for reconciling against. */
  readonly neededByOn: string | null;
  /** The last day the buyer will take an answer on this request. */
  readonly respondByOn: string | null;
  /**
   * The cost lines this request can be priced with (UIUX-166).
   *
   * Decided by the domain from the package and whether assembly was asked for,
   * so a fabrication-only board is never offered a stencil line.
   */
  readonly costKinds: readonly QuoteCostKind[];
  /** When the requirements this quote answers were frozen (UIUX-171). */
  readonly specLockedOn: string | null;
}

export interface QuoteFormDefaults {
  /** Per cost kind, in major units — what a revision starts from. */
  readonly costLines: Readonly<Record<string, string>>;
  readonly deviations: readonly {
    readonly requirement: string;
    readonly capability: string;
  }[];
  readonly unitPriceMajor: string;
  readonly leadTimeDays: string;
  readonly expiresOn: string;
  readonly shippingMajor: string;
  readonly toolingMajor: string;
  readonly materialProcessNotes: string;
  readonly warrantyTerms: string;
  readonly terms: string;
  readonly volumePrices: Readonly<Record<string, string>>;
  readonly volumeLeadTimes: Readonly<Record<string, string>>;
}

export interface QuoteFormProps {
  /** Submitting a new quote for a request, or revising one already sent. */
  readonly mode: 'submit' | 'revise';
  readonly rfqId: string;
  readonly quoteId?: string;
  readonly overview: QuoteFormOverview;
  readonly defaults?: Partial<QuoteFormDefaults>;
  readonly trigger?: string;
}

const money = (minor: number): string => majorAmount(minor);

const minorOf = (major: string): number | null => {
  const text = major.trim();
  if (text === '') return null;
  const value = Number(text);
  if (!Number.isFinite(value)) return Number.NaN;
  return Math.round(value * 100);
};

const inDays = (days: number): string =>
  new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);

/**
 * The quote itself: what this shop will build it for, and on what terms.
 *
 * The overview above the form is the buyer's ask, so the two are read together —
 * their target, how many parts the bill of materials has, and how many of them
 * this shop is short of. A shortage with no substitute suggested is stated here
 * rather than blocked: sourcing the specified part yourself is a legitimate
 * answer, and the buyer is entitled to know which answer this is.
 *
 * The totals are shown as the domain computes them, from the unit price and the
 * quantity, so the figure here is the figure the buyer will compare.
 */
export const QuoteForm = ({
  mode,
  rfqId,
  quoteId,
  overview,
  defaults,
  trigger,
}: QuoteFormProps) => {
  const [open, setOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | undefined>(undefined);
  const router = useRouter();
  const { push } = useToast();

  const [unitPrice, setUnitPrice] = useState(defaults?.unitPriceMajor ?? '');
  const [leadTime, setLeadTime] = useState(defaults?.leadTimeDays ?? '');
  const [expiresOn, setExpiresOn] = useState(defaults?.expiresOn ?? inDays(21));
  const [shipping, setShipping] = useState(defaults?.shippingMajor ?? '');
  const [tooling, setTooling] = useState(defaults?.toolingMajor ?? '');
  const [notes, setNotes] = useState(defaults?.materialProcessNotes ?? '');
  const [warranty, setWarranty] = useState(defaults?.warrantyTerms ?? '');
  const [terms, setTerms] = useState(defaults?.terms ?? '');
  const [tierPrices, setTierPrices] = useState<Record<string, string>>(
    () => ({ ...(defaults?.volumePrices ?? {}) }),
  );
  const [tierLeadTimes, setTierLeadTimes] = useState<Record<string, string>>(
    () => ({ ...(defaults?.volumeLeadTimes ?? {}) }),
  );
  const [costs, setCosts] = useState<Record<string, string>>(
    () => ({ ...(defaults?.costLines ?? {}) }),
  );
  const [compliant, setCompliant] = useState(
    () => (defaults?.deviations ?? []).length === 0,
  );
  const [deviations, setDeviations] = useState<
    readonly { readonly requirement: string; readonly capability: string }[]
  >(() =>
    (defaults?.deviations ?? []).length === 0
      ? [{ requirement: '', capability: '' }]
      : [...(defaults?.deviations ?? [])],
  );
  const [acknowledged, setAcknowledged] = useState(false);

  useEffect(() => setHydrated(true), []);

  const unitMinor = minorOf(unitPrice);
  const totals = useMemo(() => {
    const unit = unitMinor === null || Number.isNaN(unitMinor) ? 0 : unitMinor;
    const goods = unit * overview.quantity;
    const extras =
      (minorOf(shipping) ?? 0) + (minorOf(tooling) ?? 0);
    return { goods, landed: goods + (Number.isNaN(extras) ? 0 : extras) };
  }, [unitMinor, overview.quantity, shipping, tooling]);

  /**
   * The breakdown's own total, so the shop can see it agree with the price
   * before the server refuses it (UIUX-166).
   */
  const itemised = useMemo(() => {
    const entries = overview.costKinds
      .map((kind) => ({ kind, minor: minorOf(costs[kind] ?? '') }))
      .filter((entry) => entry.minor !== null && !Number.isNaN(entry.minor));
    if (entries.length === 0) return null;
    return entries.reduce((sum, entry) => sum + (entry.minor ?? 0), 0);
  }, [costs, overview.costKinds]);

  const itemisedAgrees =
    itemised === null ||
    (unitMinor !== null && !Number.isNaN(unitMinor) && itemised === unitMinor);

  /**
   * The fields a quote cannot be sent without (UIUX-167).
   *
   * The binding step had weaker guards than the dialog before it: every field
   * was marked required and Submit was enabled regardless. This is the same
   * list the server refuses on, checked here so the shop is told before it
   * presses rather than after.
   */
  const missing = useMemo(() => {
    const gaps: string[] = [];
    if (unitPrice.trim() === '') gaps.push('a unit price');
    if (leadTime.trim() === '') gaps.push('a lead time');
    if (expiresOn.trim() === '') gaps.push('a date the quote is valid until');
    if (notes.trim() === '') gaps.push('what the price is for');
    if (terms.trim() === '') gaps.push('your terms');
    if (!itemisedAgrees) gaps.push('a breakdown that adds up to the unit price');
    // UIUX-171: a shop quoting with deviations has to say what they are.
    if (
      !compliant &&
      !deviations.some(
        (entry) => entry.requirement.trim() !== '' && entry.capability.trim() !== '',
      )
    ) {
      gaps.push('at least one deviation, with what you can do instead');
    }
    // UIUX-170: the binding step is a deliberate act.
    if (!acknowledged) gaps.push('your confirmation that this quote is binding');
    return gaps;
  }, [
    unitPrice,
    leadTime,
    expiresOn,
    notes,
    terms,
    itemisedAgrees,
    compliant,
    deviations,
    acknowledged,
  ]);

  /**
   * When the buyer would actually receive the units (UIUX-169).
   *
   * The quoted lead time is production time and nothing else — the courier is
   * the buyer's choice at checkout and the platform owns the transit numbers —
   * so the shop is shown what the buyer will read rather than being asked to
   * fold delivery into one figure.
   */
  const delivery = useMemo(() => {
    const days = Number(leadTime.trim());
    if (leadTime.trim() === '' || !Number.isFinite(days) || days <= 0) return null;
    return {
      standard: days + TRANSIT_DAYS.standard,
      express: days + TRANSIT_DAYS.express,
    };
  }, [leadTime]);

  /**
   * Where the shop's own dates disagree with the buyer's (UIUX-168).
   *
   * A warning and not a block: a shop is allowed to answer "I can make this,
   * but later than you asked" — that is a real answer and the buyer decides on
   * it. What is not allowed is the shop not being told.
   */
  const clash = useMemo(() => {
    const notes: string[] = [];
    const days = Number(leadTime.trim());
    if (
      overview.neededByDays !== null &&
      Number.isFinite(days) &&
      days > 0 &&
      days + TRANSIT_DAYS.express > overview.neededByDays
    ) {
      notes.push(
        `Made in ${counted(days, 'day')} and shipped express, this arrives after the ${
          overview.neededByOn ?? 'date the buyer wants it'
        } they asked for.`,
      );
    }
    if (
      overview.respondByOn !== null &&
      expiresOn.trim() !== '' &&
      expiresOn < overview.respondByOn
    ) {
      notes.push(
        `Your quote expires on ${expiresOn}, before the buyer's own reply-by date of ${overview.respondByOn}. They may not have decided by then.`,
      );
    }
    return notes;
  }, [leadTime, expiresOn, overview.neededByDays, overview.neededByOn, overview.respondByOn]);

  const submit = (): void => {
    setError(undefined);
    const payload = {
      rfqId,
      quoteId,
      unitPriceMajor: unitPrice,
      leadTimeDays: leadTime,
      expiresOn,
      shippingMajor: shipping,
      toolingMajor: tooling,
      materialProcessNotes: notes,
      warrantyTerms: warranty,
      terms,
      costLines: overview.costKinds
        .filter((kind) => (costs[kind] ?? '').trim() !== '')
        .map((kind) => ({ kind, amountMajor: costs[kind] ?? '' })),
      deviations: compliant
        ? []
        : deviations.filter(
            (entry) => entry.requirement.trim() !== '' || entry.capability.trim() !== '',
          ),
      volumePrices: overview.volumeTiers.map((tier) => ({
        quantity: tier,
        unitPriceMajor: tierPrices[String(tier)] ?? '',
        leadTimeDays: tierLeadTimes[String(tier)] ?? '',
      })),
    };

    startTransition(async () => {
      const result =
        mode === 'submit'
          ? await submitQuoteAction(payload)
          : await reviseQuoteAction(payload);

      if (result.quoteId === undefined) {
        setError(result.error ?? 'That quote was not sent.');
        return;
      }
      setOpen(false);
      push({
        title: mode === 'submit' ? 'Quote sent' : 'Quote revised',
        body:
          mode === 'submit'
            ? 'The buyer can read it now and compare it with the others.'
            : 'The buyer sees the new terms; the old ones are kept on the record.',
        tone: 'success',
      });
      goTo(router, `/quotes/${result.quoteId}`);
    });
  };

  return (
    <>
      <Button
        variant="primary"
        className="w-full justify-center"
        onClick={() => setOpen(true)}
      >
        {trigger ?? (mode === 'submit' ? 'Submit quote' : 'Revise quote')}
      </Button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={mode === 'submit' ? 'Submit quote' : 'Revise quote'}
        description={
          mode === 'submit'
            ? 'What you will build it for, and the terms the order would be opened against.'
            : 'The terms on the table now are kept on the record, and the buyer reads the new ones.'
        }
        size="lg"
        footer={
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              loading={pending || !hydrated}
              disabled={!hydrated || missing.length > 0}
              onClick={submit}
            >
              {mode === 'submit' ? 'Submit' : 'Send the revision'}
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          <Card className="bg-bg-page">
            <p className="text-sm font-semibold text-text-primary">Request overview</p>
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                {
                  label: 'Buyer’s target',
                  value:
                    overview.targetPriceMinor === null
                      ? 'None given'
                      : `${overview.currency} ${money(overview.targetPriceMinor)}`,
                },
                // Each tile's number carries its unit, formed the same way
                // (UIUX-165) — a bare count beside three that name what they
                // count reads as a different kind of figure.
                { label: 'Units asked for', value: counted(overview.quantity, 'unit') },
                { label: 'BOM lines', value: counted(overview.bomLineCount, 'line') },
                {
                  label: 'Not covered by your stock',
                  value: `${counted(overview.shortLineCount, 'line')} · ${
                    overview.suggestionCount
                  } answered`,
                },
              ].map((tile) => (
                <div key={tile.label} className="rounded-lg border border-border-subtle bg-bg-surface p-3">
                  <Text tone="muted" size="xs" className="block">
                    {tile.label}
                  </Text>
                  <p className="mt-0.5 text-sm font-semibold text-text-primary">{tile.value}</p>
                </div>
              ))}
            </div>
          </Card>

          {overview.shortLineCount > overview.suggestionCount && (
            <Alert tone="warning" title="Some parts are not covered by your stock">
              {overview.shortLineCount - overview.suggestionCount} of them have no
              substitute suggested. Sending this quote means you will source them as
              specified — if you cannot, suggest a substitute on the BOM tab first, or
              decline the request.
            </Alert>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label={`Unit price (${overview.currency})`} required>
              <Input
                name="unitPrice"
                inputMode="decimal"
                placeholder="0.00"
                value={unitPrice}
                onChange={(event) => setUnitPrice(event.target.value)}
              />
            </FormField>
            <FormField
              label="Quantity"
              hint="From the request. A quote answers the volume that was asked for."
            >
              <Input name="quantity" value={String(overview.quantity)} readOnly disabled />
            </FormField>
            {/*
              Both date fields now name the buyer's own window rather than
              leaving the shop to find it in the sidebar and do the arithmetic
              (UIUX-168). The lead time is production time only; transit is
              added below, because the courier is the buyer's choice.
            */}
            <FormField
              label="Lead time (days)"
              required
              hint={
                overview.neededByDays === null
                  ? 'Days to make them, not counting delivery.'
                  : `Days to make them, not counting delivery. The buyer wants them in ${counted(
                      overview.neededByDays,
                      'day',
                    )}.`
              }
            >
              <Input
                name="leadTime"
                inputMode="numeric"
                placeholder={overview.neededByDays === null ? '14' : '14'}
                value={leadTime}
                onChange={(event) => setLeadTime(event.target.value)}
              />
            </FormField>
            <FormField
              label="Quote valid until"
              required
              hint={
                overview.respondByOn === null
                  ? 'How long you will hold this price.'
                  : `How long you will hold this price. The buyer replies by ${overview.respondByOn}.`
              }
            >
              <Input
                name="expiresOn"
                type="date"
                value={expiresOn}
                onChange={(event) => setExpiresOn(event.target.value)}
              />
            </FormField>
            <FormField
              label={`Shipping estimate (${overview.currency})`}
              hint="Optional. The buyer chooses a shipping speed at checkout."
            >
              <Input
                name="shipping"
                inputMode="decimal"
                placeholder="0.00"
                value={shipping}
                onChange={(event) => setShipping(event.target.value)}
              />
            </FormField>
            <FormField
              label={`Tooling and setup (${overview.currency})`}
              hint="Optional. One-off costs, charged once on the order."
            >
              <Input
                name="tooling"
                inputMode="decimal"
                placeholder="0.00"
                value={tooling}
                onChange={(event) => setTooling(event.target.value)}
              />
            </FormField>
          </div>

          <FormField
            label="Materials and process"
            required
            hint="What the price is for. The buyer compares quotes on this, and the order freezes it."
          >
            <Textarea
              name="notes"
              rows={3}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
            />
          </FormField>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField
              label="Payment and delivery terms"
              required
              hint="The order is opened against these."
            >
              <Textarea
                name="terms"
                rows={2}
                value={terms}
                onChange={(event) => setTerms(event.target.value)}
              />
            </FormField>
            <FormField label="Warranty" hint="Optional.">
              <Textarea
                name="warranty"
                rows={2}
                value={warranty}
                onChange={(event) => setWarranty(event.target.value)}
              />
            </FormField>
          </div>

          {/*
            What the unit price is made of (UIUX-166).
            Only the lines this kind of work can carry are offered — the domain
            decides which, from the package and whether assembly was asked for —
            because a stencil line on a fabrication-only board invites a number
            that means nothing. Optional as a whole: a shop that prices in its
            head still has a valid quote, just an unexplained one.
          */}
          {overview.costKinds.length > 0 && (
            <Card className="bg-bg-page">
              <p className="text-sm font-semibold text-text-primary">
                What one unit&rsquo;s price is made of
              </p>
              <Text tone="muted" size="xs" className="mt-0.5 block">
                Optional, and the buyer reads it beside your price. If you fill any of
                it in, the lines have to add up to the unit price above — that is the
                number the buyer pays, so it cannot have two values.
              </Text>
              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                {overview.costKinds.map((kind) => (
                  <FormField
                    key={kind}
                    label={`${QUOTE_COST_LABEL[kind]} (${overview.currency})`}
                  >
                    <Input
                      inputMode="decimal"
                      placeholder="0.00"
                      aria-label={`${QUOTE_COST_LABEL[kind]} per unit`}
                      value={costs[kind] ?? ''}
                      onChange={(event) =>
                        setCosts((current) => ({ ...current, [kind]: event.target.value }))
                      }
                    />
                  </FormField>
                ))}
              </div>
              {itemised !== null && (
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border-subtle pt-3">
                  <Text size="xs" className="font-semibold text-text-primary">
                    The lines add up to {overview.currency} {money(itemised)}
                  </Text>
                  <Text tone={itemisedAgrees ? 'muted' : 'danger'} size="xs">
                    {itemisedAgrees
                      ? 'Which is the unit price. Good.'
                      : `The unit price above says ${overview.currency} ${money(
                          unitMinor === null || Number.isNaN(unitMinor) ? 0 : unitMinor,
                        )}. One of the two needs to change.`}
                  </Text>
                </div>
              )}
            </Card>
          )}

          {/*
            Whether this shop can actually meet the frozen specification
            (UIUX-171). A capability gap found after the award is a delivery
            failure with the buyer's money already secured against it, so the
            declaration belongs here, where the buyer can still choose someone
            else.
          */}
          <Card className="bg-bg-page">
            <p className="text-sm font-semibold text-text-primary">
              The specification you are quoting against
            </p>
            <Text tone="muted" size="xs" className="mt-0.5 block">
              {overview.specLockedOn === null
                ? 'The buyer has not frozen their requirements yet, so they can still change under you.'
                : `Frozen on ${overview.specLockedOn}. Your quote records that date, so if the buyer reopens and changes their requirements it will be clear you priced the earlier ask.`}
            </Text>
            <div className="mt-3 flex flex-col gap-2">
              <Checkbox
                label="I can meet the specification as written"
                checked={compliant}
                onChange={(event) => setCompliant(event.target.checked)}
              />
              {!compliant && (
                <div className="flex flex-col gap-3">
                  <Text tone="muted" size="xs">
                    Name each requirement you cannot meet and what you can do instead.
                    The buyer decides on this before awarding, which is the point of
                    saying it now.
                  </Text>
                  {deviations.map((entry, index) => (
                    <div
                      key={`deviation-${String(index)}`}
                      className="grid grid-cols-1 gap-3 sm:grid-cols-2"
                    >
                      <FormField label={`Requirement ${index + 1}`} labelHidden>
                        <Input
                          placeholder="The requirement you cannot meet"
                          aria-label={`Requirement you cannot meet ${index + 1}`}
                          value={entry.requirement}
                          onChange={(event) =>
                            setDeviations((current) =>
                              current.map((row, at) =>
                                at === index
                                  ? { ...row, requirement: event.target.value }
                                  : row,
                              ),
                            )
                          }
                        />
                      </FormField>
                      <FormField label={`What you can do ${index + 1}`} labelHidden>
                        <Input
                          placeholder="What you can do instead"
                          aria-label={`What you can do instead ${index + 1}`}
                          value={entry.capability}
                          onChange={(event) =>
                            setDeviations((current) =>
                              current.map((row, at) =>
                                at === index
                                  ? { ...row, capability: event.target.value }
                                  : row,
                              ),
                            )
                          }
                        />
                      </FormField>
                    </div>
                  ))}
                  <div>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() =>
                        setDeviations((current) => [
                          ...current,
                          { requirement: '', capability: '' },
                        ])
                      }
                    >
                      Add another deviation
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </Card>

          {overview.volumeTiers.length > 0 && (
            <Card className="bg-bg-page">
              <p className="text-sm font-semibold text-text-primary">
                The other volumes this request asked about
              </p>
              <Text tone="muted" size="xs" className="mt-0.5 block">
                Optional, and the buyer reads them beside your main price. Leave a
                volume blank if you would rather not price it.
              </Text>
              <div className="mt-3 flex flex-col gap-3">
                {overview.volumeTiers.map((tier) => (
                  <div key={tier} className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div className="flex items-center text-sm font-medium text-text-primary">
                      {tier} units
                    </div>
                    <FormField label={`Unit price at ${counted(tier, 'unit')}`} labelHidden>
                      <Input
                        inputMode="decimal"
                        placeholder={`Unit price (${overview.currency})`}
                        aria-label={`Unit price at ${counted(tier, 'unit')}`}
                        value={tierPrices[String(tier)] ?? ''}
                        onChange={(event) =>
                          setTierPrices((current) => ({
                            ...current,
                            [String(tier)]: event.target.value,
                          }))
                        }
                      />
                    </FormField>
                    <FormField label={`Lead time at ${counted(tier, 'unit')}`} labelHidden>
                      <Input
                        inputMode="numeric"
                        placeholder="Lead time (days)"
                        aria-label={`Lead time at ${counted(tier, 'unit')}`}
                        value={tierLeadTimes[String(tier)] ?? ''}
                        onChange={(event) =>
                          setTierLeadTimes((current) => ({
                            ...current,
                            [String(tier)]: event.target.value,
                          }))
                        }
                      />
                    </FormField>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/*
            What the buyer will read, and where every figure in it came from
            (UIUX-164). This block had no header and no stated relationship to
            the fields above it, so a shop could not tell whether it was a live
            calculation or a number from somewhere else. It is a calculation,
            and it now says so — and the two lines that separate the subtotal
            from the grand total are shown rather than left to be guessed at.
          */}
          <Card>
            <p className="text-sm font-semibold text-text-primary">
              What the buyer will see
            </p>
            <Text tone="muted" size="xs" className="mb-3 mt-0.5 block">
              Worked out from your unit price and the {overview.quantity} units the
              request asked for. Nothing here is typed in twice.
            </Text>
            <dl className="flex flex-col gap-2">
              {[
                {
                  label: 'Unit price',
                  value:
                    unitMinor === null || Number.isNaN(unitMinor)
                      ? '—'
                      : `${overview.currency} ${money(unitMinor)}`,
                },
                { label: 'Quantity', value: counted(overview.quantity, 'unit') },
                {
                  label: 'Subtotal',
                  value: `${overview.currency} ${money(totals.goods)}`,
                },
                {
                  label: 'Shipping estimate',
                  value:
                    (minorOf(shipping) ?? 0) === 0
                      ? 'Not quoted'
                      : `${overview.currency} ${money(minorOf(shipping) ?? 0)}`,
                },
                {
                  label: 'Tooling and setup',
                  value:
                    (minorOf(tooling) ?? 0) === 0
                      ? 'None'
                      : `${overview.currency} ${money(minorOf(tooling) ?? 0)}`,
                },
              ].map((row) => (
                <div key={row.label} className="flex items-center justify-between gap-4">
                  <dt className="text-sm text-text-tertiary">{row.label}</dt>
                  <dd className="text-sm font-medium text-text-primary">{row.value}</dd>
                </div>
              ))}
              <div className="flex items-center justify-between gap-4 border-t border-border-subtle pt-2">
                <dt className="text-sm font-semibold text-text-primary">
                  Grand total
                  <span className="ml-1 font-normal text-text-tertiary">
                    (subtotal plus the two lines above)
                  </span>
                </dt>
                <dd className="text-base font-bold text-text-primary">
                  {overview.currency} {money(totals.landed)}
                </dd>
              </div>
            </dl>
            {delivery !== null && (
              <div className="mt-3 border-t border-border-subtle pt-3">
                <Text size="xs" className="block font-semibold text-text-primary">
                  When they would have them
                </Text>
                <Text tone="muted" size="xs" className="mt-0.5 block">
                  {counted(delivery.express, 'day')} by express,{' '}
                  {counted(delivery.standard, 'day')} by standard post, counted from the
                  day the payment is secured. Your lead time is the making; the courier
                  is the buyer&rsquo;s choice at checkout and the platform adds the
                  transit.
                </Text>
              </div>
            )}
            <Text tone="muted" size="xs" className="mt-2 block">
              The platform fee and the buyer&rsquo;s shipping choice are added at
              checkout and are not yours to quote.
            </Text>
          </Card>

          {clash.length > 0 && (
            <Alert tone="warning" title="Your dates and the buyer’s do not line up">
              {clash.map((line) => (
                <span key={line} className="mt-1 block">
                  {line}
                </span>
              ))}
              <span className="mt-1 block">
                You can still send this. The buyer decides whether it works for them —
                but they decide on what you wrote, so say it in your terms if it
                matters.
              </span>
            </Alert>
          )}

          {/*
            One deliberate act at the end (UIUX-170). This is the step that
            makes a price binding for the validity period above it, and it had
            less friction than the substitute dialog before it.
          */}
          <Checkbox
            label="This quote is accurate, and I will hold it until the date above"
            description="A quote the buyer accepts becomes the terms of the order. Nothing here can be changed after they accept it."
            checked={acknowledged}
            onChange={(event) => setAcknowledged(event.target.checked)}
          />

          {missing.length > 0 && (
            <Text tone="muted" size="sm">
              Still needed before this can be sent: {missing.join(', ')}.
            </Text>
          )}

          {error !== undefined && (
            <Text tone="danger" size="sm">
              {error}
            </Text>
          )}
        </div>
      </Modal>
    </>
  );
};
