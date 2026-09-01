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
  Textarea,
  Tag,
  Text,
  useToast,
} from '@ideeza/ui';
import {
  addEquipmentAction,
  removeEquipmentAction,
  saveCapabilityAction,
  saveCompanyAction,
} from '@/app/(app)/profile/actions.js';

/**
 * The four networks the design lists, in its order.
 *
 * A shop with none of them shows none — an empty row per network would be four
 * lines saying nothing, and the design does not draw them either.
 */
const SOCIAL_LINKS = [
  { field: 'facebookUrl', label: 'Facebook' },
  { field: 'twitterUrl', label: 'Twitter' },
  { field: 'instagramUrl', label: 'Instagram' },
  { field: 'linkedinUrl', label: 'LinkedIn' },
] as const satisfies readonly { readonly field: string; readonly label: string }[];

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
  /** The line under the name, and the introduction below it. */
  readonly tagline: string;
  readonly about: string;
  /** How a buyer reaches the shop outside the platform. */
  readonly phone: string;
  readonly websiteUrl: string;
  readonly employeeBand: string;
  readonly shippingMethods: readonly string[];
  readonly facebookUrl: string;
  readonly twitterUrl: string;
  readonly instagramUrl: string;
  readonly linkedinUrl: string;
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
  /** What is on the floor, as the shop lists it. */
  readonly equipment: readonly {
    readonly id: string;
    readonly name: string;
    readonly quantity: number;
    readonly note: string | null;
  }[];
  /** What the shop can do, per kind of work — the detail after the match. */
  readonly capabilitySheets: readonly {
    readonly id: string;
    readonly title: string;
    readonly parameters: readonly {
      readonly id: string;
      readonly label: string;
      readonly values: readonly string[];
    }[];
  }[];
  /** Articles this shop has written. Buyers read the published ones. */
  readonly articles: readonly {
    readonly id: string;
    readonly title: string;
    readonly category: string | null;
    readonly status: string;
    readonly rejectReason: string | null;
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

/**
 * The shop's profile: what buyers see, and what decides whether a request reaches
 * it at all.
 *
 * What gates anything is one record: the services, regions, minimum quantity
 * and lead time a request is matched against. Everything else here — the
 * shop's own words, its floor list, its capability sheets, its writing — is
 * what a buyer reads once a request has reached it, and all of it is stored.
 *
 * The Agent tab is the exception and says so: it belongs to IDEEZA's own
 * assistant rather than to this platform.
 */
export const ProfilePanels = ({ data }: { readonly data: ProfileData }) => {
  const [tab, setTab] = useState('about');
  const [editing, setEditing] = useState<'company' | 'capability' | 'equipment' | null>(null);
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
    tagline: data.tagline,
    about: data.about,
    phone: data.phone,
    websiteUrl: data.websiteUrl,
    employeeBand: data.employeeBand,
    // Typed as one line, stored as a list: a shop writes "DHL, FedEx", not an
    // array, and asking for one carrier per field would be five empty boxes.
    shippingMethods: data.shippingMethods.join(', '),
    facebookUrl: data.facebookUrl,
    twitterUrl: data.twitterUrl,
    instagramUrl: data.instagramUrl,
    linkedinUrl: data.linkedinUrl,
  });
  const [services, setServices] = useState<readonly string[]>(data.services);
  const [regions, setRegions] = useState<readonly string[]>(data.servedRegions);
  const [certifications, setCertifications] = useState<readonly string[]>(
    data.certifications,
  );
  const [newCertification, setNewCertification] = useState('');
  const [machine, setMachine] = useState({ name: '', quantity: '1', note: '' });
  const [moq, setMoq] = useState(data.minimumOrderQuantity);
  const [lead, setLead] = useState(data.standardLeadTimeDays);

  useEffect(() => setHydrated(true), []);

  const saveCompany = (): void => {
    setError(undefined);
    startTransition(async () => {
      const result = await saveCompanyAction({
        ...company,
        shippingMethods: company.shippingMethods
          .split(',')
          .map((method) => method.trim())
          .filter((method) => method !== ''),
      });
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

  const saveMachine = (): void => {
    setError(undefined);
    startTransition(async () => {
      const result = await addEquipmentAction({
        name: machine.name,
        quantity: Number(machine.quantity),
        note: machine.note,
      });
      if (!result.saved) {
        setError(result.error ?? 'That machine was not added.');
        return;
      }
      setEditing(null);
      setMachine({ name: '', quantity: '1', note: '' });
      push({ title: 'Added to your floor list', tone: 'success' });
      router.refresh();
    });
  };

  const dropMachine = (equipmentId: string): void => {
    startTransition(async () => {
      const result = await removeEquipmentAction(equipmentId);
      if (!result.saved) {
        push({ title: result.error ?? 'It was not removed.', tone: 'danger' });
        return;
      }
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
            {data.about === '' ? (
              <Text tone="muted" size="sm" className="mt-4 block">
                Nothing written yet. A buyer choosing between two shops reads this
                first — it is worth a paragraph.
              </Text>
            ) : (
              <div className="mt-4">
                <p className="text-xs font-semibold uppercase tracking-caps text-text-tertiary">
                  About
                </p>
                <Text size="sm" className="mt-1 block max-w-measure leading-lg">
                  {data.about}
                </Text>
              </div>
            )}

            <DefinitionList
              className="mt-5"
              columns={2}
              items={[
                { label: 'Name buyers see', value: data.displayName },
                { label: 'Legal name', value: data.legalName },
                {
                  label: 'Phone',
                  value: data.phone === '' ? 'Not given' : data.phone,
                },
                {
                  label: 'Employees',
                  value: data.employeeBand === '' ? 'Not given' : data.employeeBand,
                },
                {
                  label: 'Ships with',
                  value:
                    data.shippingMethods.length === 0
                      ? 'Not given'
                      : data.shippingMethods.join(', '),
                },
                {
                  label: 'Website',
                  value: data.websiteUrl === '' ? 'Not given' : data.websiteUrl,
                },
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
              title="Social"
              description="Where else a buyer can read about this shop."
              actions={
                <Button variant="secondary" size="sm" onClick={() => setEditing('company')}>
                  Edit
                </Button>
              }
            />
            {SOCIAL_LINKS.every(({ field }) => data[field] === '') ? (
              <Text tone="muted" size="sm" className="mt-3 block">
                No accounts linked. Nothing is shown to buyers until one is.
              </Text>
            ) : (
              <ul className="mt-3 flex flex-wrap gap-2">
                {SOCIAL_LINKS.filter(({ field }) => data[field] !== '').map(
                  ({ field, label }) => (
                    <li key={field}>
                      <a
                        href={data[field]}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="inline-flex items-center gap-2 rounded-full border border-border bg-bg-surface-raised px-3 py-1.5 text-xs font-medium text-text-primary transition-colors hover:border-border-brand hover:text-text-brand"
                      >
                        {label}
                      </a>
                    </li>
                  ),
                )}
              </ul>
            )}
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
                <Button variant="secondary" size="sm" onClick={() => setEditing('equipment')}>
                  Add new
                </Button>
              }
            />
            {data.equipment.length === 0 ? (
              <div className="mt-4">
                <EmptyState
                  title="No equipment listed"
                  description="A buyer deciding between two shops reads this before the quote. What is on your floor?"
                />
              </div>
            ) : (
              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {data.equipment.map((item) => (
                  <div key={item.id} className="rounded-lg border border-border-subtle p-3">
                    <p className="text-xl font-bold text-text-primary" data-numeric>
                      {item.quantity}
                    </p>
                    <p className="mt-0.5 text-sm font-medium text-text-primary">{item.name}</p>
                    {item.note !== null && (
                      <Text tone="muted" size="xs" className="mt-0.5 block">
                        {item.note}
                      </Text>
                    )}
                    <Button
                      variant="ghost"
                      size="xs"
                      className="mt-2"
                      disabled={pending}
                      onClick={() => dropMachine(item.id)}
                    >
                      Remove
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </Card>
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

          {data.capabilitySheets.length === 0 && (
            <EmptyState
              title="No capability sheets yet"
              description="The panel above is what a request is matched on. A sheet is the detail a buyer reads once it has reached you — layer counts, tolerances, finishes."
            />
          )}

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            {data.capabilitySheets.map((sheet) => (
              <Card key={sheet.id} padded={false}>
                <div className="flex items-center justify-between gap-3 border-b border-border-subtle px-4 py-3">
                  <div>
                    <p className="text-sm font-semibold text-text-primary">{sheet.title}</p>
                    <Text tone="muted" size="xs">
                      {sheet.parameters.length}{' '}
                      {sheet.parameters.length === 1 ? 'parameter' : 'parameters'}
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
                  {sheet.parameters.map((row) => (
                    <li
                      key={row.id}
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
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-text-primary">{article.title}</p>
                    {article.category !== null && (
                      <Text tone="muted" size="xs">
                        {article.category}
                      </Text>
                    )}
                    {/*
                      A rejection is the one status that owes an explanation.
                      Without the reason beside it a shop is told no and left to
                      guess, which is how the same article comes back twice.
                    */}
                    {article.rejectReason !== null && (
                      <Text size="xs" className="mt-1 block max-w-measure text-text-error">
                        {article.rejectReason}
                      </Text>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Tag
                      tone={
                        article.status === 'published'
                          ? 'success'
                          : article.status === 'rejected'
                            ? 'danger'
                            : article.status === 'in_review'
                              ? 'warning'
                              : 'neutral'
                      }
                    >
                      {article.status.replace(/_/g, ' ')}
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
        open={editing === 'equipment'}
        onClose={() => setEditing(null)}
        title="Add equipment"
        description="What is on your floor. Buyers read this before they choose."
        size="sm"
        footer={
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="secondary" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              loading={pending || !hydrated}
              disabled={!hydrated}
              onClick={saveMachine}
            >
              Add
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          <FormField label="What is it" required hint="As a buyer would name it.">
            <Input
              value={machine.name}
              maxLength={120}
              onChange={(event) => setMachine({ ...machine, name: event.target.value })}
            />
          </FormField>
          <FormField label="How many" required>
            <Input
              type="number"
              min={1}
              max={999}
              value={machine.quantity}
              onChange={(event) => setMachine({ ...machine, quantity: event.target.value })}
            />
          </FormField>
          <FormField label="Note" hint="The model, or what it is good for.">
            <Input
              value={machine.note}
              maxLength={200}
              onChange={(event) => setMachine({ ...machine, note: event.target.value })}
            />
          </FormField>
          {error !== undefined && (
            <Alert tone="danger" title="Not added">
              {error}
            </Alert>
          )}
        </div>
      </Modal>

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
          <FormField
            label="About this shop"
            className="sm:col-span-2"
            hint="What a buyer choosing between two shops reads first."
          >
            <Textarea
              rows={5}
              maxLength={4000}
              value={company.about}
              onChange={(event) => setCompany({ ...company, about: event.target.value })}
            />
          </FormField>
          <FormField label="Tagline" className="sm:col-span-2" hint="One sentence, under the name.">
            <Input
              maxLength={160}
              value={company.tagline}
              onChange={(event) => setCompany({ ...company, tagline: event.target.value })}
            />
          </FormField>
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

          <FormField label="Phone">
            <Input
              type="tel"
              value={company.phone}
              onChange={(event) => setCompany({ ...company, phone: event.target.value })}
            />
          </FormField>
          <FormField label="Website" hint="example.com is enough.">
            <Input
              value={company.websiteUrl}
              onChange={(event) => setCompany({ ...company, websiteUrl: event.target.value })}
            />
          </FormField>
          <FormField label="Employees" hint="A band, not a headcount: 10-50.">
            <Input
              value={company.employeeBand}
              onChange={(event) =>
                setCompany({ ...company, employeeBand: event.target.value })
              }
            />
          </FormField>
          <FormField label="Ships with" hint="Carriers, separated by commas.">
            <Input
              value={company.shippingMethods}
              onChange={(event) =>
                setCompany({ ...company, shippingMethods: event.target.value })
              }
            />
          </FormField>

          {/*
            The four networks the design lists. Each is optional and each is
            checked on save: a link that does not open is worse than no link,
            because a buyer clicks it once and reads the dead end as the shop.
          */}
          <FormField label="Facebook">
            <Input
              value={company.facebookUrl}
              onChange={(event) => setCompany({ ...company, facebookUrl: event.target.value })}
            />
          </FormField>
          <FormField label="Twitter">
            <Input
              value={company.twitterUrl}
              onChange={(event) => setCompany({ ...company, twitterUrl: event.target.value })}
            />
          </FormField>
          <FormField label="Instagram">
            <Input
              value={company.instagramUrl}
              onChange={(event) =>
                setCompany({ ...company, instagramUrl: event.target.value })
              }
            />
          </FormField>
          <FormField label="LinkedIn">
            <Input
              value={company.linkedinUrl}
              onChange={(event) => setCompany({ ...company, linkedinUrl: event.target.value })}
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
                      ? 'rounded-full bg-bg-brand px-3 py-1.5 text-xs font-semibold text-text-on-brand'
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
                      ? 'rounded-full bg-bg-brand px-3 py-1.5 text-xs font-semibold text-text-on-brand'
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
