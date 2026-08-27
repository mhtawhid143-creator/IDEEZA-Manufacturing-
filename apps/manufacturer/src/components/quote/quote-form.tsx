'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState, useTransition } from 'react';
import {
  Alert,
  Button,
  Card,
  FormField,
  Input,
  Modal,
  Text,
  Textarea,
  useToast,
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
}

export interface QuoteFormDefaults {
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

const money = (minor: number): string => (minor / 100).toFixed(2);

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

  useEffect(() => setHydrated(true), []);

  const unitMinor = minorOf(unitPrice);
  const totals = useMemo(() => {
    const unit = unitMinor === null || Number.isNaN(unitMinor) ? 0 : unitMinor;
    const goods = unit * overview.quantity;
    const extras =
      (minorOf(shipping) ?? 0) + (minorOf(tooling) ?? 0);
    return { goods, landed: goods + (Number.isNaN(extras) ? 0 : extras) };
  }, [unitMinor, overview.quantity, shipping, tooling]);

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
        {trigger ?? (mode === 'submit' ? 'Submit Quote' : 'Revise Quote')}
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
              disabled={!hydrated}
              onClick={submit}
            >
              {mode === 'submit' ? 'Submit' : 'Send the revision'}
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          <Card className="bg-canvas">
            <p className="text-sm font-semibold text-heading">Request overview</p>
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                {
                  label: 'Buyer’s target',
                  value:
                    overview.targetPriceMinor === null
                      ? 'None given'
                      : `${overview.currency} ${money(overview.targetPriceMinor)}`,
                },
                { label: 'Units asked for', value: String(overview.quantity) },
                { label: 'BOM lines', value: String(overview.bomLineCount) },
                {
                  label: 'Not covered by your stock',
                  value: `${overview.shortLineCount} · ${overview.suggestionCount} answered`,
                },
              ].map((tile) => (
                <div key={tile.label} className="rounded-lg border border-line bg-surface p-3">
                  <Text tone="muted" size="xs" className="block">
                    {tile.label}
                  </Text>
                  <p className="mt-0.5 text-sm font-semibold text-heading">{tile.value}</p>
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
            <FormField label="Lead time (days)" required>
              <Input
                name="leadTime"
                inputMode="numeric"
                placeholder={
                  overview.neededByDays === null
                    ? '14'
                    : `${overview.neededByDays} days until the buyer needs it`
                }
                value={leadTime}
                onChange={(event) => setLeadTime(event.target.value)}
              />
            </FormField>
            <FormField label="Quote valid until" required>
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

          {overview.volumeTiers.length > 0 && (
            <Card className="bg-canvas">
              <p className="text-sm font-semibold text-heading">
                The other volumes this request asked about
              </p>
              <Text tone="muted" size="xs" className="mt-0.5 block">
                Optional, and the buyer reads them beside your main price. Leave a
                volume blank if you would rather not price it.
              </Text>
              <div className="mt-3 flex flex-col gap-3">
                {overview.volumeTiers.map((tier) => (
                  <div key={tier} className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div className="flex items-center text-sm font-medium text-heading">
                      {tier} units
                    </div>
                    <FormField label={`Unit price at ${tier} units`} labelHidden>
                      <Input
                        inputMode="decimal"
                        placeholder={`Unit price (${overview.currency})`}
                        aria-label={`Unit price at ${tier} units`}
                        value={tierPrices[String(tier)] ?? ''}
                        onChange={(event) =>
                          setTierPrices((current) => ({
                            ...current,
                            [String(tier)]: event.target.value,
                          }))
                        }
                      />
                    </FormField>
                    <FormField label={`Lead time at ${tier} units`} labelHidden>
                      <Input
                        inputMode="numeric"
                        placeholder="Lead time (days)"
                        aria-label={`Lead time at ${tier} units`}
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

          <Card>
            <dl className="flex flex-col gap-2">
              {[
                {
                  label: 'Unit price',
                  value:
                    unitMinor === null || Number.isNaN(unitMinor)
                      ? '—'
                      : `${overview.currency} ${money(unitMinor)}`,
                },
                { label: 'Quantity', value: `${overview.quantity} units` },
                {
                  label: 'Subtotal',
                  value: `${overview.currency} ${money(totals.goods)}`,
                },
              ].map((row) => (
                <div key={row.label} className="flex items-center justify-between gap-4">
                  <dt className="text-sm text-muted">{row.label}</dt>
                  <dd className="text-sm font-medium text-heading">{row.value}</dd>
                </div>
              ))}
              <div className="flex items-center justify-between gap-4 border-t border-line pt-2">
                <dt className="text-sm font-semibold text-heading">
                  Grand total
                  <span className="ml-1 font-normal text-muted">
                    (with shipping and tooling)
                  </span>
                </dt>
                <dd className="text-base font-bold text-heading">
                  {overview.currency} {money(totals.landed)}
                </dd>
              </div>
            </dl>
            <Text tone="muted" size="xs" className="mt-2 block">
              The platform fee and the buyer&rsquo;s shipping choice are added at
              checkout and are not yours to quote.
            </Text>
          </Card>

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
