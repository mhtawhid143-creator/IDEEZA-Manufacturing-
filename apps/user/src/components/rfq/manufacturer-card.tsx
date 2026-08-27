'use client';

import { Badge, Button, Card, Tag, Text, cn } from '@ideeza/ui';
import { FIT_COPY } from '@/lib/rfq-copy.js';
import type { FitVerdict } from '@ideeza/domain';

export interface ManufacturerCardData {
  readonly id: string;
  readonly displayName: string;
  readonly city: string;
  readonly countryCode: string;
  readonly rating: number | null;
  readonly onTimeDeliveryRate: number | null;
  readonly completedOrderCount: number;
  readonly verified: boolean;
  readonly services: readonly string[];
  readonly certifications: readonly string[];
  readonly servedRegions: readonly string[];
  readonly minimumOrderQuantity: number | null;
  readonly standardLeadTimeDays: number | null;
  readonly fitVerdict: FitVerdict;
  readonly fitReasons: readonly string[];
  /**
   * What this manufacturer already holds of the request's bill of materials.
   *
   * A count of the buyer's own lines and nothing else: no quantities, no costs,
   * no parts the request did not name.
   */
  readonly partsInStock: {
    readonly covered: number;
    readonly total: number;
  } | null;
}

export interface ManufacturerCardProps {
  readonly manufacturer: ManufacturerCardData;
  readonly selected: boolean;
  readonly onToggle: (id: string, selected: boolean) => void;
  readonly onDetails: (id: string) => void;
  readonly onRequestQuote: (id: string) => void;
  readonly disabledReason?: string | undefined;
}

const SERVICE_LABEL: Readonly<Record<string, string>> = {
  fabrication: 'Fabrication',
  assembly: 'Assembly',
  parts_sourcing: 'Parts sourcing',
  '3d_enclosure': '3D / Enclosure',
  testing: 'Testing',
};

const Stat = ({ label, value, tone }: { readonly label: string; readonly value: string; readonly tone?: 'success' }) => (
  <div className="flex flex-col gap-0.5">
    <span className="text-[10px] font-medium uppercase tracking-wide text-muted">{label}</span>
    <span
      className={cn(
        'text-[13px] font-semibold',
        tone === 'success' ? 'text-success' : 'text-body',
      )}
    >
      {value}
    </span>
  </div>
);

/**
 * One manufacturer, as the selection step shows it: who they are, whether they
 * fit this request, what they can do, and the numbers that decide it.
 *
 * A manufacturer that cannot build the request keeps its card and loses the
 * ability to be chosen, which is the same rule the server enforces.
 */
export const ManufacturerCard = ({
  manufacturer,
  selected,
  onToggle,
  onDetails,
  onRequestQuote,
  disabledReason,
}: ManufacturerCardProps) => {
  const fit = FIT_COPY[manufacturer.fitVerdict];
  const blocked = manufacturer.fitVerdict === 'cannot';
  const initials = manufacturer.displayName
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0] ?? '')
    .join('')
    .toUpperCase();

  return (
    <Card
      padded={false}
      selected={selected}
      className="flex w-full flex-col gap-3 p-4"
      data-testid={`manufacturer-card-${manufacturer.id}`}
    >
      <div className="flex items-center justify-between gap-3 rounded-xl border border-line px-4 py-3">
        <div className="flex min-w-0 items-center gap-3.5">
          <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-canvas text-lg font-semibold text-brand">
            {initials === '' ? 'M' : initials}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-heading">
              {manufacturer.displayName}
              {manufacturer.verified && (
                <Badge tone="success" className="ml-2 align-middle">
                  Verified
                </Badge>
              )}
            </p>
            <p className="truncate text-sm text-body">
              {manufacturer.rating !== null && (
                <span className="font-semibold text-brand">★ {manufacturer.rating.toFixed(1)}</span>
              )}
              {manufacturer.rating !== null && ' · '}
              {manufacturer.city}, {manufacturer.countryCode}
            </p>
          </div>
        </div>
        <label className="flex shrink-0 items-center gap-2">
          <span className="ids-sr-only">
            {blocked
              ? `${manufacturer.displayName} cannot build this request`
              : `Select ${manufacturer.displayName}`}
          </span>
          <input
            type="checkbox"
            className="peer h-6 w-6 shrink-0 appearance-none rounded-md border-2 border-line-input bg-surface transition-colors checked:border-brand checked:bg-brand hover:border-brand focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus disabled:cursor-not-allowed disabled:border-line-strong disabled:bg-disabled-bg"
            checked={selected}
            disabled={blocked || disabledReason !== undefined}
            onChange={(event) => onToggle(manufacturer.id, event.target.checked)}
            aria-label={`Select ${manufacturer.displayName}`}
          />
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span
          className={cn(
            'inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-xs font-medium',
            fit.tone === 'success' && 'bg-success-weak text-success',
            fit.tone === 'warning' && 'bg-warning-weak text-warning',
            fit.tone === 'danger' && 'bg-danger-weak text-danger',
          )}
        >
          <span
            aria-hidden
            className={cn(
              'h-1.5 w-1.5 rounded-full',
              fit.tone === 'success' && 'bg-success',
              fit.tone === 'warning' && 'bg-warning',
              fit.tone === 'danger' && 'bg-danger',
            )}
          />
          {fit.label}
        </span>
        {manufacturer.partsInStock !== null && (
          <span
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-xs font-medium',
              manufacturer.partsInStock.covered === manufacturer.partsInStock.total
                ? 'bg-success-weak text-success'
                : manufacturer.partsInStock.covered === 0
                  ? 'bg-raised text-muted'
                  : 'bg-info-weak text-info',
            )}
            title="Parts of your bill of materials this manufacturer holds in stock. A part it does not hold can still be sourced."
          >
            {manufacturer.partsInStock.covered} of {manufacturer.partsInStock.total}{' '}
            parts in stock
          </span>
        )}
        {manufacturer.fitReasons.map((reason) => (
          <Text key={reason} tone="muted" size="xs">
            {reason}
          </Text>
        ))}
      </div>

      {manufacturer.certifications.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {manufacturer.certifications.map((certification) => (
            <Tag key={certification}>{certification}</Tag>
          ))}
        </div>
      )}

      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">Services</p>
        <div className="mt-1.5 flex flex-wrap gap-2">
          {manufacturer.services.length === 0 ? (
            <Text tone="muted" size="xs">
              No services published
            </Text>
          ) : (
            manufacturer.services.map((service) => (
              <Tag key={service}>{SERVICE_LABEL[service] ?? service}</Tag>
            ))
          )}
        </div>
      </div>

      <div className="h-px w-full bg-line" />

      <div className="flex flex-wrap items-start justify-between gap-4">
        <Stat
          label="Lead time"
          value={
            manufacturer.standardLeadTimeDays === null
              ? '—'
              : `${manufacturer.standardLeadTimeDays} days`
          }
        />
        <Stat
          label="MOQ"
          value={
            manufacturer.minimumOrderQuantity === null
              ? '—'
              : `${manufacturer.minimumOrderQuantity} pcs`
          }
        />
        <Stat label="Orders" value={String(manufacturer.completedOrderCount)} />
        <Stat
          label="On-time"
          value={
            manufacturer.onTimeDeliveryRate === null
              ? '—'
              : `${Math.round(manufacturer.onTimeDeliveryRate * 100)}%`
          }
          tone="success"
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <Text tone="muted" size="xs" className="min-w-0 truncate">
          {manufacturer.servedRegions.length === 0
            ? 'Regions not published'
            : `Serves ${manufacturer.servedRegions.join(' · ')}`}
        </Text>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="xs" onClick={() => onDetails(manufacturer.id)}>
            View details
          </Button>
          <Button
            size="xs"
            disabled={blocked}
            onClick={() => onRequestQuote(manufacturer.id)}
          >
            Request quote
          </Button>
        </div>
      </div>
    </Card>
  );
};
