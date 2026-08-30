'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import {
  Badge,
  Button,
  Card,
  DefinitionList,
  EmptyState,
  Modal,
  SearchInput,
  Select,
  Text,
  buttonAppearance,
  useToast,
} from '@ideeza/ui';
import { ManufacturerCard, type ManufacturerCardData } from './manufacturer-card.js';
import { compareHref, requestHref } from '@/lib/rfq-copy.js';
import { MAX_RFQ_RECIPIENTS } from '@ideeza/domain';
import { goTo } from '@/lib/navigate.js';

export interface SelectManufacturersProps {
  readonly draftId: string;
  readonly manufacturers: readonly ManufacturerCardData[];
  readonly initialSelection: readonly string[];
}

const ANY = '';

/**
 * Step one of the request: who is asked to quote.
 *
 * Search and the four filters narrow the list the way the design does. A
 * manufacturer that cannot build the request stays visible with the reason, so
 * the buyer learns something rather than wondering where it went.
 */
export const SelectManufacturers = ({
  draftId,
  manufacturers,
  initialSelection,
}: SelectManufacturersProps) => {
  const router = useRouter();
  const { push } = useToast();
  const [query, setQuery] = useState('');
  const [capability, setCapability] = useState(ANY);
  const [leadTime, setLeadTime] = useState(ANY);
  const [region, setRegion] = useState(ANY);
  const [certification, setCertification] = useState(ANY);
  const [selected, setSelected] = useState<readonly string[]>(initialSelection);
  const [details, setDetails] = useState<ManufacturerCardData | null>(null);

  const capabilityOptions = useMemo(() => {
    const all = new Set<string>();
    for (const manufacturer of manufacturers) {
      for (const service of manufacturer.services) all.add(service);
    }
    return [{ value: ANY, label: 'Capability: any' }, ...[...all].sort().map((service) => ({
      value: service,
      label: service.replace(/_/g, ' '),
    }))];
  }, [manufacturers]);

  const regionOptions = useMemo(() => {
    const all = new Set<string>();
    for (const manufacturer of manufacturers) {
      for (const served of manufacturer.servedRegions) all.add(served);
    }
    return [{ value: ANY, label: 'Region: any' }, ...[...all].sort().map((served) => ({
      value: served,
      label: served,
    }))];
  }, [manufacturers]);

  const certificationOptions = useMemo(() => {
    const all = new Set<string>();
    for (const manufacturer of manufacturers) {
      for (const certificate of manufacturer.certifications) all.add(certificate);
    }
    return [
      { value: ANY, label: 'Certification: any' },
      ...[...all].sort().map((certificate) => ({ value: certificate, label: certificate })),
    ];
  }, [manufacturers]);

  const visible = manufacturers.filter((manufacturer) => {
    const matchesQuery =
      query.trim() === '' ||
      manufacturer.displayName.toLowerCase().includes(query.trim().toLowerCase()) ||
      manufacturer.city.toLowerCase().includes(query.trim().toLowerCase());
    const matchesCapability = capability === ANY || manufacturer.services.includes(capability);
    const matchesRegion = region === ANY || manufacturer.servedRegions.includes(region);
    const matchesCertification =
      certification === ANY || manufacturer.certifications.includes(certification);
    const matchesLeadTime =
      leadTime === ANY ||
      (manufacturer.standardLeadTimeDays !== null &&
        manufacturer.standardLeadTimeDays <= Number(leadTime));
    return (
      matchesQuery && matchesCapability && matchesRegion && matchesCertification && matchesLeadTime
    );
  });

  const toggle = (id: string, checked: boolean): void => {
    setSelected((current) => {
      if (!checked) return current.filter((entry) => entry !== id);
      if (current.length >= MAX_RFQ_RECIPIENTS) {
        push({
          title: 'That is the limit',
          body: `A request goes to at most ${MAX_RFQ_RECIPIENTS} manufacturers.`,
          tone: 'warning',
        });
        return current;
      }
      return [...current, id];
    });
  };

  const filtersApplied =
    query.trim() !== '' || capability !== ANY || region !== ANY || certification !== ANY || leadTime !== ANY;

  const clearFilters = (): void => {
    setQuery('');
    setCapability(ANY);
    setLeadTime(ANY);
    setRegion(ANY);
    setCertification(ANY);
  };

  return (
    <div className="flex flex-col gap-6 pb-24">
      <Card className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="w-full lg:max-w-[325px]">
            <SearchInput
              placeholder="Search by name..."
              aria-label="Search manufacturers by name"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Select
              aria-label="Filter by capability"
              className="w-auto min-w-[150px]"
              options={capabilityOptions}
              value={capability}
              onChange={(event) => setCapability(event.target.value)}
            />
            <Select
              aria-label="Filter by lead time"
              className="w-auto min-w-[150px]"
              options={[
                { value: ANY, label: 'Lead time: any' },
                { value: '14', label: 'Up to 14 days' },
                { value: '21', label: 'Up to 21 days' },
                { value: '30', label: 'Up to 30 days' },
              ]}
              value={leadTime}
              onChange={(event) => setLeadTime(event.target.value)}
            />
            <Select
              aria-label="Filter by region"
              className="w-auto min-w-[140px]"
              options={regionOptions}
              value={region}
              onChange={(event) => setRegion(event.target.value)}
            />
            <Select
              aria-label="Filter by certification"
              className="w-auto min-w-[170px]"
              options={certificationOptions}
              value={certification}
              onChange={(event) => setCertification(event.target.value)}
            />
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border-subtle pt-3">
          <Text tone="muted" size="xs">
            {visible.length} of {manufacturers.length}{' '}
            {manufacturers.length === 1 ? 'manufacturer' : 'manufacturers'} shown
          </Text>
          {filtersApplied && (
            <Button variant="ghost" size="xs" onClick={clearFilters}>
              Clear filters
            </Button>
          )}
        </div>
      </Card>

      {visible.length === 0 ? (
        <EmptyState
          title="No manufacturer matches those filters"
          description="Widen the search, or clear the filters to see every manufacturer again."
          action={
            <Button variant="secondary" onClick={clearFilters}>
              Clear filters
            </Button>
          }
        />
      ) : (
        <ul aria-label="Manufacturers" className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          {visible.map((manufacturer) => (
            <li key={manufacturer.id} className="flex">
              <ManufacturerCard
                manufacturer={manufacturer}
                selected={selected.includes(manufacturer.id)}
                onToggle={toggle}
                onDetails={() => setDetails(manufacturer)}
                onRequestQuote={(id) => goTo(router, requestHref(draftId, [id]))}
              />
            </li>
          ))}
        </ul>
      )}

      {/* The select bar: what is chosen, and the two ways forward. */}
      <div
        className="fixed inset-x-0 bottom-0 z-30 border-t border-border-subtle bg-bg-surface/95 px-4 py-3 backdrop-blur md:px-gutter lg:left-sidebar"
        role="region"
        aria-label="Selected manufacturers"
      >
        <div className="mx-auto flex w-full max-w-content flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-semibold text-text-primary">
            {selected.length === 0
              ? 'No manufacturer selected yet'
              : `${selected.length} ${selected.length === 1 ? 'manufacturer' : 'manufacturers'} selected`}
            {selected.length > 0 && (
              <Badge tone="brand" className="ml-2 align-middle">
                max {MAX_RFQ_RECIPIENTS}
              </Badge>
            )}
          </p>
          {/* These two move to another screen, so they are links once they can
              be followed: a real anchor navigates even while the client is busy,
              and it can be opened in a new tab. */}
          <div className="flex flex-wrap items-center gap-2">
            {selected.length < 2 ? (
              <Button variant="secondary" disabled>
                Compare
              </Button>
            ) : (
              <Link
                href={compareHref(draftId, selected)}
                className={buttonAppearance({ variant: 'secondary' })}
              >
                Compare
              </Link>
            )}
            {selected.length === 0 ? (
              <Button disabled>Continue to quotes</Button>
            ) : (
              <Link
                href={requestHref(draftId, selected)}
                className={buttonAppearance()}
              >
                Continue to quotes
              </Link>
            )}
          </div>
        </div>
      </div>

      <Modal
        open={details !== null}
        onClose={() => setDetails(null)}
        title={details?.displayName ?? 'Manufacturer'}
        description={
          details === null
            ? undefined
            : `${details.city}, ${details.countryCode}${details.verified ? ' · verified by IDEEZA' : ''}`
        }
        footer={
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="secondary" onClick={() => setDetails(null)}>
              Close
            </Button>
            {details !== null && details.fitVerdict !== 'cannot' && (
              <Button
                onClick={() => {
                  toggle(details.id, !selected.includes(details.id));
                  setDetails(null);
                }}
              >
                {selected.includes(details.id) ? 'Remove from selection' : 'Add to selection'}
              </Button>
            )}
          </div>
        }
      >
        {details !== null && (
          <DefinitionList
            items={[
              {
                label: 'Rating',
                value: details.rating === null ? '—' : `★ ${details.rating.toFixed(1)}`,
              },
              {
                label: 'On-time delivery',
                value:
                  details.onTimeDeliveryRate === null
                    ? '—'
                    : `${Math.round(details.onTimeDeliveryRate * 100)}%`,
              },
              { label: 'Completed orders', value: String(details.completedOrderCount) },
              {
                label: 'Minimum order quantity',
                value:
                  details.minimumOrderQuantity === null
                    ? '—'
                    : `${details.minimumOrderQuantity} pcs`,
              },
              {
                label: 'Standard lead time',
                value:
                  details.standardLeadTimeDays === null
                    ? '—'
                    : `${details.standardLeadTimeDays} days`,
              },
              {
                label: 'Services',
                value: details.services.length === 0 ? '—' : details.services.join(', '),
              },
              {
                label: 'Certifications',
                value:
                  details.certifications.length === 0 ? '—' : details.certifications.join(', '),
              },
              {
                label: 'Regions served',
                value: details.servedRegions.length === 0 ? '—' : details.servedRegions.join(', '),
              },
              {
                label: 'Fit for this request',
                value:
                  details.fitReasons.length === 0
                    ? 'Everything this request asks for'
                    : details.fitReasons.join(' · '),
              },
            ]}
          />
        )}
      </Modal>
    </div>
  );
};
