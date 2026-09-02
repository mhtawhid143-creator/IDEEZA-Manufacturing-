'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useTransition, type ReactNode } from 'react';
import {
  Accordion,
  Alert,
  Badge,
  Breadcrumbs,
  Button,
  Card,
  CardHeader,
  Checkbox,
  DefinitionList,
  DropdownMenu,
  EmptyState,
  FormField,
  Icon,
  Input,
  Modal,
  Select,
  Switch,
  Tag,
  Text,
  Textarea,
  buttonAppearance,
  cn,
  majorAmount as major,
  useToast,
} from '@ideeza/ui';
import { saveCompanyAction } from '@/app/(app)/profile/actions.js';
import {
  addPayoutMethodAction,
  changeEmailAction,
  changePasswordAction,
  changePhoneAction,
  clearSecurityQuestionAction,
  deactivateAccountAction,
  reactivateAccountAction,
  removePayoutMethodAction,
  removePhoneAction,
  requestCodeAction,
  requestDeletionAction,
  saveAvatarAction,
  savePreferencesAction,
  saveProfileNameAction,
  saveTaxIdentificationAction,
  saveTaxResidenceAction,
  setDefaultPayoutMethodAction,
  setLoginAlertsAction,
  setNoticeChoiceAction,
  setSecurityQuestionAction,
  setTwoStepAction,
  signOutDeviceAction,
  submitKycHigherAction,
  submitKycLevelOneAction,
  withdrawDeletionAction,
} from '@/app/(app)/settings/actions.js';
import {
  AVATAR_PRESETS,
  COUNTRY_OPTIONS,
  DATE_LOCALE_OPTIONS,
  EMPLOYEE_BANDS,
  LANGUAGE_OPTIONS,
  NOTIFICATION_CHANNEL_ICONS,
  NOTIFICATION_CHANNEL_LABELS,
  NOTIFICATION_TOPIC_LABELS,
  SECURITY_QUESTIONS,
  SETTINGS_GROUPS,
  SETTINGS_SECTIONS,
  TAX_ID_KINDS,
  type SettingsData,
} from './settings-data.js';

/** Every dialog this screen can open, by name. */
type Dialog =
  | 'avatar'
  | 'email'
  | 'phone'
  | 'password'
  | 'twoStep'
  | 'question'
  | 'devices'
  | 'deactivate'
  | 'delete'
  | 'company'
  | 'social'
  | 'kyc2'
  | 'kyc3'
  | 'payout'
  | 'taxResidence'
  | 'taxId'
  | 'withdrawals'
  | null;

const KYC_STATUS: Readonly<
  Record<string, { readonly label: string; readonly tone: 'neutral' | 'warning' | 'success' | 'danger' }>
> = {
  not_submitted: { label: 'Not Submitted', tone: 'neutral' },
  in_review: { label: 'In review', tone: 'warning' },
  approved: { label: 'Approved', tone: 'success' },
  rejected: { label: 'Sent back', tone: 'danger' },
};

/** What each level asks for, in the design's words. */
const KYC_EXPECTATIONS: Readonly<Record<number, readonly string[]>> = {
  2: [
    'All Level 1 data (already collected)',
    'Government-issued photo ID (passport, national ID, or driving licence)',
    'Date of birth',
    'Full residential address',
    'Confirm tax residency country',
  ],
  3: [
    'Everything from Level 2',
    'Proof of address dated within three months',
    'Source of funds statement',
    'Company registration document, where the account trades as a company',
  ],
};

const KYC_UNLOCKS: Readonly<Record<number, string>> = {
  1: 'Activates selling. Nothing can be quoted or paid out until this is approved.',
  2: 'Unlocks at $1,000 of total transactions. Verification required to continue.',
  3: 'Unlocks at $50,000 of total transactions, and for regulated destinations.',
};

/**
 * A row of the design's settings list: words on the left, a control opposite.
 *
 * At module scope on purpose. A component redefined inside the render is a new
 * type every time, so React remounts its children — which takes the focus out
 * of anything interactive the moment a sibling changes.
 */
const Row = ({
  title,
  description,
  control,
}: {
  readonly title: string;
  readonly description?: string;
  readonly control: ReactNode;
}) => (
  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-subtle py-4 last:border-b-0">
    <div className="min-w-0">
      <p className="text-sm font-medium text-text-primary">{title}</p>
      {description !== undefined && (
        <Text tone="muted" size="xs" className="mt-0.5 block max-w-measure">
          {description}
        </Text>
      )}
    </div>
    <div className="shrink-0">{control}</div>
  </div>
);

/**
 * Settings, in the design's shape: a section rail and one pane.
 *
 * Ten panes, and all ten write something. What a person chooses about their
 * name, their picture, their password, their devices, what they are told about
 * and where, which language they read, what is shared, where they are paid and
 * how far their identity check has got — all of it is stored, and every write
 * is scoped to the actor on its first statement.
 *
 * Two things this build cannot do are said out loud rather than mimed: nothing
 * sends email or SMS, so a verification code is shown rather than sent; and
 * IDEEZA decides identity checks and account deletions, so submitting one is
 * where a shop's part ends.
 */
export const SettingsPanels = ({ data }: { readonly data: SettingsData }) => {
  const [section, setSection] = useState<string>('profile');
  const [dialog, setDialog] = useState<Dialog>(null);
  const [hydrated, setHydrated] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | undefined>(undefined);
  const router = useRouter();
  const { push } = useToast();

  useEffect(() => setHydrated(true), []);

  const current = SETTINGS_SECTIONS.find((entry) => entry.id === section);

  // ── forms ────────────────────────────────────────────────────────────────
  const [name, setName] = useState({ firstName: data.firstName, lastName: data.lastName });
  const [avatar, setAvatar] = useState<string | null>(data.avatarPreset);
  const [emailForm, setEmailForm] = useState({ email: '', code: '', sent: '' });
  const [phoneForm, setPhoneForm] = useState({ phone: '', code: '', sent: '' });
  const [passwordForm, setPasswordForm] = useState({ current: '', next: '', confirm: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [twoStep, setTwoStepForm] = useState<'email' | 'sms'>(
    data.twoStepMethod === 'sms' ? 'sms' : 'email',
  );
  const [question, setQuestion] = useState({
    question: data.securityQuestion ?? SECURITY_QUESTIONS[0] ?? '',
    answer: '',
  });
  const [deactivate, setDeactivate] = useState({ reason: '', days: '7' });
  const [deleteReason, setDeleteReason] = useState('');
  const [company, setCompany] = useState({
    displayName: data.displayName,
    legalName: data.legalName,
    tagline: data.tagline,
    about: data.about,
    addressLine1: data.addressLine1,
    addressLine2: data.addressLine2,
    city: data.city,
    region: data.region,
    postalCode: data.postalCode,
    countryCode: data.countryCode,
    phone: data.phone,
    websiteUrl: data.websiteUrl,
    employeeBand: data.employeeBand,
    shippingMethods: data.shippingMethods.join(', '),
  });
  const [social, setSocial] = useState({
    facebookUrl: data.facebookUrl,
    twitterUrl: data.twitterUrl,
    instagramUrl: data.instagramUrl,
    linkedinUrl: data.linkedinUrl,
  });
  const [kycOne, setKycOne] = useState({
    fullLegalName: data.kyc[0]?.fullLegalName ?? '',
    contactEmail: data.kyc[0]?.contactEmail ?? data.memberEmail,
    mobileNumber: data.kyc[0]?.mobileNumber ?? data.memberPhone,
    countryOfResidence: data.kyc[0]?.countryOfResidence ?? '',
    agreedToTerms: data.kyc[0]?.agreedToTerms ?? false,
  });
  const [kycCode, setKycCode] = useState({ sent: '', typed: '' });
  const [kycHigher, setKycHigher] = useState({
    dateOfBirth: '',
    residentialAddress: '',
    taxResidencyCountry: '',
    documentNames: '' as string,
  });
  const [payout, setPayout] = useState({
    kind: 'direct_bank' as 'direct_bank' | 'swift',
    label: '',
    accountName: '',
    accountNumber: '',
    bankName: '',
    swiftCode: '',
    countryCode: data.countryCode,
  });
  const [taxResidence, setTaxResidence] = useState({
    countryCode: data.tax.residenceCountry ?? data.countryCode,
    isUsPerson: data.tax.isUsPerson,
  });
  const [taxId, setTaxId] = useState({ kind: TAX_ID_KINDS[0]?.value ?? 'tin', number: '' });

  // ── one place where every write lands ────────────────────────────────────
  const run = (
    act: () => Promise<{ readonly saved: boolean; readonly error?: string | undefined }>,
    onDone?: () => void,
    title = 'Saved',
  ): void => {
    setError(undefined);
    startTransition(async () => {
      const result = await act();
      if (!result.saved) {
        setError(result.error ?? 'That was not saved.');
        push({ title: result.error ?? 'That was not saved.', tone: 'danger' });
        return;
      }
      onDone?.();
      push({ title, tone: 'success' });
      router.refresh();
    });
  };

  const askForCode = (target: string, into: 'email' | 'phone'): void => {
    setError(undefined);
    startTransition(async () => {
      const result = await requestCodeAction(target);
      if (!result.saved || result.code === undefined) {
        setError(result.error ?? 'No code could be made for that.');
        return;
      }
      if (into === 'email') setEmailForm((f) => ({ ...f, sent: result.code ?? '' }));
      else setPhoneForm((f) => ({ ...f, sent: result.code ?? '' }));
    });
  };

  const noticeOf = (topic: string, channel: string): boolean =>
    data.notices.find((row) => row.topic === topic && row.channel === channel)?.enabled ?? true;

  const noticeLocked = (topic: string, channel: string): boolean =>
    data.notices.find((row) => row.topic === topic && row.channel === channel)?.locked ?? false;

  const paneTitle: Readonly<Record<string, string>> = {
    profile: 'My Profile',
    company: 'Company Information',
    security: 'Security Information',
    kyc: 'KYC Verification',
    paid: 'Get Paid',
    notification: 'Notification Settings',
    language: 'Language Settings',
    locking: 'Profile locking',
    policy: 'Privacy',
    activity: 'Activity',
    dispute: 'Dispute',
  };

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[272px_minmax(0,1fr)]">
      <Card padded={false}>
        <nav aria-label="Settings sections" className="p-2">
          {SETTINGS_GROUPS.map((group) => (
            <div key={group.group === '' ? 'rest' : group.group} className="mb-1">
              {group.group !== '' && (
                <div className="flex items-center gap-2 px-3 py-2">
                  <Icon name={group.icon} size={18} className="text-icon-secondary" />
                  <p className="text-sm font-medium text-text-primary">{group.group}</p>
                </div>
              )}
              <ul className={cn(group.group !== '' && 'ml-4 border-l border-border-subtle pl-2')}>
                {group.items.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => setSection(item.id)}
                      aria-current={section === item.id ? 'page' : undefined}
                      className={cn(
                        'flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus',
                        section === item.id
                          ? 'bg-bg-brand-subtle font-semibold text-text-brand'
                          : 'text-text-secondary hover:bg-bg-surface-raised',
                      )}
                    >
                      <Icon
                        name={item.icon}
                        size={18}
                        className={section === item.id ? 'text-icon-brand' : 'text-icon-secondary'}
                      />
                      {item.label}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
      </Card>

      <div className="flex min-w-0 flex-col gap-4">
        <Breadcrumbs
          items={[
            { label: 'Settings' },
            ...(current?.group === '' || current === undefined
              ? []
              : [{ label: current.group }]),
            { label: current?.label ?? 'Settings' },
          ]}
        />
        <h2 className="text-xl font-semibold text-text-primary">
          {paneTitle[section] ?? 'Settings'}
        </h2>

        {/* ── profile ─────────────────────────────────────────────────────── */}
        {section === 'profile' && (
          <>
            <Card>
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <span
                    aria-hidden
                    className={cn(
                      'inline-flex h-12 w-12 items-center justify-center rounded-lg text-base font-semibold text-text-on-brand',
                      AVATAR_PRESETS.find((preset) => preset.id === data.avatarPreset)?.className ??
                        'bg-bg-subtle text-text-secondary',
                    )}
                  >
                    {data.memberName.slice(0, 1).toUpperCase()}
                  </span>
                  <div>
                    <p className="text-sm font-medium text-text-primary">Profile Picture</p>
                    <Text tone="muted" size="xs">
                      One of the presets. No file is uploaded in this build.
                    </Text>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="tonal"
                    size="sm"
                    leadingIcon={<Icon name="send" size={16} />}
                    onClick={() => {
                      setAvatar(data.avatarPreset);
                      setDialog('avatar');
                    }}
                  >
                    Choose Picture
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={pending || data.avatarPreset === null}
                    onClick={() => run(() => saveAvatarAction(null), undefined, 'Picture removed')}
                  >
                    Remove
                  </Button>
                </div>
              </div>
            </Card>

            <Card>
              <CardHeader
                title="Profile"
                actions={
                  <Button
                    variant="primary"
                    size="sm"
                    leadingIcon={<Icon name="check" size={16} />}
                    loading={pending || !hydrated}
                    disabled={!hydrated}
                    onClick={() => run(() => saveProfileNameAction(name), undefined, 'Profile updated')}
                  >
                    Update
                  </Button>
                }
              />
              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FormField label="First Name" required>
                  <Input
                    value={name.firstName}
                    maxLength={60}
                    placeholder="User Name"
                    onChange={(event) => setName({ ...name, firstName: event.target.value })}
                  />
                </FormField>
                <FormField label="Last Name" required>
                  <Input
                    value={name.lastName}
                    maxLength={60}
                    placeholder="User Name"
                    onChange={(event) => setName({ ...name, lastName: event.target.value })}
                  />
                </FormField>
                <FormField label="Email" required hint="Changing it needs a code.">
                  <div className="flex items-center gap-2">
                    <Input value={data.memberEmail} readOnly className="flex-1" />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setEmailForm({ email: '', code: '', sent: '' });
                        setError(undefined);
                        setDialog('email');
                      }}
                    >
                      Change Email
                    </Button>
                  </div>
                </FormField>
                <FormField
                  label="Phone Number"
                  hint={
                    data.memberPhone === ''
                      ? 'None yet.'
                      : data.phoneVerified
                        ? 'Verified.'
                        : 'Not verified yet.'
                  }
                >
                  {data.memberPhone === '' ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      leadingIcon={<Icon name="plus" size={16} />}
                      onClick={() => {
                        setPhoneForm({ phone: '', code: '', sent: '' });
                        setError(undefined);
                        setDialog('phone');
                      }}
                    >
                      Add Mobile Number
                    </Button>
                  ) : (
                    <div className="flex items-center gap-2">
                      <Input value={data.memberPhone} readOnly className="flex-1" />
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={pending}
                        onClick={() =>
                          run(() => removePhoneAction(), undefined, 'Number removed')
                        }
                      >
                        Remove
                      </Button>
                    </div>
                  )}
                </FormField>
              </div>
            </Card>
          </>
        )}

        {/* ── company information ─────────────────────────────────────────── */}
        {section === 'company' && (
          <>
            <Card>
              <CardHeader
                title="Company Information"
                actions={
                  <Button
                    variant="secondary"
                    size="sm"
                    leadingIcon={<Icon name="file" size={16} />}
                    onClick={() => {
                      setError(undefined);
                      setDialog('company');
                    }}
                  >
                    Edit
                  </Button>
                }
              />
              <div className="mt-4 flex flex-col gap-4">
                <div>
                  <Text tone="muted" size="xs" className="block">
                    Bio
                  </Text>
                  <Text size="sm" className="mt-1 block max-w-measure">
                    {data.tagline === '' ? 'Not written yet.' : data.tagline}
                  </Text>
                </div>
                <div>
                  <Text tone="muted" size="xs" className="block">
                    About
                  </Text>
                  <Text size="sm" className="mt-1 block max-w-measure">
                    {data.about === '' ? 'Not written yet.' : data.about}
                  </Text>
                </div>
                <div>
                  <Text tone="muted" size="xs" className="block">
                    Permanent Address
                  </Text>
                  <div className="mt-2 rounded-xl border border-border-subtle p-4">
                    <DefinitionList
                      items={[
                        {
                          label: 'Country',
                          value:
                            COUNTRY_OPTIONS.find((option) => option.value === data.countryCode)
                              ?.label ?? data.countryCode,
                        },
                        { label: 'City', value: data.city },
                        {
                          label: 'Address',
                          value: [data.addressLine1, data.addressLine2]
                            .filter((line) => line !== '')
                            .join(', '),
                        },
                        {
                          label: 'Shipping Method',
                          value:
                            data.shippingMethods.length === 0
                              ? 'Not stated'
                              : data.shippingMethods.join(', '),
                        },
                        {
                          label: 'Employee',
                          value: data.employeeBand === '' ? 'Not stated' : data.employeeBand,
                        },
                        {
                          label: 'Website',
                          value: data.websiteUrl === '' ? 'Not stated' : data.websiteUrl,
                        },
                      ]}
                    />
                  </div>
                </div>
              </div>
            </Card>

            <Card>
              <CardHeader
                title="Social Media"
                actions={
                  <Button
                    variant="secondary"
                    size="sm"
                    leadingIcon={<Icon name="file" size={16} />}
                    onClick={() => {
                      setError(undefined);
                      setDialog('social');
                    }}
                  >
                    Edit
                  </Button>
                }
              />
              <ul className="mt-4 flex flex-col gap-3">
                {(
                  [
                    ['Facebook', data.facebookUrl],
                    ['Twitter', data.twitterUrl],
                    ['Instagram', data.instagramUrl],
                    ['LinkedIn', data.linkedinUrl],
                  ] as const
                ).map(([label, value]) => (
                  <li key={label} className="flex items-center gap-3">
                    <span
                      aria-hidden
                      className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-bg-brand text-icon-on-brand"
                    >
                      <Icon name="compass" size={14} />
                    </span>
                    <span className="w-24 text-sm text-text-primary">{label}</span>
                    {value === '' ? (
                      <Text tone="muted" size="sm">
                        Not linked
                      </Text>
                    ) : (
                      <a
                        href={value}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="truncate text-sm text-text-link underline"
                      >
                        {value}
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            </Card>
          </>
        )}

        {/* ── security ────────────────────────────────────────────────────── */}
        {section === 'security' && (
          <Card>
            <CardHeader title="Profile Details" />
            <div className="mt-2">
              <Row
                title="Password"
                description={
                  data.hasPassword
                    ? 'Set a unique password to protect your account'
                    : 'This account has no password of its own yet.'
                }
                control={
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={!data.hasPassword}
                    title={
                      data.hasPassword
                        ? undefined
                        : 'Setting a first password needs the sign-in flow, which is where an account gets one.'
                    }
                    onClick={() => {
                      setPasswordForm({ current: '', next: '', confirm: '' });
                      setError(undefined);
                      setDialog('password');
                    }}
                  >
                    {data.hasPassword ? 'Change Password' : 'Set Password'}
                  </Button>
                }
              />
              <Row
                title="2-Step verification"
                description={
                  data.twoStepEnabled
                    ? `On, by ${data.twoStepMethod === 'sms' ? 'SMS' : 'email'}.`
                    : 'Make your account extra secure'
                }
                control={
                  <Switch
                    label="2-Step verification"
                    labelHidden
                    checked={data.twoStepEnabled}
                    disabled={pending}
                    onChange={(event) => {
                      if (event.target.checked) {
                        setTwoStepForm(data.twoStepMethod === 'sms' ? 'sms' : 'email');
                        setError(undefined);
                        setDialog('twoStep');
                        return;
                      }
                      run(
                        () => setTwoStepAction(false, 'email'),
                        undefined,
                        '2-Step verification off',
                      );
                    }}
                  />
                }
              />
              <Row
                title="Security Question"
                description={
                  data.securityQuestion ??
                  'Confirm your identity with a question only you know the answer to.'
                }
                control={
                  <Switch
                    label="Security question"
                    labelHidden
                    checked={data.securityQuestion !== null}
                    disabled={pending}
                    onChange={(event) => {
                      if (event.target.checked) {
                        setQuestion({
                          question: SECURITY_QUESTIONS[0] ?? '',
                          answer: '',
                        });
                        setError(undefined);
                        setDialog('question');
                        return;
                      }
                      run(
                        () => clearSecurityQuestionAction(),
                        undefined,
                        'Security question removed',
                      );
                    }}
                  />
                }
              />
              <Row
                title="Login Alerts"
                description="Every time you login you will get a notification"
                control={
                  <Switch
                    label="Login alerts"
                    labelHidden
                    checked={data.loginAlerts}
                    disabled={pending}
                    onChange={(event) =>
                      run(
                        () => setLoginAlertsAction(event.target.checked),
                        undefined,
                        event.target.checked ? 'Login alerts on' : 'Login alerts off',
                      )
                    }
                  />
                }
              />
              <Row
                title="Where you logged in"
                description={`View all the devices your account is logged in — ${String(data.devices.length)} now`}
                control={
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label="Where you logged in"
                    onClick={() => setDialog('devices')}
                  >
                    <Icon name="chevron-right" size={20} />
                  </Button>
                }
              />
              <Row
                title="Deactivate Account"
                description={
                  data.deactivatedOn === null
                    ? 'This will shut down your account, and it will show as online whenever you log in.'
                    : `Deactivated on ${data.deactivatedOn}. It comes back on ${data.reactivateOn ?? 'the chosen day'}.`
                }
                control={
                  data.deactivatedOn === null ? (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        setDeactivate({ reason: '', days: '7' });
                        setError(undefined);
                        setDialog('deactivate');
                      }}
                    >
                      Deactivate
                    </Button>
                  ) : (
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={pending}
                      onClick={() =>
                        run(() => reactivateAccountAction(), undefined, 'Account active again')
                      }
                    >
                      Reactivate
                    </Button>
                  )
                }
              />
              <Row
                title="Delete Account"
                description={
                  data.deletionRequestedOn === null
                    ? 'Delete your account from IDEEZA'
                    : `Asked for on ${data.deletionRequestedOn}. IDEEZA answers it.`
                }
                control={
                  data.deletionRequestedOn === null ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label="Delete Account"
                      onClick={() => {
                        setDeleteReason('');
                        setError(undefined);
                        setDialog('delete');
                      }}
                    >
                      <Icon name="chevron-right" size={20} />
                    </Button>
                  ) : (
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={pending}
                      onClick={() =>
                        run(() => withdrawDeletionAction(), undefined, 'Request withdrawn')
                      }
                    >
                      Withdraw request
                    </Button>
                  )
                }
              />
            </div>
          </Card>
        )}

        {/* ── KYC ─────────────────────────────────────────────────────────── */}
        {section === 'kyc' && (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)]">
            <Card padded={false}>
              <ul className="flex flex-col gap-3 p-4">
                {data.kyc.map((level) => {
                  const state = KYC_STATUS[level.status] ?? KYC_STATUS['not_submitted'];
                  return (
                    <li
                      key={level.level}
                      className={cn(
                        'rounded-xl border p-4',
                        level.level === 1 ? 'border-border-brand' : 'border-border-subtle',
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <Icon name="check-circle" size={18} className="text-icon-brand" />
                          <p className="text-sm font-semibold text-text-primary">
                            {level.level === 1
                              ? 'Verify Your Identity'
                              : level.level === 2
                                ? 'Intermediate KYC'
                                : 'Enhanced KYC'}
                          </p>
                        </div>
                        <Badge tone={state?.tone ?? 'neutral'}>
                          {state?.label ?? 'Not Submitted'}
                        </Badge>
                      </div>
                      <Text tone="muted" size="xs" className="mt-2 block">
                        {KYC_UNLOCKS[level.level]}
                      </Text>
                      {level.rejectReason !== null && (
                        <Text size="xs" className="mt-2 block text-text-error">
                          {level.rejectReason}
                        </Text>
                      )}
                    </li>
                  );
                })}
              </ul>
            </Card>

            <Card>
              <div className="flex items-center gap-2">
                <Icon name="check-circle" size={20} className="text-icon-brand" />
                <h3 className="text-base font-semibold text-text-primary">
                  Identity Verification
                </h3>
              </div>

              {data.kyc[0]?.status === 'approved' ? (
                <>
                  <Text tone="muted" size="sm" className="mt-2 block">
                    Level 1 is approved. One more step to complete your payment.
                  </Text>
                  <div className="mt-4 rounded-xl bg-bg-subtle p-4">
                    <p className="text-sm font-semibold text-text-primary">What to Expect:</p>
                    <ul className="mt-2 flex list-disc flex-col gap-1 pl-5">
                      {(KYC_EXPECTATIONS[2] ?? []).map((line) => (
                        <li key={line} className="text-sm text-text-secondary">
                          {line}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="mt-4">
                    <Button
                      variant="primary"
                      disabled={data.kyc[1]?.status === 'in_review'}
                      onClick={() => {
                        setKycHigher({
                          dateOfBirth: data.kyc[1]?.dateOfBirth ?? '',
                          residentialAddress: data.kyc[1]?.residentialAddress ?? '',
                          taxResidencyCountry: data.kyc[1]?.taxResidencyCountry ?? '',
                          documentNames: (data.kyc[1]?.documentNames ?? []).join(', '),
                        });
                        setError(undefined);
                        setDialog('kyc2');
                      }}
                    >
                      {data.kyc[1]?.status === 'in_review'
                        ? 'Level 2 is with IDEEZA'
                        : 'Start KYC Verification'}
                    </Button>
                  </div>
                  {data.kyc[1]?.status === 'approved' && (
                    <div className="mt-4 border-t border-border-subtle pt-4">
                      <p className="text-sm font-semibold text-text-primary">
                        Enhanced verification
                      </p>
                      <ul className="mt-2 flex list-disc flex-col gap-1 pl-5">
                        {(KYC_EXPECTATIONS[3] ?? []).map((line) => (
                          <li key={line} className="text-sm text-text-secondary">
                            {line}
                          </li>
                        ))}
                      </ul>
                      <Button
                        variant="primary"
                        className="mt-3"
                        disabled={data.kyc[2]?.status === 'in_review'}
                        onClick={() => {
                          setKycHigher({
                            dateOfBirth: data.kyc[2]?.dateOfBirth ?? '',
                            residentialAddress: data.kyc[2]?.residentialAddress ?? '',
                            taxResidencyCountry: data.kyc[2]?.taxResidencyCountry ?? '',
                            documentNames: (data.kyc[2]?.documentNames ?? []).join(', '),
                          });
                          setError(undefined);
                          setDialog('kyc3');
                        }}
                      >
                        {data.kyc[2]?.status === 'in_review'
                          ? 'Level 3 is with IDEEZA'
                          : 'Start Level 3'}
                      </Button>
                    </div>
                  )}
                </>
              ) : (
                <div className="mt-4 flex flex-col gap-4">
                  {data.kyc[0]?.status === 'in_review' && (
                    <Alert tone="info" title="With IDEEZA">
                      Submitted on {data.kyc[0].submittedOn ?? 'a recent day'}. IDEEZA answers it;
                      nothing here approves an identity check.
                    </Alert>
                  )}
                  <FormField label="Full Legal Name" required>
                    <Input
                      value={kycOne.fullLegalName}
                      maxLength={120}
                      placeholder="Enter your full legal name"
                      onChange={(event) =>
                        setKycOne({ ...kycOne, fullLegalName: event.target.value })
                      }
                    />
                  </FormField>
                  <FormField label="Email Address" required>
                    <Input
                      value={kycOne.contactEmail}
                      maxLength={160}
                      placeholder="Enter verified email address"
                      onChange={(event) =>
                        setKycOne({ ...kycOne, contactEmail: event.target.value })
                      }
                    />
                  </FormField>
                  <FormField
                    label="Mobile Number"
                    required
                    hint={
                      kycCode.sent === ''
                        ? 'The number IDEEZA can reach you on.'
                        : 'Type the code to confirm the number is yours.'
                    }
                  >
                    <div className="flex items-center gap-2">
                      <Input
                        value={kycOne.mobileNumber}
                        maxLength={32}
                        className="flex-1"
                        placeholder="+8801XXXXXXXXX"
                        onChange={(event) =>
                          setKycOne({ ...kycOne, mobileNumber: event.target.value })
                        }
                      />
                      <Button
                        variant="secondary"
                        size="sm"
                        disabled={pending || kycOne.mobileNumber.replace(/\D/g, '').length < 8}
                        onClick={() => {
                          setError(undefined);
                          startTransition(async () => {
                            const result = await requestCodeAction(kycOne.mobileNumber);
                            if (!result.saved || result.code === undefined) {
                              setError(result.error ?? 'No code could be made for that.');
                              return;
                            }
                            setKycCode({ sent: result.code, typed: '' });
                          });
                        }}
                      >
                        {kycCode.sent === '' ? 'Send OTP' : 'Resend'}
                      </Button>
                    </div>
                  </FormField>
                  {kycCode.sent !== '' && (
                    <>
                      {/*
                        The design sends an OTP here. Nothing in this build sends
                        one, so it is shown — and confirming it verifies the
                        number on the account, which is the thing the step was
                        for.
                      */}
                      <Alert tone="info" title="No SMS is sent in this build">
                        The code for that number is <strong>{kycCode.sent}</strong>.
                      </Alert>
                      <FormField label="Verification code" required>
                        <div className="flex items-center gap-2">
                          <Input
                            value={kycCode.typed}
                            maxLength={6}
                            inputMode="numeric"
                            className="flex-1"
                            onChange={(event) =>
                              setKycCode({ ...kycCode, typed: event.target.value })
                            }
                          />
                          <Button
                            variant="secondary"
                            size="sm"
                            disabled={pending}
                            onClick={() =>
                              run(
                                () => changePhoneAction(kycOne.mobileNumber, kycCode.typed),
                                () => setKycCode({ sent: '', typed: '' }),
                                'Number verified',
                              )
                            }
                          >
                            Verify
                          </Button>
                        </div>
                      </FormField>
                    </>
                  )}
                  {data.phoneVerified && data.memberPhone === kycOne.mobileNumber && (
                    <Text size="xs" className="block text-text-success">
                      This number is verified on your account.
                    </Text>
                  )}
                  <FormField label="Country of Residence" required>
                    <Select
                      options={COUNTRY_OPTIONS}
                      placeholder="Select country"
                      value={kycOne.countryOfResidence}
                      onChange={(event) =>
                        setKycOne({ ...kycOne, countryOfResidence: event.target.value })
                      }
                    />
                  </FormField>
                  <Checkbox
                    label="I agree to the Marketplace Seller Terms and understand that my information will be used for identity verification purposes"
                    checked={kycOne.agreedToTerms}
                    onChange={(event) =>
                      setKycOne({ ...kycOne, agreedToTerms: event.target.checked })
                    }
                  />
                  {error !== undefined && (
                    <Alert tone="danger" title="Not submitted">
                      {error}
                    </Alert>
                  )}
                  <div className="flex justify-end">
                    <Button
                      variant="primary"
                      loading={pending || !hydrated}
                      disabled={
                        !hydrated ||
                        kycOne.fullLegalName.trim() === '' ||
                        kycOne.countryOfResidence === '' ||
                        !kycOne.agreedToTerms
                      }
                      onClick={() =>
                        run(
                          () => submitKycLevelOneAction(kycOne),
                          undefined,
                          'Submitted for review',
                        )
                      }
                    >
                      Submit for Review
                    </Button>
                  </div>
                </div>
              )}

              <div className="mt-5 flex items-start gap-2 border-t border-border-subtle pt-4">
                <Icon name="flag" size={16} className="mt-0.5 text-icon-secondary" />
                <Text tone="muted" size="xs" className="block max-w-measure">
                  <strong className="text-text-primary">Data Security:</strong> what you type here
                  is stored for the check. No identity document is uploaded or kept — this build
                  records the names of what you offered, and nothing else.
                </Text>
              </div>
            </Card>
          </div>
        )}

        {/* ── get paid ────────────────────────────────────────────────────── */}
        {section === 'paid' && (
          <>
            <div className="flex flex-wrap items-center justify-end gap-2">
              <Button
                variant="tonal"
                size="sm"
                onClick={() => setDialog('withdrawals')}
              >
                View Withdraw History
              </Button>
            </div>

            <Card>
              <CardHeader title="Earning Information" />
              <div className="mt-2">
                <Row
                  title="Balance"
                  description="What is released to you, and what is still held against orders in flight"
                  control={
                    <div className="text-right">
                      <p className="text-base font-semibold text-text-primary" data-numeric>
                        {data.currency} {major(data.availableMinor)}
                      </p>
                      <Text tone="muted" size="xs">
                        {data.currency} {major(data.heldMinor)} held
                      </Text>
                    </div>
                  }
                />
              </div>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                <Text tone="muted" size="sm">
                  Where IDEEZA pays it
                </Text>
                <Button
                  variant="tonal"
                  size="xs"
                  leadingIcon={<Icon name="plus" size={16} />}
                  onClick={() => {
                    setError(undefined);
                    setDialog('payout');
                  }}
                >
                  Add method
                </Button>
              </div>
              {data.payoutMethods.length === 0 ? (
                <div className="mt-3">
                  <EmptyState
                    title="No payout method yet"
                    description="A released payout has nowhere to go until one is added."
                  />
                </div>
              ) : (
                <ul className="mt-3 flex flex-col gap-3">
                  {data.payoutMethods.map((method) => (
                    <li
                      key={method.id}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border-subtle p-4"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-text-primary">
                          {method.label} · ····{method.accountLast4}
                        </p>
                        <Text tone="muted" size="xs">
                          {method.accountName} ·{' '}
                          {method.kind === 'swift'
                            ? (method.swiftCode ?? 'SWIFT')
                            : (method.bankName ?? 'Bank')}{' '}
                          · {method.countryCode}
                        </Text>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        {method.isDefault ? (
                          <Badge tone="success">Default</Badge>
                        ) : (
                          <Button
                            variant="ghost"
                            size="xs"
                            disabled={pending}
                            onClick={() =>
                              run(
                                () => setDefaultPayoutMethodAction(method.id),
                                undefined,
                                'Default changed',
                              )
                            }
                          >
                            Make default
                          </Button>
                        )}
                        <DropdownMenu
                          label={`Actions for ${method.label}`}
                          items={[
                            {
                              id: 'delete',
                              label: 'Delete',
                              tone: 'danger',
                              onSelect: () =>
                                run(
                                  () => removePayoutMethodAction(method.id),
                                  undefined,
                                  'Method removed',
                                ),
                            },
                          ]}
                          trigger={({ ref, onClick, ...aria }) => (
                            <button
                              ref={ref}
                              type="button"
                              onClick={onClick}
                              disabled={pending}
                              aria-label={`Actions for ${method.label}`}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-text-tertiary hover:bg-bg-surface-raised focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus"
                              {...aria}
                            >
                              <Icon name="more" size={20} />
                            </button>
                          )}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card>
              <CardHeader title="Tax Information" />
              <div className="mt-2">
                <Row
                  title="Tax Residence"
                  description={
                    data.tax.residenceCountry === null
                      ? 'Update your tax details'
                      : `${data.tax.residenceCountry}${data.tax.isUsPerson ? ' · US person' : ''}`
                  }
                  control={
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label="Tax Residence"
                      onClick={() => {
                        setError(undefined);
                        setDialog('taxResidence');
                      }}
                    >
                      <Icon name="chevron-right" size={20} />
                    </Button>
                  }
                />
                <Row
                  title="Tax Identification"
                  description={
                    data.tax.taxIdLast4 === null
                      ? 'Verify whether IDEEZA needs to withhold taxes from your earnings'
                      : `${data.tax.taxIdKind?.toUpperCase() ?? 'ID'} ending ${data.tax.taxIdLast4}`
                  }
                  control={
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label="Tax Identification"
                      onClick={() => {
                        setTaxId({ kind: data.tax.taxIdKind ?? 'tin', number: '' });
                        setError(undefined);
                        setDialog('taxId');
                      }}
                    >
                      <Icon name="chevron-right" size={20} />
                    </Button>
                  }
                />
              </div>
              <Text tone="muted" size="xs" className="mt-3 block max-w-measure">
                Only the last four characters of a tax number are kept. What is not stored cannot
                leak, and four is enough to show you which number you gave.
              </Text>
            </Card>
          </>
        )}

        {/* ── notification ───────────────────────────────────────────────── */}
        {section === 'notification' && (
          <>
            <Card>
              <CardHeader title="What notification you receive" />
              <Accordion
                className="mt-2"
                label="Notification topics"
                items={Object.keys(NOTIFICATION_TOPIC_LABELS).map((topic) => ({
                  id: topic,
                  title: NOTIFICATION_TOPIC_LABELS[topic] ?? topic,
                  description: 'Push, Email & Mobile App',
                  content: (
                    <div className="flex flex-col gap-3">
                      <p className="text-sm font-semibold text-text-primary">
                        Where you receive these notification
                      </p>
                      {Object.keys(NOTIFICATION_CHANNEL_LABELS).map((channel) => (
                        <div key={channel} className="flex items-center justify-between gap-3">
                          <span className="flex items-center gap-2 text-sm text-text-secondary">
                            <Icon
                              name={NOTIFICATION_CHANNEL_ICONS[channel] ?? 'bell'}
                              size={16}
                              className="text-icon-secondary"
                            />
                            {NOTIFICATION_CHANNEL_LABELS[channel] ?? channel}
                          </span>
                          <span className="flex items-center gap-2">
                            {noticeLocked(topic, channel) && (
                              <Text tone="muted" size="xs">
                                Always on
                              </Text>
                            )}
                            <Switch
                              label={`${NOTIFICATION_TOPIC_LABELS[topic] ?? topic} by ${
                                NOTIFICATION_CHANNEL_LABELS[channel] ?? channel
                              }`}
                              labelHidden
                              checked={noticeOf(topic, channel)}
                              disabled={pending || noticeLocked(topic, channel)}
                              onChange={(event) =>
                                run(
                                  () =>
                                    setNoticeChoiceAction(topic, channel, event.target.checked),
                                  undefined,
                                  'Notification preference saved',
                                )
                              }
                            />
                          </span>
                        </div>
                      ))}
                    </div>
                  ),
                }))}
              />
            </Card>

            <Card>
              <CardHeader title="Where you receive notification" />
              <Accordion
                className="mt-2"
                label="Notification destinations"
                items={[
                  {
                    id: 'browser',
                    title: 'Browser',
                    description: 'See which browser you are currently active',
                    content:
                      data.devices.length === 0 ? (
                        <Text tone="muted" size="sm">
                          No active session but this one.
                        </Text>
                      ) : (
                        <ul className="flex flex-col gap-2">
                          {data.devices.map((device) => (
                            <li key={device.id} className="text-sm text-text-secondary">
                              {device.name} · {device.where} · {device.seen}
                              {device.current ? ' · this one' : ''}
                            </li>
                          ))}
                        </ul>
                      ),
                  },
                  {
                    id: 'email',
                    title: 'Email',
                    description: 'See which email address will get all the notifications',
                    content: (
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <Text size="sm">{data.memberEmail}</Text>
                        <Button
                          variant="ghost"
                          size="xs"
                          onClick={() => {
                            setEmailForm({ email: '', code: '', sent: '' });
                            setDialog('email');
                          }}
                        >
                          Change
                        </Button>
                      </div>
                    ),
                  },
                  {
                    id: 'sms',
                    title: 'SMS',
                    description: 'See which number will get all the notifications',
                    content: (
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <Text size="sm">
                          {data.memberPhone === '' ? 'No number yet' : data.memberPhone}
                        </Text>
                        <Button
                          variant="ghost"
                          size="xs"
                          onClick={() => {
                            setPhoneForm({ phone: '', code: '', sent: '' });
                            setDialog('phone');
                          }}
                        >
                          {data.memberPhone === '' ? 'Add' : 'Change'}
                        </Button>
                      </div>
                    ),
                  },
                ]}
              />
            </Card>
          </>
        )}

        {/* ── language ───────────────────────────────────────────────────── */}
        {section === 'language' && (
          <>
            <Card>
              <CardHeader title="App Language" />
              <div className="mt-2">
                <Row
                  title="Account Language"
                  description="See buttons, titles and other text in your preferred language."
                  control={
                    <Select
                      aria-label="Account Language"
                      className="min-w-[190px]"
                      options={LANGUAGE_OPTIONS}
                      value={data.language}
                      disabled={pending}
                      onChange={(event) =>
                        run(
                          () => savePreferencesAction({ language: event.target.value }),
                          undefined,
                          'Language saved',
                        )
                      }
                    />
                  }
                />
              </div>
              <Text tone="muted" size="xs" className="mt-3 block max-w-measure">
                The choice is stored and dates and numbers follow it. The words on the screen are
                English everywhere in this build — translating them is its own piece of work, and
                pretending otherwise would leave you choosing a language nothing answers in.
              </Text>
            </Card>

            <Card>
              <CardHeader title="Time Formatting" />
              <div className="mt-2">
                <Row
                  title="Date & Time Formatting"
                  description="Formats for dates, times and numbers"
                  control={
                    <Select
                      aria-label="Date & Time Formatting"
                      className="min-w-[220px]"
                      options={DATE_LOCALE_OPTIONS}
                      value={data.dateLocale}
                      disabled={pending}
                      onChange={(event) =>
                        run(
                          () => savePreferencesAction({ dateLocale: event.target.value }),
                          undefined,
                          'Format saved',
                        )
                      }
                    />
                  }
                />
              </div>
              <Text tone="muted" size="xs" className="mt-3 block">
                Today reads{' '}
                <strong className="text-text-primary">
                  {new Intl.DateTimeFormat(data.dateLocale, { dateStyle: 'long' }).format(
                    new Date(),
                  )}
                </strong>{' '}
                in this format.
              </Text>
            </Card>
          </>
        )}

        {/* ── profile locking ────────────────────────────────────────────── */}
        {section === 'locking' && (
          <Card>
            <CardHeader title="Profile locking" />
            <div className="mt-2">
              <Row
                title="Lock this profile"
                description="While it is locked, buyers cannot be routed a request to you and your profile is not listed."
                control={
                  <Switch
                    label="Lock this profile"
                    labelHidden
                    checked={data.profileLocked}
                    disabled={pending}
                    onChange={(event) =>
                      run(
                        () => savePreferencesAction({ profileLocked: event.target.checked }),
                        undefined,
                        event.target.checked ? 'Profile locked' : 'Profile unlocked',
                      )
                    }
                  />
                }
              />
            </div>
            {data.profileLocked && (
              <Alert tone="warning" title="Nothing will reach you while this is on" className="mt-4">
                A locked profile is the same as having no published services: a buyer&rsquo;s
                request cannot be routed to you. Orders already in production carry on.
              </Alert>
            )}
          </Card>
        )}

        {/* ── policy & privacy ───────────────────────────────────────────── */}
        {section === 'policy' && (
          <>
            <Card>
              <CardHeader title="Social Share" />
              <div className="mt-2">
                <Row
                  title="Share activity on Facebook (Recommended)"
                  description="Share activity with facebook friends that are also on IDEEZA"
                  control={
                    <Switch
                      label="Share activity on Facebook"
                      labelHidden
                      checked={data.shareActivityOnFacebook}
                      disabled={pending}
                      onChange={(event) =>
                        run(
                          () =>
                            savePreferencesAction({
                              shareActivityOnFacebook: event.target.checked,
                            }),
                          undefined,
                          'Saved',
                        )
                      }
                    />
                  }
                />
                <Row
                  title="Publish wishlist automatically on Facebook"
                  description="Share your wishlist on facebook"
                  control={
                    <Switch
                      label="Publish wishlist on Facebook"
                      labelHidden
                      checked={data.publishWishlistOnFacebook}
                      disabled={pending}
                      onChange={(event) =>
                        run(
                          () =>
                            savePreferencesAction({
                              publishWishlistOnFacebook: event.target.checked,
                            }),
                          undefined,
                          'Saved',
                        )
                      }
                    />
                  }
                />
                <Row
                  title="Link with search engine"
                  description="When this setting is on, search engines may link to your profile in their results."
                  control={
                    <Switch
                      label="Link with search engine"
                      labelHidden
                      checked={data.linkWithSearchEngine}
                      disabled={pending}
                      onChange={(event) =>
                        run(
                          () =>
                            savePreferencesAction({ linkWithSearchEngine: event.target.checked }),
                          undefined,
                          'Saved',
                        )
                      }
                    />
                  }
                />
              </div>
              <Text tone="muted" size="xs" className="mt-3 block max-w-measure">
                Your choice is stored and read wherever it applies. Nothing is posted to Facebook
                from this build — there is no connection to it — so the first two say what you
                want rather than what has happened.
              </Text>
            </Card>

            <Card>
              <CardHeader title="Policies" />
              <ul className="mt-3 flex flex-col gap-2">
                {(
                  [
                    ['Terms of service', '/policies/terms'],
                    ['Privacy policy', '/policies/privacy'],
                    ['Marketplace seller terms', '/policies/seller-terms'],
                  ] as const
                ).map(([label, href]) => (
                  <li key={href}>
                    <Link
                      href={href}
                      className={buttonAppearance({ variant: 'ghost', size: 'sm' })}
                    >
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          </>
        )}

        {/* ── activity ───────────────────────────────────────────────────── */}
        {section === 'activity' && (
          <Card>
            <CardHeader title="Actions you have done in IDEEZA" />
            {data.activity.length === 0 ? (
              <div className="mt-4">
                <EmptyState
                  title="Nothing recorded yet"
                  description="Every act the platform stores — a quote sent, an order moved, a payout released — appears here."
                />
              </div>
            ) : (
              <div className="mt-2">
                {[...new Set(data.activity.map((row) => row.day))].map((day) => (
                  <div key={day}>
                    <p className="pt-4 text-xs text-text-tertiary">{day}</p>
                    <ul>
                      {data.activity
                        .filter((row) => row.day === day)
                        .map((row) => (
                          <li
                            key={row.id}
                            className="flex items-start justify-between gap-4 border-b border-border-subtle py-3 last:border-b-0"
                          >
                            <p className="min-w-0 text-sm font-medium text-text-primary">
                              {row.text}
                            </p>
                            <Text tone="muted" size="xs" className="shrink-0">
                              {row.time}
                            </Text>
                          </li>
                        ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </Card>
        )}

        {/* ── dispute ────────────────────────────────────────────────────── */}
        {section === 'dispute' && (
          <Card>
            <CardHeader
              title="Disputes on your orders"
              description="Both the open ones and the ones already answered. A manufacturer cannot cancel an order — a dispute is how a disagreement is raised."
            />
            {data.disputes.length === 0 ? (
              <div className="mt-4">
                <EmptyState
                  title="No disputes"
                  description="Nothing has been raised against your orders, and you have raised nothing."
                />
              </div>
            ) : (
              <Accordion
                className="mt-2"
                label="Disputes"
                items={data.disputes.map((dispute) => ({
                  id: dispute.id,
                  title: `${dispute.productName} · ${dispute.reason.replace(/_/g, ' ')}`,
                  description: `${dispute.resolvedOn === null ? 'Open' : 'Resolved'} · opened ${dispute.openedOn}${
                    dispute.openedByYou ? ' by you' : ' by the buyer'
                  }`,
                  content: (
                    <div className="flex flex-col gap-3">
                      <DefinitionList
                        columns={2}
                        items={[
                          { label: 'Order', value: dispute.orderId },
                          { label: 'Status', value: dispute.status.replace(/_/g, ' ') },
                          {
                            label: 'Outcome',
                            value:
                              dispute.outcome === null
                                ? 'Not decided'
                                : dispute.outcome.replace(/_/g, ' '),
                          },
                          { label: 'Resolved', value: dispute.resolvedOn ?? 'Not yet' },
                        ]}
                      />
                      <div className="flex flex-wrap gap-2">
                        <Link
                          href={`/orders/${dispute.orderId}`}
                          className={buttonAppearance({ variant: 'secondary', size: 'sm' })}
                        >
                          Open the order
                        </Link>
                        <Link
                          href="/messages"
                          className={buttonAppearance({ variant: 'ghost', size: 'sm' })}
                        >
                          Message about it
                        </Link>
                      </div>
                      <Text tone="muted" size="xs" className="block max-w-measure">
                        Only IDEEZA decides a dispute. What a shop can do is answer it with
                        evidence, which is done on the order.
                      </Text>
                    </div>
                  ),
                }))}
              />
            )}
          </Card>
        )}
      </div>

      {/* ── dialogs ───────────────────────────────────────────────────────── */}
      <Modal
        open={dialog === 'avatar'}
        onClose={() => setDialog(null)}
        title="Upload Profile Picture"
        description="Pick one of the presets. No file leaves your machine in this build."
        size="sm"
        footer={
          <div className="grid w-full grid-cols-2 gap-3">
            <Button variant="secondary" fullWidth onClick={() => setDialog(null)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              fullWidth
              loading={pending || !hydrated}
              disabled={!hydrated}
              onClick={() =>
                run(() => saveAvatarAction(avatar), () => setDialog(null), 'Picture updated')
              }
            >
              Update
            </Button>
          </div>
        }
      >
        <div className="flex flex-col items-center gap-4">
          <span
            aria-hidden
            className={cn(
              'inline-flex h-20 w-20 items-center justify-center rounded-full text-xl font-semibold text-text-on-brand',
              AVATAR_PRESETS.find((preset) => preset.id === avatar)?.className ??
                'bg-bg-subtle text-text-secondary',
            )}
          >
            {data.memberName.slice(0, 1).toUpperCase()}
          </span>
          <div className="flex flex-wrap justify-center gap-3" role="radiogroup" aria-label="Presets">
            {/*
              The design's first tile uploads a file. There is nowhere to put
              one, so it says what it is instead of opening a picker that would
              drop what was chosen.
            */}
            <span
              aria-hidden
              title="Uploading a file is not built yet"
              className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-dashed border-border text-text-disabled"
            >
              <Icon name="plus" size={18} />
            </span>
            {AVATAR_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                role="radio"
                aria-checked={avatar === preset.id}
                aria-label={preset.label}
                onClick={() => setAvatar(preset.id)}
                className={cn(
                  'h-12 w-12 rounded-full transition-shadow focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus',
                  preset.className,
                  avatar === preset.id && 'ring-3 ring-border-brand',
                )}
              />
            ))}
          </div>
          {error !== undefined && (
            <Alert tone="danger" title="Not saved">
              {error}
            </Alert>
          )}
        </div>
      </Modal>

      <Modal
        open={dialog === 'email'}
        onClose={() => setDialog(null)}
        title="Change Email"
        description="A code confirms it is you."
        size="sm"
        footer={
          <div className="grid w-full grid-cols-2 gap-3">
            <Button variant="secondary" fullWidth onClick={() => setDialog(null)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              fullWidth
              loading={pending || !hydrated}
              disabled={!hydrated}
              onClick={() =>
                emailForm.sent === ''
                  ? askForCode(emailForm.email, 'email')
                  : run(
                      () => changeEmailAction(emailForm.email, emailForm.code),
                      () => setDialog(null),
                      'Email changed',
                    )
              }
            >
              {emailForm.sent === '' ? 'Continue' : 'Set Verification'}
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          <FormField label="New email address" required>
            <Input
              value={emailForm.email}
              maxLength={160}
              placeholder="you@example.com"
              onChange={(event) =>
                setEmailForm({ ...emailForm, email: event.target.value, sent: '' })
              }
            />
          </FormField>
          {emailForm.sent !== '' && (
            <>
              {/*
                Nothing here sends mail, so the code is shown rather than
                claimed to have been sent. Saying "check your inbox" would send
                a person to look for something that was never posted.
              */}
              <Alert tone="info" title="No mail is sent in this build">
                The code for that address is <strong>{emailForm.sent}</strong>. It is good for ten
                minutes.
              </Alert>
              <FormField label="Verification code" required>
                <Input
                  value={emailForm.code}
                  maxLength={6}
                  inputMode="numeric"
                  onChange={(event) => setEmailForm({ ...emailForm, code: event.target.value })}
                />
              </FormField>
            </>
          )}
          {error !== undefined && (
            <Alert tone="danger" title="Not changed">
              {error}
            </Alert>
          )}
        </div>
      </Modal>

      <Modal
        open={dialog === 'phone'}
        onClose={() => setDialog(null)}
        title="Verification"
        description="Add Mobile Number"
        size="sm"
        footer={
          <div className="grid w-full grid-cols-2 gap-3">
            <Button variant="secondary" fullWidth onClick={() => setDialog(null)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              fullWidth
              loading={pending || !hydrated}
              disabled={!hydrated}
              onClick={() =>
                phoneForm.sent === ''
                  ? askForCode(phoneForm.phone, 'phone')
                  : run(
                      () => changePhoneAction(phoneForm.phone, phoneForm.code),
                      () => setDialog(null),
                      'Number verified',
                    )
              }
            >
              {phoneForm.sent === '' ? 'Continue' : 'Set Verification'}
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          <FormField label="Phone Number" required>
            <Input
              value={phoneForm.phone}
              maxLength={32}
              placeholder="+8801XXXXXXXXX"
              onChange={(event) =>
                setPhoneForm({ ...phoneForm, phone: event.target.value, sent: '' })
              }
            />
          </FormField>
          {phoneForm.sent !== '' && (
            <>
              <Alert tone="info" title="No SMS is sent in this build">
                The code for that number is <strong>{phoneForm.sent}</strong>. It is good for ten
                minutes.
              </Alert>
              <FormField label="Verification code" required>
                <Input
                  value={phoneForm.code}
                  maxLength={6}
                  inputMode="numeric"
                  onChange={(event) => setPhoneForm({ ...phoneForm, code: event.target.value })}
                />
              </FormField>
            </>
          )}
          {error !== undefined && (
            <Alert tone="danger" title="Not verified">
              {error}
            </Alert>
          )}
        </div>
      </Modal>

      <Modal
        open={dialog === 'password'}
        onClose={() => setDialog(null)}
        title="Update Password"
        description="Changing it signs your other devices out."
        size="sm"
        footer={
          <div className="grid w-full grid-cols-2 gap-3">
            <Button variant="secondary" fullWidth onClick={() => setDialog(null)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              fullWidth
              loading={pending || !hydrated}
              disabled={!hydrated}
              onClick={() =>
                run(
                  () =>
                    changePasswordAction(
                      passwordForm.current,
                      passwordForm.next,
                      passwordForm.confirm,
                    ),
                  () => {
                    setPasswordForm({ current: '', next: '', confirm: '' });
                    setDialog(null);
                  },
                  'Password changed',
                )
              }
            >
              Update
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          <FormField label="Current Password" required>
            <Input
              type="password"
              value={passwordForm.current}
              onChange={(event) =>
                setPasswordForm({ ...passwordForm, current: event.target.value })
              }
            />
          </FormField>
          <FormField label="New Password" required hint="Twelve characters at least.">
            <div className="flex items-center gap-2">
              <Input
                type={showPassword ? 'text' : 'password'}
                value={passwordForm.next}
                className="flex-1"
                onChange={(event) =>
                  setPasswordForm({ ...passwordForm, next: event.target.value })
                }
              />
              <Button
                variant="ghost"
                size="sm"
                aria-label={showPassword ? 'Hide the password' : 'Show the password'}
                onClick={() => setShowPassword(!showPassword)}
              >
                <Icon name="view" size={18} />
              </Button>
            </div>
          </FormField>
          <FormField label="Confirm Password" required>
            <Input
              type={showPassword ? 'text' : 'password'}
              value={passwordForm.confirm}
              onChange={(event) =>
                setPasswordForm({ ...passwordForm, confirm: event.target.value })
              }
            />
          </FormField>
          {error !== undefined && (
            <Alert tone="danger" title="Not changed">
              {error}
            </Alert>
          )}
        </div>
      </Modal>

      <Modal
        open={dialog === 'twoStep'}
        onClose={() => setDialog(null)}
        title="2-Step verification"
        description="Choose where the second step arrives."
        size="sm"
        footer={
          <div className="grid w-full grid-cols-2 gap-3">
            <Button variant="secondary" fullWidth onClick={() => setDialog(null)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              fullWidth
              loading={pending || !hydrated}
              disabled={!hydrated}
              onClick={() =>
                run(
                  () => setTwoStepAction(true, twoStep),
                  () => setDialog(null),
                  '2-Step verification on',
                )
              }
            >
              Turn on
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          <FormField label="Choose method" required>
            <Select
              options={[
                { value: 'email', label: `Email — ${data.memberEmail}` },
                {
                  value: 'sms',
                  label:
                    data.memberPhone === ''
                      ? 'SMS — add a mobile number first'
                      : `SMS — ${data.memberPhone}`,
                  disabled: data.memberPhone === '' || !data.phoneVerified,
                },
              ]}
              value={twoStep}
              onChange={(event) => setTwoStepForm(event.target.value === 'sms' ? 'sms' : 'email')}
            />
          </FormField>
          <Alert tone="info" title="What this build does">
            The choice is stored and shown on this pane. Sending the second step needs a mail or
            SMS service, which does not exist here yet — so signing in still asks for the password
            alone.
          </Alert>
          {error !== undefined && (
            <Alert tone="danger" title="Not turned on">
              {error}
            </Alert>
          )}
        </div>
      </Modal>

      <Modal
        open={dialog === 'question'}
        onClose={() => setDialog(null)}
        title="Security Question"
        description="Only the answer's hash is stored — never the answer."
        size="sm"
        footer={
          <div className="grid w-full grid-cols-2 gap-3">
            <Button variant="secondary" fullWidth onClick={() => setDialog(null)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              fullWidth
              loading={pending || !hydrated}
              disabled={!hydrated}
              onClick={() =>
                run(
                  () => setSecurityQuestionAction(question.question, question.answer),
                  () => setDialog(null),
                  'Security question set',
                )
              }
            >
              Save
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          <FormField label="Question" required>
            <Select
              options={SECURITY_QUESTIONS.map((value) => ({ value, label: value }))}
              value={question.question}
              onChange={(event) => setQuestion({ ...question, question: event.target.value })}
            />
          </FormField>
          <FormField label="Answer" required hint="Case and spacing are ignored.">
            <Input
              value={question.answer}
              maxLength={80}
              onChange={(event) => setQuestion({ ...question, answer: event.target.value })}
            />
          </FormField>
          {error !== undefined && (
            <Alert tone="danger" title="Not saved">
              {error}
            </Alert>
          )}
        </div>
      </Modal>

      <Modal
        open={dialog === 'devices'}
        onClose={() => setDialog(null)}
        title="Where you logged in ?"
        description="You are currently login on this devices"
        size="sm"
        footer={
          <Button variant="secondary" onClick={() => setDialog(null)}>
            Close
          </Button>
        }
      >
        <ul className="flex flex-col rounded-xl border border-border-subtle">
          {data.devices.map((device) => (
            <li
              key={device.id}
              className="flex flex-wrap items-center justify-between gap-2 border-b border-border-subtle p-4 last:border-b-0"
            >
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-text-primary">
                  {device.name}
                  {device.current && <Badge tone="success">Current Login</Badge>}
                </p>
                <Text tone="muted" size="xs">
                  {device.where} | {device.seen}
                </Text>
              </div>
              {!device.current && (
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={pending}
                  onClick={() =>
                    run(() => signOutDeviceAction(device.id), undefined, 'Signed that one out')
                  }
                >
                  Sign out
                </Button>
              )}
            </li>
          ))}
        </ul>
      </Modal>

      <Modal
        open={dialog === 'deactivate'}
        onClose={() => setDialog(null)}
        title="Deactivate Account"
        description="Tell us the reason why you want to deactivate your account ?"
        size="sm"
        footer={
          <Button
            variant="primary"
            fullWidth
            loading={pending || !hydrated}
            disabled={!hydrated}
            onClick={() =>
              run(
                () => deactivateAccountAction(deactivate.reason, Number(deactivate.days)),
                () => setDialog(null),
                'Account deactivated',
              )
            }
          >
            Deactivate
          </Button>
        }
      >
        <div className="flex flex-col gap-4">
          <FormField label="Reason" required>
            <Textarea
              rows={4}
              value={deactivate.reason}
              maxLength={400}
              placeholder="Tell us brief reason....."
              onChange={(event) => setDeactivate({ ...deactivate, reason: event.target.value })}
            />
          </FormField>
          <FormField label="Number of days" required>
            <Select
              options={['7', '14', '30', '60', '90'].map((value) => ({
                value,
                label: `${value} days`,
              }))}
              value={deactivate.days}
              onChange={(event) => setDeactivate({ ...deactivate, days: event.target.value })}
            />
          </FormField>
          <Alert tone="warning" title="Orders in production carry on">
            Deactivating hides the shop and stops new requests reaching it. It cannot abandon an
            order somebody has already paid for.
          </Alert>
          {error !== undefined && (
            <Alert tone="danger" title="Not deactivated">
              {error}
            </Alert>
          )}
        </div>
      </Modal>

      <Modal
        open={dialog === 'delete'}
        onClose={() => setDialog(null)}
        title="Delete Account"
        description="This is a request. IDEEZA answers it."
        size="sm"
        footer={
          <div className="grid w-full grid-cols-2 gap-3">
            <Button variant="secondary" fullWidth onClick={() => setDialog(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              fullWidth
              loading={pending || !hydrated}
              disabled={!hydrated}
              onClick={() =>
                run(
                  () => requestDeletionAction(deleteReason),
                  () => setDialog(null),
                  'Deletion requested',
                )
              }
            >
              Request deletion
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          <Alert tone="warning" title="Why this is a request and not a button">
            This account may be the counterparty to an order with money in escrow. The platform
            cannot honour a delivery for a shop that no longer exists, so ops closes the account
            once nothing is owed either way.
          </Alert>
          <FormField label="Reason" hint="Optional, but it helps.">
            <Textarea
              rows={3}
              value={deleteReason}
              maxLength={400}
              onChange={(event) => setDeleteReason(event.target.value)}
            />
          </FormField>
          {error !== undefined && (
            <Alert tone="danger" title="Not requested">
              {error}
            </Alert>
          )}
        </div>
      </Modal>

      <Modal
        open={dialog === 'company'}
        onClose={() => setDialog(null)}
        title="Edit company information"
        description="Buyers see the name and the bio; orders ship to the address."
        size="md"
        footer={
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="secondary" onClick={() => setDialog(null)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              loading={pending || !hydrated}
              disabled={!hydrated}
              onClick={() =>
                run(
                  () =>
                    saveCompanyAction({
                      ...company,
                      shippingMethods: company.shippingMethods
                        .split(',')
                        .map((method) => method.trim())
                        .filter((method) => method !== ''),
                    }),
                  () => setDialog(null),
                  'Company information saved',
                )
              }
            >
              Save
            </Button>
          </div>
        }
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField label="Display name" required>
            <Input
              value={company.displayName}
              onChange={(event) => setCompany({ ...company, displayName: event.target.value })}
            />
          </FormField>
          <FormField label="Legal name" required>
            <Input
              value={company.legalName}
              onChange={(event) => setCompany({ ...company, legalName: event.target.value })}
            />
          </FormField>
          <FormField label="Bio" className="sm:col-span-2">
            <Input
              value={company.tagline}
              maxLength={160}
              onChange={(event) => setCompany({ ...company, tagline: event.target.value })}
            />
          </FormField>
          <FormField label="About" className="sm:col-span-2">
            <Textarea
              rows={4}
              value={company.about}
              maxLength={1200}
              onChange={(event) => setCompany({ ...company, about: event.target.value })}
            />
          </FormField>
          <FormField label="Address line 1" required>
            <Input
              value={company.addressLine1}
              onChange={(event) => setCompany({ ...company, addressLine1: event.target.value })}
            />
          </FormField>
          <FormField label="Address line 2">
            <Input
              value={company.addressLine2}
              onChange={(event) => setCompany({ ...company, addressLine2: event.target.value })}
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
              onChange={(event) => setCompany({ ...company, postalCode: event.target.value })}
            />
          </FormField>
          <FormField label="Country" required>
            <Select
              options={COUNTRY_OPTIONS}
              value={company.countryCode}
              onChange={(event) => setCompany({ ...company, countryCode: event.target.value })}
            />
          </FormField>
          <FormField label="Phone">
            <Input
              value={company.phone}
              onChange={(event) => setCompany({ ...company, phone: event.target.value })}
            />
          </FormField>
          <FormField label="Website">
            <Input
              value={company.websiteUrl}
              onChange={(event) => setCompany({ ...company, websiteUrl: event.target.value })}
            />
          </FormField>
          <FormField label="Employees">
            <Select
              options={EMPLOYEE_BANDS.map((value) => ({ value, label: value }))}
              placeholder="Select a band"
              value={company.employeeBand}
              onChange={(event) => setCompany({ ...company, employeeBand: event.target.value })}
            />
          </FormField>
          <FormField label="Shipping method" hint="Comma separated.">
            <Input
              value={company.shippingMethods}
              onChange={(event) =>
                setCompany({ ...company, shippingMethods: event.target.value })
              }
            />
          </FormField>
          {error !== undefined && (
            <div className="sm:col-span-2">
              <Alert tone="danger" title="Not saved">
                {error}
              </Alert>
            </div>
          )}
        </div>
      </Modal>

      <Modal
        open={dialog === 'social'}
        onClose={() => setDialog(null)}
        title="Edit social media"
        description="A link a browser can open, or nothing at all."
        size="sm"
        footer={
          <div className="grid w-full grid-cols-2 gap-3">
            <Button variant="secondary" fullWidth onClick={() => setDialog(null)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              fullWidth
              loading={pending || !hydrated}
              disabled={!hydrated}
              onClick={() =>
                run(
                  () =>
                    saveCompanyAction({
                      displayName: data.displayName,
                      legalName: data.legalName,
                      addressLine1: data.addressLine1,
                      addressLine2: data.addressLine2,
                      city: data.city,
                      region: data.region,
                      postalCode: data.postalCode,
                      countryCode: data.countryCode,
                      ...social,
                    }),
                  () => setDialog(null),
                  'Social links saved',
                )
              }
            >
              Save
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          {(
            [
              ['facebookUrl', 'Facebook'],
              ['twitterUrl', 'Twitter'],
              ['instagramUrl', 'Instagram'],
              ['linkedinUrl', 'LinkedIn'],
            ] as const
          ).map(([field, label]) => (
            <FormField key={field} label={label}>
              <Input
                value={social[field]}
                onChange={(event) => setSocial({ ...social, [field]: event.target.value })}
              />
            </FormField>
          ))}
          {error !== undefined && (
            <Alert tone="danger" title="Not saved">
              {error}
            </Alert>
          )}
        </div>
      </Modal>

      <Modal
        open={dialog === 'kyc2' || dialog === 'kyc3'}
        onClose={() => setDialog(null)}
        title={dialog === 'kyc3' ? 'Enhanced KYC' : 'Intermediate KYC'}
        description="IDEEZA reads it. Nothing here approves an identity check."
        size="sm"
        footer={
          <div className="grid w-full grid-cols-2 gap-3">
            <Button variant="secondary" fullWidth onClick={() => setDialog(null)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              fullWidth
              loading={pending || !hydrated}
              disabled={!hydrated}
              onClick={() =>
                run(
                  () =>
                    submitKycHigherAction({
                      level: dialog === 'kyc3' ? 3 : 2,
                      dateOfBirth: kycHigher.dateOfBirth,
                      residentialAddress: kycHigher.residentialAddress,
                      taxResidencyCountry: kycHigher.taxResidencyCountry,
                      documentNames: kycHigher.documentNames.split(','),
                    }),
                  () => setDialog(null),
                  'Submitted for review',
                )
              }
            >
              Submit for Review
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          <FormField label="Date of Birth" required>
            <Input
              type="date"
              value={kycHigher.dateOfBirth}
              onChange={(event) =>
                setKycHigher({ ...kycHigher, dateOfBirth: event.target.value })
              }
            />
          </FormField>
          <FormField label="Full Residential Address" required>
            <Textarea
              rows={3}
              value={kycHigher.residentialAddress}
              maxLength={300}
              onChange={(event) =>
                setKycHigher({ ...kycHigher, residentialAddress: event.target.value })
              }
            />
          </FormField>
          <FormField label="Tax residency country" required>
            <Select
              options={COUNTRY_OPTIONS}
              placeholder="Select country"
              value={kycHigher.taxResidencyCountry}
              onChange={(event) =>
                setKycHigher({ ...kycHigher, taxResidencyCountry: event.target.value })
              }
            />
          </FormField>
          <FormField
            label="Government photo ID"
            required
            hint="The file itself is not uploaded in this build — the name is recorded with the submission."
          >
            <Input
              type="file"
              multiple
              onChange={(event) =>
                setKycHigher({
                  ...kycHigher,
                  documentNames: [...(event.target.files ?? [])]
                    .map((file) => file.name)
                    .join(', '),
                })
              }
            />
          </FormField>
          {kycHigher.documentNames !== '' && (
            <Text tone="muted" size="xs" className="block">
              Recording: {kycHigher.documentNames}
            </Text>
          )}
          {error !== undefined && (
            <Alert tone="danger" title="Not submitted">
              {error}
            </Alert>
          )}
        </div>
      </Modal>

      <Modal
        open={dialog === 'payout'}
        onClose={() => setDialog(null)}
        title="Add method"
        description="Where a released payout is paid."
        size="sm"
        footer={
          <div className="grid w-full grid-cols-2 gap-3">
            <Button variant="secondary" fullWidth onClick={() => setDialog(null)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              fullWidth
              loading={pending || !hydrated}
              disabled={!hydrated}
              onClick={() =>
                run(() => addPayoutMethodAction(payout), () => setDialog(null), 'Method added')
              }
            >
              Add
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          <FormField label="Method" required>
            <Select
              options={[
                { value: 'direct_bank', label: 'Direct bank' },
                { value: 'swift', label: 'SWIFT / international' },
              ]}
              value={payout.kind}
              onChange={(event) =>
                setPayout({
                  ...payout,
                  kind: event.target.value === 'swift' ? 'swift' : 'direct_bank',
                })
              }
            />
          </FormField>
          <FormField label="Name on the account" required>
            <Input
              value={payout.accountName}
              maxLength={120}
              onChange={(event) => setPayout({ ...payout, accountName: event.target.value })}
            />
          </FormField>
          <FormField
            label="Account number"
            required
            hint="Only the last four digits are stored."
          >
            <Input
              value={payout.accountNumber}
              maxLength={34}
              onChange={(event) => setPayout({ ...payout, accountNumber: event.target.value })}
            />
          </FormField>
          {payout.kind === 'direct_bank' ? (
            <FormField label="Bank name" required>
              <Input
                value={payout.bankName}
                maxLength={120}
                onChange={(event) => setPayout({ ...payout, bankName: event.target.value })}
              />
            </FormField>
          ) : (
            <FormField label="SWIFT / BIC" required hint="Eight or eleven characters.">
              <Input
                value={payout.swiftCode}
                maxLength={11}
                onChange={(event) => setPayout({ ...payout, swiftCode: event.target.value })}
              />
            </FormField>
          )}
          <FormField label="Bank country" required>
            <Select
              options={COUNTRY_OPTIONS}
              value={payout.countryCode}
              onChange={(event) => setPayout({ ...payout, countryCode: event.target.value })}
            />
          </FormField>
          <FormField label="Label" hint="What you will recognise it by.">
            <Input
              value={payout.label}
              maxLength={60}
              onChange={(event) => setPayout({ ...payout, label: event.target.value })}
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
        open={dialog === 'taxResidence'}
        onClose={() => setDialog(null)}
        title="Tax Residence"
        description="Where you are taxed decides what IDEEZA has to withhold."
        size="sm"
        footer={
          <div className="grid w-full grid-cols-2 gap-3">
            <Button variant="secondary" fullWidth onClick={() => setDialog(null)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              fullWidth
              loading={pending || !hydrated}
              disabled={!hydrated}
              onClick={() =>
                run(
                  () =>
                    saveTaxResidenceAction(taxResidence.countryCode, taxResidence.isUsPerson),
                  () => setDialog(null),
                  'Tax residence saved',
                )
              }
            >
              Save
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          <FormField label="Country of tax residence" required>
            <Select
              options={COUNTRY_OPTIONS}
              value={taxResidence.countryCode}
              onChange={(event) =>
                setTaxResidence({ ...taxResidence, countryCode: event.target.value })
              }
            />
          </FormField>
          <Checkbox
            label="I am a US person for tax purposes"
            checked={taxResidence.isUsPerson}
            onChange={(event) =>
              setTaxResidence({ ...taxResidence, isUsPerson: event.target.checked })
            }
          />
          <Text tone="muted" size="xs" className="block max-w-measure">
            The design asks this before it asks for a number, because the form after it is a
            different form: a US person gives a TIN or SSN, everybody else gives their local
            number.
          </Text>
          {error !== undefined && (
            <Alert tone="danger" title="Not saved">
              {error}
            </Alert>
          )}
        </div>
      </Modal>

      <Modal
        open={dialog === 'taxId'}
        onClose={() => setDialog(null)}
        title={data.tax.isUsPerson ? 'Tax Identification (US)' : 'Tax Identification'}
        description="Only the last four characters are kept."
        size="sm"
        footer={
          <div className="grid w-full grid-cols-2 gap-3">
            <Button variant="secondary" fullWidth onClick={() => setDialog(null)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              fullWidth
              loading={pending || !hydrated}
              disabled={!hydrated}
              onClick={() =>
                run(
                  () => saveTaxIdentificationAction(taxId.kind, taxId.number),
                  () => setDialog(null),
                  'Tax number saved',
                )
              }
            >
              Save
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          <FormField label="Kind of number" required>
            <Select
              options={
                data.tax.isUsPerson
                  ? TAX_ID_KINDS.filter((kind) => ['tin', 'ein', 'ssn'].includes(kind.value))
                  : TAX_ID_KINDS.filter((kind) => !['ein', 'ssn'].includes(kind.value))
              }
              value={taxId.kind}
              onChange={(event) => setTaxId({ ...taxId, kind: event.target.value })}
            />
          </FormField>
          <FormField label="Number" required>
            <Input
              value={taxId.number}
              maxLength={32}
              onChange={(event) => setTaxId({ ...taxId, number: event.target.value })}
            />
          </FormField>
          {error !== undefined && (
            <Alert tone="danger" title="Not saved">
              {error}
            </Alert>
          )}
        </div>
      </Modal>

      <Modal
        open={dialog === 'withdrawals'}
        onClose={() => setDialog(null)}
        title="Withdraw history"
        description="Every withdrawal this shop has asked for."
        size="md"
        footer={
          <Button variant="secondary" onClick={() => setDialog(null)}>
            Close
          </Button>
        }
      >
        {data.withdrawals.length === 0 ? (
          <EmptyState
            title="Nothing withdrawn yet"
            description="A released payout can be withdrawn from Payouts & Earnings."
          />
        ) : (
          <ul className="flex flex-col rounded-xl border border-border-subtle">
            {data.withdrawals.map((row) => (
              <li
                key={row.id}
                className="flex items-center justify-between gap-3 border-b border-border-subtle p-4 last:border-b-0"
              >
                <div>
                  <p className="text-sm font-medium text-text-primary" data-numeric>
                    {row.amount}
                  </p>
                  <Text tone="muted" size="xs">
                    {row.on}
                  </Text>
                </div>
                <Tag
                  tone={
                    row.status === 'paid'
                      ? 'success'
                      : row.status === 'rejected'
                        ? 'danger'
                        : 'warning'
                  }
                >
                  {row.status}
                </Tag>
              </li>
            ))}
          </ul>
        )}
      </Modal>
    </div>
  );
};
