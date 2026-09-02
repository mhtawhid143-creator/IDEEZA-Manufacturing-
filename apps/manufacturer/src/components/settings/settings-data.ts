import type { IconName } from '@ideeza/ui';

/**
 * What the settings screen is handed, and what its rail offers.
 *
 * Kept apart from the component so the page, the panes and the tests all read
 * one description of the shape rather than three that drift.
 */
export interface SettingsData {
  // the shop
  readonly displayName: string;
  readonly legalName: string;
  readonly tagline: string;
  readonly about: string;
  readonly addressLine1: string;
  readonly addressLine2: string;
  readonly city: string;
  readonly region: string;
  readonly postalCode: string;
  readonly countryCode: string;
  readonly phone: string;
  readonly websiteUrl: string;
  readonly employeeBand: string;
  readonly shippingMethods: readonly string[];
  readonly facebookUrl: string;
  readonly twitterUrl: string;
  readonly instagramUrl: string;
  readonly linkedinUrl: string;
  readonly verified: boolean;
  readonly services: readonly string[];

  // the person
  readonly firstName: string;
  readonly lastName: string;
  readonly memberName: string;
  readonly memberEmail: string;
  readonly memberPhone: string;
  readonly phoneVerified: boolean;
  readonly avatarPreset: string | null;
  readonly isOwner: boolean;

  // security
  readonly hasPassword: boolean;
  readonly twoStepEnabled: boolean;
  readonly twoStepMethod: string;
  readonly securityQuestion: string | null;
  readonly loginAlerts: boolean;
  readonly deactivatedOn: string | null;
  readonly reactivateOn: string | null;
  readonly deletionRequestedOn: string | null;
  readonly devices: readonly {
    readonly id: string;
    readonly name: string;
    readonly where: string;
    readonly seen: string;
    readonly current: boolean;
  }[];

  // preferences
  readonly language: string;
  readonly dateLocale: string;
  readonly profileLocked: boolean;
  readonly shareActivityOnFacebook: boolean;
  readonly publishWishlistOnFacebook: boolean;
  readonly linkWithSearchEngine: boolean;
  readonly notices: readonly {
    readonly topic: string;
    readonly channel: string;
    readonly enabled: boolean;
    readonly locked: boolean;
  }[];

  // identity
  readonly kyc: readonly {
    readonly level: number;
    readonly status: string;
    readonly rejectReason: string | null;
    readonly fullLegalName: string | null;
    readonly contactEmail: string | null;
    readonly mobileNumber: string | null;
    readonly countryOfResidence: string | null;
    readonly agreedToTerms: boolean;
    readonly dateOfBirth: string | null;
    readonly residentialAddress: string | null;
    readonly taxResidencyCountry: string | null;
    readonly documentNames: readonly string[];
    readonly submittedOn: string | null;
  }[];

  // money
  readonly heldMinor: number;
  readonly availableMinor: number;
  readonly currency: string;
  readonly payoutMethods: readonly {
    readonly id: string;
    readonly kind: string;
    readonly label: string;
    readonly accountName: string;
    readonly accountLast4: string;
    readonly bankName: string | null;
    readonly swiftCode: string | null;
    readonly countryCode: string;
    readonly isDefault: boolean;
  }[];
  readonly withdrawals: readonly {
    readonly id: string;
    readonly amount: string;
    readonly status: string;
    readonly on: string;
  }[];
  readonly tax: {
    readonly residenceCountry: string | null;
    readonly isUsPerson: boolean;
    readonly taxIdKind: string | null;
    readonly taxIdLast4: string | null;
    readonly submittedOn: string | null;
  };

  // what has happened
  readonly activity: readonly {
    readonly id: string;
    readonly day: string;
    readonly time: string;
    readonly text: string;
  }[];
  readonly disputes: readonly {
    readonly id: string;
    readonly orderId: string;
    readonly status: string;
    readonly reason: string;
    readonly outcome: string | null;
    readonly openedOn: string;
    readonly resolvedOn: string | null;
    readonly productName: string;
    readonly openedByYou: boolean;
  }[];
}

export interface SettingsSection {
  readonly id: string;
  readonly label: string;
  readonly icon: IconName;
  /** Where the breadcrumb says this pane sits. */
  readonly group: string;
}

/** The rail, in the design's order and grouping. */
export const SETTINGS_GROUPS: readonly {
  readonly group: string;
  readonly icon: IconName;
  readonly items: readonly SettingsSection[];
}[] = [
  {
    group: 'General',
    icon: 'grid',
    items: [
      { id: 'profile', label: 'Profile', icon: 'people', group: 'General' },
      { id: 'company', label: 'Company Information', icon: 'shop', group: 'General' },
      { id: 'security', label: 'Security', icon: 'flag', group: 'General' },
      { id: 'kyc', label: 'KYC Verification', icon: 'check-circle', group: 'General' },
      { id: 'paid', label: 'Get Paid', icon: 'payouts', group: 'General' },
    ],
  },
  {
    group: 'Preferences',
    icon: 'settings',
    items: [
      { id: 'notification', label: 'Notification', icon: 'bell', group: 'Preferences' },
      { id: 'language', label: 'Language', icon: 'compass', group: 'Preferences' },
      { id: 'locking', label: 'Profile locking', icon: 'people', group: 'Preferences' },
    ],
  },
  {
    group: '',
    icon: 'file',
    items: [
      { id: 'policy', label: 'Policy & Privacy', icon: 'file', group: '' },
      { id: 'activity', label: 'Activity', icon: 'feed', group: '' },
      { id: 'dispute', label: 'Dispute', icon: 'alert', group: '' },
    ],
  },
];

export const SETTINGS_SECTIONS: readonly SettingsSection[] = SETTINGS_GROUPS.flatMap(
  (group) => group.items,
);

/**
 * The pictures a person may choose.
 *
 * Nothing uploads a file in this build, so a photograph of a person is not
 * stored anywhere. What the design's grid offers besides the upload tile is a
 * set of presets, and a preset is a choice rather than a file — so those are
 * real, drawn from the design system's own gradients, and the upload tile says
 * what it cannot do.
 */
export const AVATAR_PRESETS = [
  { id: 'brand', label: 'Brand', className: 'bg-bg-brand' },
  { id: 'dusk', label: 'Dusk', className: 'bg-gradient-to-br from-bg-brand to-bg-info' },
  { id: 'mint', label: 'Mint', className: 'bg-gradient-to-br from-bg-success to-bg-info' },
  { id: 'amber', label: 'Amber', className: 'bg-gradient-to-br from-bg-warning to-bg-error' },
  { id: 'slate', label: 'Slate', className: 'bg-gradient-to-br from-bg-inverse to-bg-subtle' },
  { id: 'sky', label: 'Sky', className: 'bg-gradient-to-br from-bg-info to-bg-brand-subtle' },
] as const;

export const NOTIFICATION_TOPIC_LABELS: Readonly<Record<string, string>> = {
  product: 'Product',
  message: 'Message',
  dispute: 'Dispute',
  blog: 'Blog',
  policy_community: 'Policy & Community',
  other: 'Other Notification',
};

export const NOTIFICATION_CHANNEL_LABELS: Readonly<Record<string, string>> = {
  web: 'Web Notification',
  email: 'Email',
  mobile: 'Mobile Application',
};

export const NOTIFICATION_CHANNEL_ICONS: Readonly<Record<string, IconName>> = {
  web: 'grid',
  email: 'send',
  mobile: 'message',
};

/** The languages this build can actually format dates in. */
export const LANGUAGE_OPTIONS = [
  { value: 'en-US', label: 'English (US)' },
  { value: 'en-GB', label: 'English (UK)' },
  { value: 'bn-BD', label: 'বাংলা (Bangladesh)' },
  { value: 'zh-CN', label: '中文 (China)' },
  { value: 'nl-NL', label: 'Nederlands' },
  { value: 'de-DE', label: 'Deutsch' },
];

export const DATE_LOCALE_OPTIONS = [
  { value: 'en-US', label: 'United States (English)' },
  { value: 'en-GB', label: 'United Kingdom (English)' },
  { value: 'bn-BD', label: 'Bangladesh (Bangla)' },
  { value: 'zh-CN', label: 'China (Chinese)' },
  { value: 'de-DE', label: 'Germany (German)' },
  { value: 'nl-NL', label: 'Netherlands (Dutch)' },
];

export const SECURITY_QUESTIONS = [
  'What was the name of your first workshop?',
  'What was the first machine you bought?',
  'What city was your first order shipped to?',
  'What is your oldest supplier called?',
  'What was your first job title?',
];

export const COUNTRY_OPTIONS = [
  { value: 'BD', label: 'Bangladesh' },
  { value: 'CN', label: 'China' },
  { value: 'DE', label: 'Germany' },
  { value: 'IN', label: 'India' },
  { value: 'NL', label: 'Netherlands' },
  { value: 'GB', label: 'United Kingdom' },
  { value: 'US', label: 'United States' },
  { value: 'VN', label: 'Vietnam' },
];

export const EMPLOYEE_BANDS = ['1-10', '10-50', '50-200', '200-500', '500-1000', '1000+'];

/** What a tax number is called where it is issued. */
export const TAX_ID_KINDS = [
  { value: 'tin', label: 'Taxpayer Identification Number (TIN)' },
  { value: 'vat', label: 'VAT number' },
  { value: 'ein', label: 'Employer Identification Number (EIN)' },
  { value: 'ssn', label: 'Social Security Number (SSN)' },
  { value: 'bin', label: 'Business Identification Number (BIN)' },
];
