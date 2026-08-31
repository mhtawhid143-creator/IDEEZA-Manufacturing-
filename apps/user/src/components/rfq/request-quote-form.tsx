'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useActionState, useEffect, useMemo, useState } from 'react';
import { Alert, Badge, Button, buttonAppearance, Card, cn, FormField, Icon, IconButton, Input, Tag, Text, Textarea } from '@ideeza/ui';
import {
  ASSEMBLY_COPY,
  SERVICE_COPY,
  SERVICE_ORDER,
  SIDES_COPY,
  selectHref,
} from '@/lib/rfq-copy.js';
import { sendRequestAction, type SendRequestState } from '@/app/(app)/manufacturing/rfq/actions.js';
import {
  ASSEMBLY_MODES,
  ASSEMBLY_SIDES,
  MAX_RFQ_RECIPIENTS,
  servicesForKind,
} from '@ideeza/domain';
import type { AssemblyMode, AssemblySides, QuotedService } from '@ideeza/domain';
import { goTo } from '@/lib/navigate.js';

export interface RequestRecipient {
  readonly id: string;
  readonly displayName: string;
  readonly city: string;
  readonly countryCode: string;
  readonly rating: number | null;
  readonly fitVerdict: 'meets' | 'partial' | 'cannot';
  readonly missingServices: readonly QuotedService[];
}

export interface RequestQuoteFormProps {
  readonly draftId: string;
  readonly productName: string;
  /** What is in the package, which decides what can be quoted. */
  readonly packageKind: 'pcb' | 'module_3d' | 'full_product';
  readonly packageLabel: string;
  readonly specChips: readonly string[];
  readonly fileCount: number;
  readonly bomLineCount: number;
  readonly quantity: number;
  readonly leadTimeDays: number;
  readonly currency: string;
  readonly assembly: AssemblyMode;
  readonly assemblySides: AssemblySides | null;
  readonly notes: string;
  readonly recipients: readonly RequestRecipient[];
  readonly deliveryAddress: {
    readonly line1: string;
    readonly line2: string;
    readonly city: string;
    readonly region: string;
    readonly postalCode: string;
    readonly countryCode: string;
  };
}

const SectionHeader = ({
  title,
  action,
}: {
  readonly title: string;
  readonly action?: React.ReactNode;
}) => (
  <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-bg-page px-4 py-3">
    <h3 className="text-sm font-semibold text-text-primary">{title}</h3>
    {action}
  </div>
);

const ReadyRow = ({ done, label }: { readonly done: boolean; readonly label: string }) => (
  <li className="flex items-center gap-2">
    <span
      aria-hidden
      className={cn(
        'inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-3xs font-bold text-text-on-brand',
        done ? 'bg-bg-success' : 'bg-bg-subtle',
      )}
    >
      {done ? '✓' : '!'}
    </span>
    <span className={cn('text-xs', done ? 'text-text-secondary' : 'text-text-tertiary')}>{label}</span>
  </li>
);

/**
 * The request itself: what to quote, who quotes it, how many, by when, and
 * anything else the manufacturer should know.
 *
 * The summary on the right is not decoration: it is the same state the submit
 * button reads, so what the buyer is told is what the server is sent.
 */
/** A stable hue per board, so its tile looks the same on every render. */
const hueOf = (seed: string): number => {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) % 360;
  }
  return hash;
};

export const RequestQuoteForm = ({
  draftId,
  productName,
  packageKind,
  packageLabel,
  specChips,
  fileCount,
  bomLineCount,
  quantity: initialQuantity,
  leadTimeDays,
  currency,
  assembly: initialAssembly,
  assemblySides: initialSides,
  notes: initialNotes,
  recipients: initialRecipients,
  deliveryAddress,
}: RequestQuoteFormProps) => {
  const router = useRouter();
  // The action's outcome is applied on the client, so the button waits for the
  // client to exist. Without this, a click during hydration would run the
  // action and leave the page where it was.
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  const [state, action, pending] = useActionState<SendRequestState, FormData>(
    sendRequestAction,
    {},
  );
  const boardHue = hueOf(productName);

  // What can be asked for at all depends on what is in the package: a printed
  // part cannot be fabricated as a board, so the default follows the package
  // rather than assuming there is a board in it.
  const allowedServices = servicesForKind(packageKind);
  const [services, setServices] = useState<readonly QuotedService[]>(() => {
    const initial: QuotedService[] = [];
    if (allowedServices.includes('pcb_fabrication')) initial.push('pcb_fabrication');
    if (allowedServices.includes('enclosure_3d')) initial.push('enclosure_3d');
    if (initialAssembly !== 'none' && allowedServices.includes('pcb_assembly')) {
      initial.push('pcb_assembly');
    }
    return initial;
  });
  const [assembly, setAssembly] = useState<AssemblyMode>(initialAssembly);
  const [sides, setSides] = useState<AssemblySides | null>(initialSides);
  const [recipients, setRecipients] = useState<readonly RequestRecipient[]>(initialRecipients);
  const [quantity, setQuantity] = useState(initialQuantity);
  const [tiers, setTiers] = useState<readonly number[]>([]);

  useEffect(() => {
    if (state.redirectTo !== undefined) goTo(router, state.redirectTo);
  }, [state.redirectTo, router]);

  const toggleService = (service: QuotedService): void => {
    setServices((current) =>
      current.includes(service)
        ? current.filter((entry) => entry !== service)
        : [...current, service],
    );
  };

  const removeRecipient = (id: string): void => {
    setRecipients((current) => current.filter((recipient) => recipient.id !== id));
  };

  const missingFor = useMemo(
    () =>
      recipients.map((recipient) => ({
        recipient,
        missing: services.filter(
          (service) => recipient.missingServices.includes(service),
        ),
      })),
    [recipients, services],
  );

  const ready =
    services.length > 0 && recipients.length > 0 && quantity > 0 && fileCount > 0;

  return (
    <form action={action} className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
      <input type="hidden" name="rfqId" value={draftId} />
      {services.map((service) => (
        <input key={service} type="hidden" name="requestedServices" value={service} />
      ))}
      {recipients.map((recipient) => (
        <input key={recipient.id} type="hidden" name="manufacturerIds" value={recipient.id} />
      ))}
      <input type="hidden" name="quantity" value={quantity} />
      <input type="hidden" name="volumeTiers" value={tiers.join(',')} />
      <input type="hidden" name="assembly" value={assembly} />
      {sides !== null && <input type="hidden" name="assemblySides" value={sides} />}
      <input type="hidden" name="line1" value={deliveryAddress.line1} />
      <input type="hidden" name="line2" value={deliveryAddress.line2} />
      <input type="hidden" name="city" value={deliveryAddress.city} />
      <input type="hidden" name="region" value={deliveryAddress.region} />
      <input type="hidden" name="postalCode" value={deliveryAddress.postalCode} />
      <input type="hidden" name="countryCode" value={deliveryAddress.countryCode} />

      {/* ------------------------------------------------------------ left */}
      <div className="flex min-w-0 flex-col gap-5">
        {state.error !== undefined && (
          <Alert tone="danger" title="This request was not sent">
            {state.error}
          </Alert>
        )}

        <Card className="flex flex-col gap-3">
          <h3 className="text-sm font-semibold text-text-primary">
            What the manufacturer will receive
          </h3>
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border-subtle p-3">
            <div className="flex min-w-0 items-center gap-3">
              <span
                aria-hidden
                className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg border border-border-subtle"
                style={{
                  // eslint-disable-next-line ideeza/design-tokens -- placeholder artwork generated from the board's own hue, not a colour of the interface
                  background: `linear-gradient(135deg, hsl(${boardHue} 45% 74%), hsl(${(boardHue + 40) % 360} 50% 58%))`,
                }}
              >
                <Icon name="board" size={24} className="opacity-overlay" />
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-text-primary">{productName}</p>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  <Tag tone="brand">{packageLabel}</Tag>
                  {specChips.map((chip) => (
                    <Tag key={chip} tone="brand">
                      {chip}
                    </Tag>
                  ))}
                </div>
              </div>
            </div>
            <Badge tone="brand">
              {fileCount} {fileCount === 1 ? 'file' : 'files'}
            </Badge>
          </div>
          <Text tone="muted" size="xs">
            {bomLineCount === 0
              ? 'No bill of materials travels with this request.'
              : `${bomLineCount} bill of materials ${bomLineCount === 1 ? 'line' : 'lines'} travel with this request, priced for ${quantity} units.`}
          </Text>
        </Card>

        <div className="flex flex-col gap-3">
          <SectionHeader title="What you need quoted" />
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {SERVICE_ORDER.filter((service) => allowedServices.includes(service)).map(
              (service) => {
              const checked = services.includes(service);
              return (
                <label
                  key={service}
                  className={cn(
                    'flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition-colors',
                    checked ? 'border-border-brand bg-bg-brand-subtle' : 'border-border-subtle bg-bg-surface hover:bg-bg-surface-raised',
                  )}
                >
                  <input
                    type="checkbox"
                    className="mt-0.5 h-5 w-5 shrink-0 appearance-none rounded border-2 border-border bg-bg-surface transition-colors checked:border-border-brand checked:bg-bg-brand focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus"
                    checked={checked}
                    onChange={() => toggleService(service)}
                  />
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-text-primary">
                      {SERVICE_COPY[service].label}
                    </span>
                    <span className="block text-xs text-text-tertiary">{SERVICE_COPY[service].hint}</span>
                  </span>
                </label>
                );
              },
            )}
          </div>
          {services.length === 0 && (
            <Text tone="danger" size="xs">
              Choose at least one service to be quoted.
            </Text>
          )}

          <div className="flex flex-col gap-2 rounded-lg bg-bg-page p-4">
            <p className="text-3xs font-semibold uppercase tracking-caps text-text-tertiary">
              Assembly options
            </p>
            <div className="flex flex-wrap gap-2">
              {ASSEMBLY_MODES.map((mode) => (
                <button
                  key={mode}
                  type="button"
                  aria-pressed={assembly === mode}
                  onClick={() => setAssembly(mode)}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus',
                    assembly === mode
                      ? 'border-border-brand bg-bg-surface text-text-brand'
                      : 'border-border-subtle bg-bg-surface text-text-secondary hover:border-border-brand',
                  )}
                >
                  {assembly === mode && (
                    <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-bg-brand" />
                  )}
                  {ASSEMBLY_COPY[mode]}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              {ASSEMBLY_SIDES.map((side) => (
                <button
                  key={side}
                  type="button"
                  aria-pressed={sides === side}
                  onClick={() => setSides(sides === side ? null : side)}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus',
                    sides === side
                      ? 'border-border-brand bg-bg-surface text-text-brand'
                      : 'border-border-subtle bg-bg-surface text-text-secondary hover:border-border-brand',
                  )}
                >
                  {sides === side && (
                    <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-bg-brand" />
                  )}
                  {SIDES_COPY[side]}
                </button>
              ))}
            </div>
            {assembly === 'none' && services.includes('pcb_assembly') && (
              <Text tone="muted" size="xs">
                Assembly is switched off, so a manufacturer will read the assembly
                service as parts fitted by hand on request.
              </Text>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <SectionHeader
            title="Send to"
            action={
              <Link
                href={selectHref(draftId)}
                className={buttonAppearance({ variant: 'outline', size: 'xs' })}
              >
                Add another
              </Link>
            }
          />
          {recipients.length === 0 ? (
            <Alert tone="warning" title="No manufacturer selected">
              A request has to go to at least one manufacturer.{' '}
              <Link href={selectHref(draftId)} className="font-semibold underline">
                Choose one
              </Link>
              .
            </Alert>
          ) : (
            <ul aria-label="Selected manufacturers" className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {missingFor.map(({ recipient, missing }) => (
                <li
                  key={recipient.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-border-subtle bg-bg-surface p-3"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-bg-page text-sm font-semibold text-text-brand">
                      {recipient.displayName.slice(0, 2).toUpperCase()}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-text-primary">
                        {recipient.displayName}
                      </p>
                      <p className="truncate text-xs text-text-secondary">
                        {recipient.rating !== null && (
                          <span className="font-semibold text-text-brand">
                            ★ {recipient.rating.toFixed(1)}
                          </span>
                        )}
                        {recipient.rating !== null && ' · '}
                        {recipient.city}, {recipient.countryCode}
                      </p>
                      {missing.length > 0 && (
                        <p className="truncate text-xs text-text-warning">
                          Does not publish {missing.map((service) => SERVICE_COPY[service].label).join(', ')}
                        </p>
                      )}
                    </div>
                  </div>
                  <IconButton
                    label={`Remove ${recipient.displayName}`}
                    size="sm"
                    variant="ghost"
                    icon={<Icon name="close" />}
                    onClick={() => removeRecipient(recipient.id)}
                  />
                </li>
              ))}
            </ul>
          )}
          {recipients.length > MAX_RFQ_RECIPIENTS && (
            <Text tone="danger" size="xs">
              A request goes to at most {MAX_RFQ_RECIPIENTS} manufacturers.
            </Text>
          )}
        </div>

        <div className="flex flex-col gap-3">
          <SectionHeader
            title="Quantity and timeline"
            action={
              <Button
                variant="outline"
                size="xs"
                onClick={() => setTiers((current) => [...current, quantity * (current.length + 2)])}
              >
                Add volume
              </Button>
            }
          />
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <FormField label="Volume" required error={state.fieldErrors?.['quantity']}>
              <div className="flex items-center gap-0">
                <button
                  type="button"
                  aria-label="Fewer units"
                  onClick={() => setQuantity((current) => Math.max(1, current - 1))}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-l-md border border-border bg-bg-surface text-lg text-text-secondary hover:bg-bg-surface-raised focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus"
                >
                  −
                </button>
                <input
                  type="number"
                  min={1}
                  step={1}
                  aria-label="Volume"
                  className="h-10 w-full min-w-0 border-y border-border bg-bg-surface text-center text-sm text-text-primary focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus"
                  value={quantity}
                  onChange={(event) => setQuantity(Math.max(1, Number(event.target.value) || 1))}
                />
                <button
                  type="button"
                  aria-label="More units"
                  onClick={() => setQuantity((current) => current + 1)}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-r-md border border-border bg-bg-surface text-lg text-text-secondary hover:bg-bg-surface-raised focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus"
                >
                  +
                </button>
              </div>
            </FormField>
            <FormField
              label={`Targeted price per unit (${currency})`}
              hint="Optional. Manufacturers still quote their own price."
              error={state.fieldErrors?.['targetPriceMinor']}
            >
              <Input name="targetPrice" type="number" min={0} step="0.01" placeholder="eg: 100" />
            </FormField>
            <FormField
              label="Needed by"
              hint="Optional. When you need the units in hand."
              error={state.fieldErrors?.['neededBy']}
            >
              <Input name="neededBy" type="date" />
            </FormField>
          </div>
          {tiers.length > 0 && (
            <div className="flex flex-col gap-2 rounded-lg border border-border-subtle p-3">
              <p className="text-xs font-semibold text-text-primary">Also price these volumes</p>
              <ul className="flex flex-wrap gap-2">
                {tiers.map((tier, index) => (
                  <li key={`${tier}-${index}`} className="flex items-center gap-1">
                    <input
                      type="number"
                      min={1}
                      step={1}
                      aria-label={`Extra volume ${index + 1}`}
                      className="h-9 w-24 rounded-md border border-border bg-bg-surface px-2 text-sm text-text-primary focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus"
                      value={tier}
                      onChange={(event) =>
                        setTiers((current) =>
                          current.map((entry, position) =>
                            position === index ? Math.max(1, Number(event.target.value) || 1) : entry,
                          ),
                        )
                      }
                    />
                    <IconButton
                      label={`Remove extra volume ${index + 1}`}
                      size="sm"
                      variant="ghost"
                      icon={<Icon name="close" />}
                      onClick={() =>
                        setTiers((current) => current.filter((_entry, position) => position !== index))
                      }
                    />
                  </li>
                ))}
              </ul>
              {state.fieldErrors?.['volumeTiers'] !== undefined && (
                <Text tone="danger" size="xs">
                  {state.fieldErrors['volumeTiers']}
                </Text>
              )}
            </div>
          )}
          <FormField
            label="Quotes needed by"
            hint="Optional. After this date a manufacturer can no longer answer."
            error={state.fieldErrors?.['responseDeadline']}
            className="md:max-w-xs"
          >
            <Input name="responseDeadline" type="date" />
          </FormField>
        </div>

        <div className="flex flex-col gap-3">
          <SectionHeader title="Production requirement" />
          <FormField
            label="Anything else the manufacturer should know"
            hint="Optional. This travels with the locked requirements."
            error={state.fieldErrors?.['notes']}
            labelHidden
          >
            <Textarea
              name="notes"
              rows={4}
              defaultValue={initialNotes}
              placeholder="Write your message here..."
            />
          </FormField>
        </div>
      </div>

      {/* ----------------------------------------------------------- right */}
      <aside className="flex flex-col gap-4 lg:sticky lg:top-24 lg:self-start">
        <Card className="flex flex-col gap-4">
          <h3 className="text-sm font-semibold text-text-primary">Your request</h3>
          <dl className="flex flex-col gap-2 text-sm">
            {[
              { label: 'Board', value: productName },
              {
                label: 'Service',
                value:
                  services.length === 0
                    ? 'Nothing selected yet'
                    : services.map((service) => SERVICE_COPY[service].label).join(', '),
              },
              {
                label: 'Assembly',
                value: `${ASSEMBLY_COPY[assembly]}${sides === null ? '' : ` · ${SIDES_COPY[sides]}`}`,
              },
              {
                label: 'Recipients',
                value: `${recipients.length} ${recipients.length === 1 ? 'manufacturer' : 'manufacturers'}`,
              },
              {
                label: 'Volume',
                value: [quantity, ...tiers].join(', '),
              },
              { label: 'Lead time asked for', value: `${leadTimeDays} days` },
            ].map((row) => (
              <div key={row.label} className="flex items-start justify-between gap-4">
                <dt className="text-text-tertiary">{row.label}</dt>
                <dd className="text-right font-medium text-text-primary">{row.value}</dd>
              </div>
            ))}
          </dl>

          <div className="border-t border-border-subtle pt-3">
            <p className="text-3xs font-semibold uppercase tracking-caps text-text-tertiary">
              Ready to send
            </p>
            <ul className="mt-2 flex flex-col gap-1.5">
              <ReadyRow
                done={fileCount > 0}
                label={`${fileCount} ${fileCount === 1 ? 'file' : 'files'} attached`}
              />
              <ReadyRow done={quantity > 0} label="Board spec complete" />
              <ReadyRow
                done={services.length > 0}
                label={
                  services.length > 0
                    ? `${services.length} ${services.length === 1 ? 'service' : 'services'} to quote`
                    : 'Choose what to quote'
                }
              />
              <ReadyRow
                done={recipients.length > 0}
                label={
                  recipients.length > 0
                    ? `${recipients.length} ${recipients.length === 1 ? 'recipient' : 'recipients'} selected`
                    : 'Choose who receives it'
                }
              />
            </ul>
          </div>

          <Button
            type="submit"
            size="lg"
            fullWidth
            loading={pending || !hydrated}
            disabled={!ready || !hydrated}
          >
            Send quote request
          </Button>
          <Text tone="muted" size="xs">
            You can withdraw the request before a manufacturer responds. Accepting a
            quote later opens an order awaiting payment; the order is confirmed once
            the payment is secured.
          </Text>
        </Card>

        <Card tone="brand" className="flex flex-col gap-2">
          <p className="text-sm font-semibold text-text-primary">Delivering to</p>
          <Text size="sm">
            {deliveryAddress.line1}
            {deliveryAddress.line2 === '' ? '' : `, ${deliveryAddress.line2}`}
            <br />
            {deliveryAddress.city}
            {deliveryAddress.region === '' ? '' : `, ${deliveryAddress.region}`}{' '}
            {deliveryAddress.postalCode}
            <br />
            {deliveryAddress.countryCode}
          </Text>
          <Link
            href={`/manufacturing/draft/${draftId}`}
            className={buttonAppearance({ variant: 'secondary', size: 'xs', className: 'self-start' })}
          >
            Change in the draft
          </Link>
        </Card>
      </aside>
    </form>
  );
};
