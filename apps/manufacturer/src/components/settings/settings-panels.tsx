'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';
import {
  Alert,
  Button,
  Card,
  CardHeader,
  Checkbox,
  DefinitionList,
  FormField,
  Input,
  Modal,
  Select,
  Tag,
  Text,
  buttonAppearance,
  cn,
  useToast,
} from '@ideeza/ui';
import { saveCompanyAction } from '@/app/(app)/profile/actions.js';

export interface SettingsData {
  readonly displayName: string;
  readonly legalName: string;
  readonly addressLine1: string;
  readonly addressLine2: string;
  readonly city: string;
  readonly region: string;
  readonly postalCode: string;
  readonly countryCode: string;
  readonly verified: boolean;
  readonly memberEmail: string;
  readonly memberName: string;
  readonly isOwner: boolean;
  readonly services: readonly string[];
  readonly openCaseCount: number;
  readonly heldMinor: number;
  readonly currency: string;
}

const SECTIONS = [
  {
    group: 'General',
    items: [
      { id: 'profile', label: 'Profile' },
      { id: 'company', label: 'Company information' },
      { id: 'security', label: 'Security' },
      { id: 'kyc', label: 'KYC verification' },
      { id: 'paid', label: 'Get paid' },
    ],
  },
  {
    group: 'Preferences',
    items: [
      { id: 'notification', label: 'Notification' },
      { id: 'language', label: 'Language' },
      { id: 'locking', label: 'Profile locking' },
    ],
  },
  {
    group: '',
    items: [
      { id: 'policy', label: 'Policy & privacy' },
      { id: 'activity', label: 'Activity' },
      { id: 'dispute', label: 'Dispute' },
    ],
  },
] as const;

const major = (minor: number): string => (minor / 100).toFixed(2);

/**
 * Settings, with the same shape the design gives it: a section rail and one pane.
 *
 * What is stored is stored — the company details, which an order ships to. What
 * has nowhere to live yet says so in the pane it belongs to rather than being
 * dropped from the navigation, so nothing looks missing and nothing pretends.
 */
export const SettingsPanels = ({ data }: { readonly data: SettingsData }) => {
  const [section, setSection] = useState<string>('company');
  const [editing, setEditing] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | undefined>(undefined);
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

  // Preferences with nowhere to live yet: kept for this session so the screen
  // behaves, and labelled as such in the pane.
  const [notices, setNotices] = useState({
    newRequests: true,
    quoteDecisions: true,
    orderMoves: true,
    payouts: true,
    marketing: false,
  });
  const [language, setLanguage] = useState('en');
  const [region, setRegion] = useState('BD');
  const [locked, setLocked] = useState(false);

  const router = useRouter();
  const { push } = useToast();

  useEffect(() => setHydrated(true), []);

  const save = (): void => {
    setError(undefined);
    startTransition(async () => {
      const result = await saveCompanyAction(company);
      if (!result.saved) {
        setError(result.error ?? 'Those details were not saved.');
        return;
      }
      setEditing(false);
      push({
        title: 'Company information saved',
        body: 'Buyers see the name, and orders ship to the address.',
        tone: 'success',
      });
      router.refresh();
    });
  };

  const prototypeNote = (
    <Text tone="muted" size="xs" className="mt-3 block">
      Kept for this session. This preference has no column in the database yet, so it
      is not saved — the logic pass adds it.
    </Text>
  );

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
      <Card padded={false}>
        <nav aria-label="Settings sections" className="p-2">
          {SECTIONS.map((group) => (
            <div key={group.group} className="mb-2">
              {group.group !== '' && (
                <p className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted">
                  {group.group}
                </p>
              )}
              <ul>
                {group.items.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => setSection(item.id)}
                      className={cn(
                        'w-full rounded-lg px-3 py-2 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus',
                        section === item.id
                          ? 'bg-brand-weak font-semibold text-brand'
                          : 'text-body hover:bg-raised',
                      )}
                      aria-current={section === item.id ? 'page' : undefined}
                    >
                      {item.label}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
      </Card>

      <div className="flex flex-col gap-4">
        {section === 'profile' && (
          <Card>
            <CardHeader
              title="Your account"
              description="Who you are signed in as, and what you can do here."
            />
            <DefinitionList
              className="mt-4"
              columns={2}
              items={[
                { label: 'Name', value: data.memberName },
                { label: 'Email', value: data.memberEmail },
                { label: 'Role', value: data.isOwner ? 'Owner' : 'Member' },
                { label: 'Shop', value: data.displayName },
              ]}
            />
            <div className="mt-4 flex flex-wrap gap-2">
              <Link
                href="/profile"
                className={buttonAppearance({ variant: 'secondary', size: 'sm' })}
              >
                The shop profile buyers see
              </Link>
            </div>
          </Card>
        )}

        {section === 'company' && (
          <>
            <Card>
              <CardHeader
                title="Company information"
                actions={
                  <Button variant="secondary" size="sm" onClick={() => setEditing(true)}>
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
                  { label: 'Address', value: data.addressLine1 },
                  { label: 'City', value: data.city },
                  {
                    label: 'Region',
                    value: data.region === '' ? 'Not given' : data.region,
                  },
                  { label: 'Country', value: data.countryCode },
                ]}
              />
            </Card>
            <Alert tone="info" title="Bio, website, employees and social links">
              The design has them here. None has a column yet, and a form that loses
              what you type is worse than no form — so they arrive with the logic pass.
            </Alert>
          </>
        )}

        {section === 'security' && (
          <>
            <Card>
              <CardHeader
                title="Security"
                description="How this account is protected."
              />
              <DefinitionList
                className="mt-4"
                columns={2}
                items={[
                  { label: 'Sign-in', value: 'Email and password' },
                  { label: 'Sessions', value: 'One device at a time in this build' },
                  { label: 'Two-factor', value: 'Not available yet' },
                ]}
              />
              <div className="mt-4 flex flex-wrap gap-2">
                <Link href="/auth/sign-out" className={buttonAppearance({ variant: 'secondary', size: 'sm' })}>
                  Sign out
                </Link>
              </div>
            </Card>
            <Alert tone="info" title="Changing a password">
              Password changes and two-factor sign-in are part of the accounts work, not
              this panel. Nothing here will ask you for a password it cannot change.
            </Alert>
          </>
        )}

        {section === 'kyc' && (
          <Card>
            <CardHeader
              title="KYC verification"
              description="Whether IDEEZA has checked who this shop is."
            />
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Tag tone={data.verified ? 'success' : 'warning'}>
                {data.verified ? 'Verified by IDEEZA' : 'Not verified yet'}
              </Tag>
            </div>
            <Text size="sm" className="mt-3 block">
              {data.verified
                ? 'Buyers see a verified badge on your profile, and your shop appears in their manufacturer list.'
                : 'Until IDEEZA verifies the shop, buyers may not see it at all. Verification is an operations step, not something this screen can do.'}
            </Text>
            <Alert tone="info" className="mt-4" title="No document upload in this build">
              Identity documents need file storage and a review queue, neither of which
              is connected here.
            </Alert>
          </Card>
        )}

        {section === 'paid' && (
          <>
            <Card>
              <CardHeader
                title="Get paid"
                description="What the platform owes you, and how it moves."
              />
              <DefinitionList
                className="mt-4"
                columns={2}
                items={[
                  {
                    label: 'Held against live orders',
                    value: `${data.currency} ${major(data.heldMinor)}`,
                  },
                  { label: 'Payout method', value: 'Not connected' },
                  { label: 'Tax residence', value: 'Not collected yet' },
                ]}
              />
              <div className="mt-4 flex flex-wrap gap-2">
                <Link
                  href="/payouts"
                  className={buttonAppearance({ variant: 'secondary', size: 'sm' })}
                >
                  Payouts & earnings
                </Link>
              </div>
            </Card>
            <Alert tone="info" title="No payment provider is connected">
              The platform records what it owes you and the event that released it. Bank
              details, tax forms and the $IDZ wallet in the design all need a provider,
              which is not part of this build.
            </Alert>
          </>
        )}

        {section === 'notification' && (
          <Card>
            <CardHeader
              title="Notification"
              description="What you want to hear about. At least one product notice stays on."
            />
            <div className="mt-4 flex flex-col gap-3">
              {[
                {
                  id: 'newRequests',
                  label: 'A buyer sends you a request',
                  locked: true,
                },
                { id: 'quoteDecisions', label: 'A buyer decides on your quote', locked: true },
                { id: 'orderMoves', label: 'An order needs you, or a shortage is answered', locked: false },
                { id: 'payouts', label: 'A payout is released', locked: false },
                { id: 'marketing', label: 'News from IDEEZA', locked: false },
              ].map((item) => (
                <Checkbox
                  key={item.id}
                  label={item.label}
                  {...(item.locked
                    ? { description: 'Always on: you would miss work without it.' }
                    : {})}
                  checked={notices[item.id as keyof typeof notices]}
                  disabled={item.locked}
                  onChange={(event: { readonly target: { readonly checked: boolean } }) =>
                    setNotices({ ...notices, [item.id]: event.target.checked })
                  }
                />
              ))}
            </div>
            {prototypeNote}
          </Card>
        )}

        {section === 'language' && (
          <Card>
            <CardHeader title="Language and region" />
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField label="Language">
                <Select
                  options={[
                    { value: 'en', label: 'English' },
                    { value: 'bn', label: 'বাংলা' },
                    { value: 'de', label: 'Deutsch' },
                  ]}
                  value={language}
                  onChange={(event) => setLanguage(event.target.value)}
                />
              </FormField>
              <FormField label="Region format" hint="Dates and numbers.">
                <Select
                  options={[
                    { value: 'BD', label: 'Bangladesh' },
                    { value: 'DE', label: 'Germany' },
                    { value: 'US', label: 'United States' },
                  ]}
                  value={region}
                  onChange={(event) => setRegion(event.target.value)}
                />
              </FormField>
            </div>
            {prototypeNote}
          </Card>
        )}

        {section === 'locking' && (
          <Card>
            <CardHeader
              title="Profile locking"
              description="Stop new requests reaching you without taking your shop down."
            />
            <div className="mt-4">
              <Checkbox
                label="Pause new requests"
                description="Existing orders and quotes are unaffected."
                checked={locked}
                onChange={(event: { readonly target: { readonly checked: boolean } }) =>
                  setLocked(event.target.checked)
                }
              />
            </div>
            <Text size="sm" className="mt-3 block">
              When this is wired, pausing will simply remove you from the buyer&rsquo;s
              manufacturer list — the same mechanism as publishing no services, but
              reversible in one click.
            </Text>
            {prototypeNote}
          </Card>
        )}

        {section === 'policy' && (
          <Card>
            <CardHeader
              title="Policy & privacy"
              description="What the platform records about your shop, and who reads it."
            />
            <ul className="mt-3 flex flex-col gap-2 text-sm text-body">
              <li>
                Buyers see your name, city, rating, on-time delivery, published services,
                certifications and reviews.
              </li>
              <li>
                Buyers never see your stock quantities, your part costs, or any part they
                did not ask about — only how many of their own lines you can cover.
              </li>
              <li>
                Every quote, stage move and record you write is kept as history and can
                be read by IDEEZA operations if a case is opened.
              </li>
              <li>
                Nothing you write in a message counts as a commitment until it is on a
                quote, an order or a case.
              </li>
            </ul>
          </Card>
        )}

        {section === 'activity' && (
          <Card>
            <CardHeader
              title="Activity"
              description="Every action on a quote or an order is on its own screen, in order."
            />
            <Text size="sm" className="mt-2 block">
              The platform keeps an append-only log per record rather than one feed: a
              quote&rsquo;s activity is on the quote, and an order&rsquo;s is on the
              order. That is what a dispute is decided on.
            </Text>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link
                href="/quotes"
                className={buttonAppearance({ variant: 'secondary', size: 'sm' })}
              >
                Quotes
              </Link>
              <Link
                href="/orders"
                className={buttonAppearance({ variant: 'secondary', size: 'sm' })}
              >
                Orders
              </Link>
            </div>
          </Card>
        )}

        {section === 'dispute' && (
          <Card>
            <CardHeader
              title="Dispute"
              description="Cases on your orders, and who decides them."
            />
            <Text size="sm" className="mt-2 block">
              {data.openCaseCount === 0
                ? 'No open cases on your orders.'
                : `${data.openCaseCount} case${data.openCaseCount === 1 ? '' : 's'} on your orders. IDEEZA operations weighs both accounts and records the outcome; the payout follows it.`}
            </Text>
            <div className="mt-4">
              <Link
                href="/orders?status=disputed"
                className={buttonAppearance({ variant: 'secondary', size: 'sm' })}
              >
                Orders with a case
              </Link>
            </div>
          </Card>
        )}
      </div>

      <Modal
        open={editing}
        onClose={() => setEditing(false)}
        title="Edit company information"
        size="md"
        footer={
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="secondary" onClick={() => setEditing(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              loading={pending || !hydrated}
              disabled={!hydrated}
              onClick={save}
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
              onChange={(event) => setCompany({ ...company, legalName: event.target.value })}
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
    </div>
  );
};
