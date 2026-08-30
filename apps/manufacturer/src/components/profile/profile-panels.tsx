'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  Alert,
  Button,
  Card,
  CardHeader,
  DefinitionList,
  DropdownMenu,
  EmptyState,
  FormField,
  Input,
  Modal,
  Tabs,
  Tag,
  Text,
  useToast,
} from '@ideeza/ui';
import {
  saveCapabilityAction,
  saveCompanyAction,
} from '@/app/(app)/profile/actions.js';

export interface ProfileReviewRow {
  readonly id: string;
  readonly rating: number;
  readonly body: string | null;
  readonly buyerName: string;
  readonly productName: string;
  readonly on: string;
}

export interface ProfileData {
  readonly displayName: string;
  readonly legalName: string;
  readonly addressLine1: string;
  readonly addressLine2: string;
  readonly city: string;
  readonly region: string;
  readonly postalCode: string;
  readonly countryCode: string;
  readonly verified: boolean;
  readonly rating: number | null;
  readonly onTimeDeliveryRate: number | null;
  readonly completedOrderCount: number;
  readonly memberSince: string;
  readonly services: readonly string[];
  readonly certifications: readonly string[];
  readonly servedRegions: readonly string[];
  readonly minimumOrderQuantity: string;
  readonly standardLeadTimeDays: string;
  readonly reviews: readonly ProfileReviewRow[];
  readonly reviewCount: number;
  readonly quoteCount: number;
  readonly orderCount: number;
  readonly partCount: number;
  readonly members: readonly {
    readonly name: string;
    readonly email: string;
    readonly owner: boolean;
  }[];
  /** Articles this shop has published, from the blog. */
  readonly articles: readonly {
    readonly id: string;
    readonly title: string;
    readonly status: string;
    readonly on: string;
  }[];
}

const SERVICE_OPTIONS = [
  { value: 'fabrication', label: 'PCB fabrication' },
  { value: 'assembly', label: 'PCB assembly' },
  { value: 'parts_sourcing', label: 'Parts sourcing' },
  { value: '3d_enclosure', label: '3D printing / enclosures' },
  { value: 'testing', label: 'Testing' },
  { value: 'stencil', label: 'Stencils' },
];

const REGION_OPTIONS = ['Asia', 'Europe', 'North America', 'South America', 'Africa', 'Oceania'];

/** The parameter sheets the design shows per kind of work. */
const CAPABILITY_SHEETS = [
  {
    id: 'pcb',
    title: 'PCB manufacturing',
    rows: [
      { label: 'Layer support', values: ['1–16 layers'] },
      { label: 'Minimum hole size', values: ['0.2mm'] },
      { label: 'Surface finish', values: ['ENIG', 'HASL'] },
      { label: 'Material', values: ['FR-4', 'High-Tg FR4'] },
      { label: 'Copper weight', values: ['1oz', '2oz'] },
      { label: 'Impedance control', values: ['±7%'] },
      { label: 'Build time', values: ['24–48 hours'] },
    ],
  },
  {
    id: 'pcba',
    title: 'PCB assembly',
    rows: [
      { label: 'Placement', values: ['0402 and up'] },
      { label: 'Sides', values: ['Single', 'Double'] },
      { label: 'Inspection', values: ['AOI', 'Functional test'] },
      { label: 'Build time', values: ['24–48 hours'] },
    ],
  },
  {
    id: 'printing',
    title: '3D printing',
    rows: [
      { label: 'Technology', values: ['SLS', 'MJF', 'FDM'] },
      { label: 'Material', values: ['PA12', 'PETG'] },
      { label: 'Max print size', values: ['380 × 284 × 380 mm'] },
      { label: 'Resolution', values: ['60–120 µm layer'] },
      { label: 'Build time', values: ['48–72 hours'] },
    ],
  },
  {
    id: 'cnc',
    title: 'CNC machining',
    rows: [
      { label: 'Axis', values: ['3-axis', '5-axis'] },
      { label: 'Material', values: ['Aluminium 6061', 'Stainless 316'] },
      { label: 'Tolerance', values: ['±0.025mm'] },
      { label: 'Max work area', values: ['1200 × 700 × 500 mm'] },
      { label: 'Build time', values: ['7–10 business days'] },
    ],
  },
];

const EQUIPMENT = [
  { count: '05', label: '5-axis CNC mills' },
  { count: '04', label: '3D printers' },
  { count: '03', label: 'Laser cutters' },
  { count: '02', label: 'Reflow ovens' },
];

/**
 * The shop's profile: what buyers see, and what decides whether a request reaches
 * it at all.
 *
 * Two parts of this are stored and matter immediately — the company details an
 * order ships to, and the services, regions, minimum quantity and lead time a
 * request is matched against. The parameter sheets, the equipment list and the
 * agent section are laid out from the design and marked as the prototype they
 * are: the platform has nowhere to keep them yet, and a screen that pretended
 * otherwise would lose a shop's work.
 */
export const ProfilePanels = ({ data }: { readonly data: ProfileData }) => {
  const [tab, setTab] = useState('about');
  const [editing, setEditing] = useState<'company' | 'capability' | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | undefined>(undefined);
  const router = useRouter();
  const { push } = useToast();

  const [company, setCompany] = useState({
    displayName: data.displayName,
    legalName: data.legalName,
    addressLine1: data.addressLine1,
    addressLine2: data.addressLine2,
    city: data.city,
    region: data.region,
    postalCode: data.postalCode,
    countryCode: data.countryCode,
  });
  const [services, setServices] = useState<readonly string[]>(data.services);
  const [regions, setRegions] = useState<readonly string[]>(data.servedRegions);
  const [certifications, setCertifications] = useState<readonly string[]>(
    data.certifications,
  );
  const [newCertification, setNewCertification] = useState('');
  const [moq, setMoq] = useState(data.minimumOrderQuantity);
  const [lead, setLead] = useState(data.standardLeadTimeDays);

  useEffect(() => setHydrated(true), []);

  const saveCompany = (): void => {
    setError(undefined);
    startTransition(async () => {
      const result = await saveCompanyAction(company);
      if (!result.saved) {
        setError(result.error ?? 'Those details were not saved.');
        return;
      }
      setEditing(null);
      push({
        title: 'Company details saved',
        body: 'Buyers see this, and orders ship to the address.',
        tone: 'success',
      });
      router.refresh();
    });
  };

  const saveCapability = (): void => {
    setError(undefined);
    startTransition(async () => {
      const result = await saveCapabilityAction({
        services,
        certifications,
        servedRegions: regions,
        minimumOrderQuantity: moq,
        standardLeadTimeDays: lead,
      });
      if (!result.saved) {
        setError(result.error ?? 'That was not saved.');
        return;
      }
      setEditing(null);
      push({
        title: 'What buyers match you on is saved',
        body: 'A request now reaches you only if these cover it.',
        tone: 'success',
      });
      router.refresh();
    });
  };

  const toggle = (
    list: readonly string[],
    value: string,
    set: (next: readonly string[]) => void,
  ): void => {
    set(list.includes(value) ? list.filter((item) => item !== value) : [...list, value]);
  };

  return (
    <>
      <Card padded={false}>
        <div className="px-4 py-3 md:px-6">
          <Tabs
            label="Profile sections"
            activeId={tab}
            onSelect={setTab}
            items={[
              { id: 'about', label: 'About' },
              { id: 'review', label: 'Review', count: data.reviewCount },
              { id: 'machines', label: 'Machine & process' },
              { id: 'capabilities', label: 'Capabilities' },
              { id: 'blog', label: 'Blog', count: data.articles.length },
              { id: 'services', label: 'Service & certification' },
              { id: 'agent', label: 'Agent' },
            ]}
          />
        </div>
      </Card>

      {tab === 'about' && (
        <>
          <Card>
            <CardHeader
              title="Company information"
              actions={
                <Button variant="secondary" size="sm" onClick={() => setEditing('company')}>
                  Edit
                </Button>
              }
            />
            <DefinitionList
              className="mt-4"
              columns={2}
              items={[
                { label: 'Name buyers see', value: data.displayName },
                { label: 'Legal name', value: data.legalName },
                {
                  label: 'Address',
                  value: [
                    data.addressLine1,
                    data.addressLine2 === '' ? null : data.addressLine2,
                    data.city,
                    data.region === '' ? null : data.region,
                    data.postalCode === '' ? null : data.postalCode,
                    data.countryCode,
                  ]
                    .filter((part): part is string => part !== null && part !== '')
                    .join(', '),
                },
                { label: 'On IDEEZA since', value: data.memberSince },
                {
                  label: 'Verified',
                  value: data.verified ? 'Yes' : 'Not yet — buyers may not see you',
                },
                {
                  label: 'On-time delivery',
                  value:
                    data.onTimeDeliveryRate === null
                      ? 'No completed orders yet'
                      : `${Math.round(data.onTimeDeliveryRate * 100)}%`,
                },
              ]}
            />
          </Card>

          <Card>
            <CardHeader
              title="Your team"
              description="Members who can act for this shop."
            />
            <ul aria-label="Team" className="mt-3 flex flex-col gap-2">
              {data.members.map((member) => (
                <li
                  key={member.email}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border-subtle p-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-text-primary">{member.name}</p>
                    <Text tone="muted" size="xs">
                      {member.email}
                    </Text>
                  </div>
                  {member.owner && <Tag tone="brand">Owner</Tag>}
                </li>
              ))}
            </ul>
            <Text tone="muted" size="xs" className="mt-3 block">
              Inviting a member, and a member who works for two shops choosing between
              them, arrive with the accounts work.
            </Text>
          </Card>

          <Alert tone="info" title="What the design has and the platform does not yet">
            The about text, the phone number, the website, the employee count, the
            shipping methods and the social links have nowhere to live in this build.
            They are not shown as empty fields here, because a form that loses what you
            type is worse than no form.
          </Alert>
        </>
      )}

      {tab === 'review' && (
        <Card padded={false}>
          <div className="px-4 py-4 md:px-6">
            <CardHeader
              title={`${data.reviewCount} review${data.reviewCount === 1 ? '' : 's'}`}
              description={
                data.rating === null
                  ? 'No rating yet.'
                  : `Average ${data.rating.toFixed(1)} out of 5, from buyers whose orders you finished.`
              }
            />
          </div>
          {data.reviews.length === 0 ? (
            <div className="px-4 pb-6 md:px-6">
              <EmptyState
                title="No reviews yet"
                description="A buyer can review a shop once an order is delivered and they have confirmed it."
              />
            </div>
          ) : (
            <ul aria-label="Reviews" className="border-t border-border-subtle">
              {data.reviews.map((review) => (
                <li
                  key={review.id}
                  className="border-b border-border-subtle px-4 py-4 last:border-b-0 md:px-6"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-text-primary">
                      {review.buyerName} · {review.productName}
                    </p>
                    <span className="text-sm font-semibold text-text-brand">
                      {'★'.repeat(review.rating)}
                      <span className="text-text-tertiary">{'★'.repeat(5 - review.rating)}</span>
                    </span>
                  </div>
                  <Text tone="muted" size="xs" className="mt-0.5 block">
                    {review.on}
                  </Text>
                  {review.body !== null && (
                    <Text size="sm" className="mt-2 block">
                      {review.body}
                    </Text>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      {tab === 'machines' && (
        <>
          <Card>
            <CardHeader
              title="Equipment"
              description="What is on the floor, as a buyer would want to know it."
              actions={
                <Button variant="secondary" size="sm" disabled>
                  Add new
                </Button>
              }
            />
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {EQUIPMENT.map((item) => (
                <div key={item.label} className="rounded-lg border border-border-subtle p-3">
                  <p className="text-xl font-bold text-text-primary">{item.count}</p>
                  <Text tone="muted" size="xs">
                    {item.label}
                  </Text>
                </div>
              ))}
            </div>
          </Card>

          <Alert tone="warning" title="Laid out, not yet stored">
            This panel is the design with representative numbers. Equipment has no table
            in the database yet, so nothing typed here would survive — which is why the
            Add button is disabled rather than pretending.
          </Alert>
        </>
      )}

      {tab === 'capabilities' && (
        <>
          <Card>
            <CardHeader
              title="What buyers are matched on"
              description="This part is real: a request only reaches you if these cover it."
              actions={
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setEditing('capability')}
                >
                  Edit
                </Button>
              }
            />
            <div className="mt-4 flex flex-col gap-3">
              <div>
                <Text tone="muted" size="xs" className="block">
                  Services published
                </Text>
                <div className="mt-1 flex flex-wrap gap-2">
                  {data.services.length === 0 ? (
                    <Tag tone="warning">None — no request can reach you</Tag>
                  ) : (
                    data.services.map((service) => (
                      <Tag key={service} tone="brand">
                        {SERVICE_OPTIONS.find((option) => option.value === service)
                          ?.label ?? service.replace(/_/g, ' ')}
                      </Tag>
                    ))
                  )}
                </div>
              </div>
              <div>
                <Text tone="muted" size="xs" className="block">
                  Regions served
                </Text>
                <div className="mt-1 flex flex-wrap gap-2">
                  {data.servedRegions.length === 0 ? (
                    <Tag tone="warning">None published</Tag>
                  ) : (
                    data.servedRegions.map((region) => <Tag key={region}>{region}</Tag>)
                  )}
                </div>
              </div>
              <DefinitionList
                columns={2}
                items={[
                  {
                    label: 'Minimum order quantity',
                    value:
                      data.minimumOrderQuantity === ''
                        ? 'Not set'
                        : `${data.minimumOrderQuantity} units`,
                  },
                  {
                    label: 'Standard lead time',
                    value:
                      data.standardLeadTimeDays === ''
                        ? 'Not set'
                        : `${data.standardLeadTimeDays} days`,
                  },
                ]}
              />
            </div>
          </Card>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            {CAPABILITY_SHEETS.map((sheet) => (
              <Card key={sheet.id} padded={false}>
                <div className="flex items-center justify-between gap-3 border-b border-border-subtle px-4 py-3">
                  <div>
                    <p className="text-sm font-semibold text-text-primary">{sheet.title}</p>
                    <Text tone="muted" size="xs">
                      {sheet.rows.length} parameters
                    </Text>
                  </div>
                  <DropdownMenu
                    label={`Actions for ${sheet.title}`}
                    items={[{ id: 'soon', label: 'Editing arrives with the logic pass', disabled: true }]}
                    trigger={({ ref, onClick, ...aria }) => (
                      <button
                        ref={ref}
                        type="button"
                        onClick={onClick}
                        aria-label={`Actions for ${sheet.title}`}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-md text-text-tertiary hover:bg-bg-surface-raised focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus"
                        {...aria}
                      >
                        ⋮
                      </button>
                    )}
                  />
                </div>
                <ul aria-label={`${sheet.title} parameters`}>
                  {sheet.rows.map((row) => (
                    <li
                      key={row.label}
                      className="flex flex-wrap items-center justify-between gap-2 border-b border-border-subtle px-4 py-2.5 last:border-b-0"
                    >
                      <Text tone="muted" size="sm">
                        {row.label}
                      </Text>
                      <span className="flex flex-wrap justify-end gap-1">
                        {row.values.map((value) => (
                          <Tag key={value} tone="brand">
                            {value}
                          </Tag>
                        ))}
                      </span>
                    </li>
                  ))}
                </ul>
              </Card>
            ))}
          </div>

          <Alert tone="warning" title="The parameter sheets are the design, not stored data">
            What the platform actually matches on is the panel above. These sheets need
            their own tables — one per kind of work — and they arrive with the logic
            pass.
          </Alert>
        </>
      )}

      {tab === 'blog' && (
        <Card padded={false}>
          <div className="px-4 py-4 md:px-6">
            <CardHeader
              title="Articles"
              description="What this shop has published. Buyers read it on your profile."
            />
          </div>
          {data.articles.length === 0 ? (
            <div className="px-4 pb-6 md:px-6">
              <EmptyState
                title="Nothing published yet"
                description="Write from the Blog section in the rail; published articles appear here."
              />
            </div>
          ) : (
            <ul aria-label="Articles" className="border-t border-border-subtle">
              {data.articles.map((article) => (
                <li
                  key={article.id}
                  className="flex flex-wrap items-center justify-between gap-2 border-b border-border-subtle px-4 py-3 last:border-b-0 md:px-6"
                >
                  <p className="text-sm font-semibold text-text-primary">{article.title}</p>
                  <div className="flex items-center gap-2">
                    <Tag tone={article.status === 'published' ? 'success' : 'neutral'}>
                      {article.status}
                    </Tag>
                    <Text tone="muted" size="xs">
                      {article.on}
                    </Text>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      {tab === 'services' && (
        <>
          <Card>
            <CardHeader
              title="Certifications"
              description="What you hold. Buyers filter on these."
              actions={
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setEditing('capability')}
                >
                  Edit
                </Button>
              }
            />
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {data.certifications.length === 0 ? (
                <Text tone="muted" size="sm">
                  None published yet.
                </Text>
              ) : (
                data.certifications.map((certification) => (
                  <div
                    key={certification}
                    className="flex items-center justify-between gap-2 rounded-lg border border-border-subtle p-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-text-primary">
                        {certification}
                      </p>
                      <Text tone="muted" size="xs">
                        Published by you
                      </Text>
                    </div>
                    <Tag tone="neutral">Not verified by IDEEZA</Tag>
                  </div>
                ))
              )}
            </div>
            <Text tone="muted" size="xs" className="mt-3 block">
              IDEEZA does not check certificates in this build, so none of them claims to
              be verified. Saying otherwise on a buyer&rsquo;s screen would be a promise
              the platform cannot keep.
            </Text>
          </Card>

          <Card>
            <CardHeader title="Services" description="What you are matched on." />
            <div className="mt-3 flex flex-wrap gap-2">
              {data.services.map((service) => (
                <Tag key={service} tone="brand">
                  {SERVICE_OPTIONS.find((option) => option.value === service)?.label ??
                    service.replace(/_/g, ' ')}
                </Tag>
              ))}
            </div>
          </Card>
        </>
      )}

      {tab === 'agent' && (
        <Card>
          <CardHeader
            title="Agent"
            description="Part of the wider IDEEZA product, outside this manufacturing platform."
          />
          <Text size="sm" className="mt-2 block">
            The agent section belongs to IDEEZA&rsquo;s own assistant, which is not part
            of the manufacturing panel. It is left here as the design has it so nothing
            appears to have been dropped.
          </Text>
        </Card>
      )}

      <Modal
        open={editing === 'company'}
        onClose={() => setEditing(null)}
        title="Edit company information"
        description="Buyers see the name; orders ship to the address."
        size="md"
        footer={
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="secondary" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              loading={pending || !hydrated}
              disabled={!hydrated}
              onClick={saveCompany}
            >
              Save
            </Button>
          </div>
        }
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField label="Name buyers see" required>
            <Input
              value={company.displayName}
              onChange={(event) =>
                setCompany({ ...company, displayName: event.target.value })
              }
            />
          </FormField>
          <FormField label="Legal name">
            <Input
              value={company.legalName}
              onChange={(event) =>
                setCompany({ ...company, legalName: event.target.value })
              }
            />
          </FormField>
          <FormField label="Address line 1" required>
            <Input
              value={company.addressLine1}
              onChange={(event) =>
                setCompany({ ...company, addressLine1: event.target.value })
              }
            />
          </FormField>
          <FormField label="Address line 2">
            <Input
              value={company.addressLine2}
              onChange={(event) =>
                setCompany({ ...company, addressLine2: event.target.value })
              }
            />
          </FormField>
          <FormField label="City" required>
            <Input
              value={company.city}
              onChange={(event) => setCompany({ ...company, city: event.target.value })}
            />
          </FormField>
          <FormField label="Region">
            <Input
              value={company.region}
              onChange={(event) => setCompany({ ...company, region: event.target.value })}
            />
          </FormField>
          <FormField label="Postal code">
            <Input
              value={company.postalCode}
              onChange={(event) =>
                setCompany({ ...company, postalCode: event.target.value })
              }
            />
          </FormField>
          <FormField label="Country code" required hint="Two letters, eg. BD.">
            <Input
              value={company.countryCode}
              onChange={(event) =>
                setCompany({ ...company, countryCode: event.target.value })
              }
            />
          </FormField>
        </div>
        {error !== undefined && (
          <Text tone="danger" size="sm" className="mt-3 block">
            {error}
          </Text>
        )}
      </Modal>

      <Modal
        open={editing === 'capability'}
        onClose={() => setEditing(null)}
        title="What buyers match you on"
        description="A request only reaches shops these cover."
        size="md"
        footer={
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="secondary" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              loading={pending || !hydrated}
              disabled={!hydrated}
              onClick={saveCapability}
            >
              Save
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          <div>
            <p className="text-sm font-semibold text-text-primary">Services</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {SERVICE_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => toggle(services, option.value, setServices)}
                  className={
                    services.includes(option.value)
                      ? 'rounded-full bg-bg-brand px-3 py-1.5 text-xs font-semibold text-white'
                      : 'rounded-full border border-border-subtle px-3 py-1.5 text-xs font-medium text-text-secondary hover:bg-bg-surface-raised'
                  }
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-sm font-semibold text-text-primary">Regions served</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {REGION_OPTIONS.map((region) => (
                <button
                  key={region}
                  type="button"
                  onClick={() => toggle(regions, region, setRegions)}
                  className={
                    regions.includes(region)
                      ? 'rounded-full bg-bg-brand px-3 py-1.5 text-xs font-semibold text-white'
                      : 'rounded-full border border-border-subtle px-3 py-1.5 text-xs font-medium text-text-secondary hover:bg-bg-surface-raised'
                  }
                >
                  {region}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-sm font-semibold text-text-primary">Certifications</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {certifications.map((certification) => (
                <button
                  key={certification}
                  type="button"
                  onClick={() =>
                    setCertifications(
                      certifications.filter((item) => item !== certification),
                    )
                  }
                  className="rounded-full bg-bg-brand-subtle px-3 py-1.5 text-xs font-semibold text-text-brand"
                  title="Remove"
                >
                  {certification} ×
                </button>
              ))}
            </div>
            <div className="mt-2 flex flex-wrap items-end gap-2">
              <FormField label="Add a certification" className="min-w-[220px] flex-1">
                <Input
                  value={newCertification}
                  placeholder="eg. ISO 9001:2015"
                  onChange={(event) => setNewCertification(event.target.value)}
                />
              </FormField>
              <Button
                variant="secondary"
                onClick={() => {
                  if (newCertification.trim() === '') return;
                  setCertifications([...certifications, newCertification.trim()]);
                  setNewCertification('');
                }}
              >
                Add
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField
              label="Minimum order quantity"
              required
              hint="A request below this cannot be sent to you at all."
            >
              <Input
                inputMode="numeric"
                value={moq}
                onChange={(event) => setMoq(event.target.value)}
              />
            </FormField>
            <FormField
              label="Standard lead time (days)"
              required
              hint="A request asking for less is shown as a partial fit."
            >
              <Input
                inputMode="numeric"
                value={lead}
                onChange={(event) => setLead(event.target.value)}
              />
            </FormField>
          </div>

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
