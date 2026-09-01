'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  Alert,
  Badge,
  Button,
  Card,
  CardHeader,
  ChoiceChips,
  DefinitionList,
  DropdownMenu,
  EmptyState,
  FormField,
  Icon,
  Input,
  Modal,
  Pagination,
  Select,
  Tabs,
  Textarea,
  Tag,
  Text,
  useToast,
} from '@ideeza/ui';
import {
  addCapabilitySheetAction,
  addCertificateAction,
  addEquipmentAction,
  addMachineAction,
  removeCapabilitySheetAction,
  removeCertificateAction,
  removeEquipmentAction,
  removeMachineAction,
  saveCapabilityAction,
  setMemberTitleAction,
  saveCompanyAction,
  updateCapabilitySheetAction,
  updateMachineAction,
} from '@/app/(app)/profile/actions.js';
import {
  CAPABILITY_KINDS,
  CAPABILITY_KIND_OPTIONS,
  findCapabilityKind,
  type CapabilityKindSpec,
} from '@/data/capability-fields.js';

/**
 * What the Add Manufacturing Capability form offers.
 *
 * The design draws four selects and one text box, so the four are lists rather
 * than free text: two shops that both mill should say "CNC Machining" in the
 * same words, or a buyer filtering on a process finds one of them. The
 * sub-processes hang off the process for the same reason — "Reflow" under CNC
 * machining would be a shop describing a line it does not have.
 */
const MACHINE_OPTIONS = [
  'CNC Machine',
  'CNC Lathe',
  'Surface Grinder',
  'FDM 3D Printer',
  'SLA / Resin Printer',
  'SLS Printer',
  'Injection Moulding Machine',
  'Laser Cutter',
  'Sheet Metal Press Brake',
  'SMT Placement Line',
  'Reflow Oven',
  'Wave Solder',
  'AOI Station',
  'X-Ray Inspection',
  'Stencil Cutter',
  'CMM',
].map((name) => ({ value: name, label: name }));

const SUB_PROCESSES: Record<string, readonly string[]> = {
  'CNC Machining': ['Milling', 'Turning', 'Drilling', 'Tapping', 'Boring', 'Reaming'],
  'Additive Manufacturing': [
    'FDM',
    'SLA',
    'SLS',
    'Post-cure',
    'Depowdering',
    'Bead blasting',
  ],
  'Injection Moulding': ['Tool making', 'Moulding', 'Overmoulding', 'Insert moulding'],
  'Sheet Metal Fabrication': ['Laser cutting', 'Punching', 'Bending', 'Welding', 'Riveting'],
  'PCB Fabrication': ['Etching', 'Drilling', 'Lamination', 'Solder mask', 'Silkscreen'],
  'PCB Assembly': [
    'Paste printing',
    'Placement',
    'Reflow',
    'Wave solder',
    'Hand solder',
    'Conformal coating',
  ],
  Inspection: [
    'Solder joint',
    'Polarity',
    'Presence',
    'BGA voiding',
    'QFN wetting',
    'Dimensional',
    'Functional test',
  ],
  Tooling: ['Laser cut', 'Electropolish', 'Jig making', 'Fixture making'],
  Finishing: ['Anodising', 'Powder coating', 'Painting', 'Polishing', 'Plating'],
};

const PROCESS_OPTIONS = Object.keys(SUB_PROCESSES).map((name) => ({
  value: name,
  label: name,
}));

const TOLERANCE_OPTIONS = [
  '0.1% with a 0.1 mm min',
  '0.1% with a 0.025 mm min',
  'plus or minus 0.05 mm',
  'plus or minus 0.1 mm',
  'plus or minus 0.2 mm',
  'plus or minus 0.3%, 0.3 mm min',
  'ISO 2768-f (fine)',
  'ISO 2768-m (medium)',
].map((name) => ({ value: name, label: name }));

/** Four to a page, as the design pages them: two rows of two. */
const MACHINES_PER_PAGE = 4;

/**
 * A blank sheet form for one kind of work.
 *
 * The answers are keyed by the field's id rather than its label, so renaming
 * what the card says cannot silently orphan what a shop already chose.
 */
const emptySheet = (kind: string) => ({
  kind,
  answers: {} as Readonly<Record<string, readonly string[]>>,
  attachments: [] as readonly string[],
});

const EMPTY_MACHINE = {
  name: '',
  process: '',
  subProcesses: [] as readonly string[],
  tolerance: '',
  turnaroundTime: '',
};

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
  /** Where the order shipped — the only country the platform actually knows. */
  readonly countryCode: string;
  readonly total: string;
  readonly durationDays: number | null;
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
  /** Over every review, not only the ones this page lists. */
  readonly averageRating: number | null;
  readonly reviewBreakdown: readonly { readonly rating: number; readonly count: number }[];
  readonly quoteCount: number;
  readonly orderCount: number;
  readonly partCount: number;
  readonly members: readonly {
    readonly id: string;
    readonly name: string;
    readonly email: string;
    readonly owner: boolean;
    readonly title: string | null;
  }[];
  /** What is on the floor, as the shop lists it. */
  readonly machines: readonly {
    readonly id: string;
    readonly name: string;
    readonly process: string;
    readonly subProcesses: readonly string[];
    readonly tolerance: string | null;
    readonly turnaroundTime: string | null;
  }[];
  /** What the shop can do, per kind of work — the detail after the match. */
  readonly capabilitySheets: readonly {
    readonly id: string;
    readonly kind: string;
    readonly title: string;
    readonly verification: string;
    readonly attachmentNames: readonly string[];
    readonly parameters: readonly {
      readonly id: string;
      readonly label: string;
      readonly values: readonly string[];
    }[];
  }[];
  /** The certificates the shop claims, and where each one stands with IDEEZA. */
  readonly certificates: readonly {
    readonly id: string;
    readonly name: string;
    readonly category: string | null;
    readonly issuingAuthority: string | null;
    readonly status: string;
  }[];
  /** How many of each machine there is — a count, not a capability. */
  readonly equipment: readonly {
    readonly id: string;
    readonly name: string;
    readonly quantity: number;
  }[];
  /** Articles this shop has written. Buyers read the published ones. */
  readonly articles: readonly {
    readonly id: string;
    readonly title: string;
    readonly excerpt: string;
    readonly tags: readonly string[];
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

/**
 * The certificates the form lists, and what each one covers.
 *
 * A list rather than a free text box, for the same reason the machine list is
 * one: two shops that both hold ISO 9001 should say it in the same words, or a
 * buyer filtering on it finds one of them. The category fills itself in from
 * the choice, because a shop should not have to remember that IPC-A-610 is
 * about workmanship.
 */
const CERTIFICATE_CATALOGUE = [
  { name: 'ISO 9001:2015', category: 'Quality Management', authority: 'ISO Organization' },
  { name: 'ISO 13485:2016', category: 'Medical Devices', authority: 'ISO Organization' },
  { name: 'ISO 14001:2015', category: 'Environmental Management', authority: 'ISO Organization' },
  { name: 'AS9100D', category: 'Aerospace Quality', authority: 'IAQG' },
  { name: 'IATF 16949', category: 'Automotive Quality', authority: 'IATF' },
  { name: 'IPC-A-610 Class 3', category: 'Assembly Workmanship', authority: 'IPC' },
  { name: 'IPC-A-600', category: 'Bare Board Acceptability', authority: 'IPC' },
  { name: 'IPC/WHMA-A-620', category: 'Cable and Wire Harness', authority: 'IPC' },
  { name: 'UL 796', category: 'Printed Wiring Boards', authority: 'UL Solutions' },
  { name: 'RoHS Compliance', category: 'Hazardous Substances', authority: 'European Commission' },
  { name: 'REACH Compliance', category: 'Chemical Safety', authority: 'ECHA' },
  { name: 'ITAR Registration', category: 'Defence Trade', authority: 'US State Department' },
];

const CERTIFICATE_AUTHORITIES = [
  ...new Set(CERTIFICATE_CATALOGUE.map((entry) => entry.authority)),
];

const CERTIFICATE_CATEGORIES = [
  ...new Set(CERTIFICATE_CATALOGUE.map((entry) => entry.category)),
];

/** How a certificate's standing reads on the card, in IDEEZA's voice. */
const CERTIFICATE_STANDING: Record<
  string,
  { readonly label: string; readonly tone: 'success' | 'warning' | 'brand'; readonly icon: 'check-circle' | 'clock' | 'star' }
> = {
  verified: { label: 'Verified', tone: 'success', icon: 'check-circle' },
  issued_by_ideeza: { label: 'By IDEEZA', tone: 'brand', icon: 'star' },
  pending: { label: 'Pending', tone: 'warning', icon: 'clock' },
};

/** Six to a page on the equipment grid, which is two rows of three. */
const EQUIPMENT_PER_PAGE = 6;

/** The Agent grid pages the same way, two rows of three. */
const MEMBERS_PER_PAGE = 6;

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
  const [editing, setEditing] = useState<
    | 'company'
    | 'capability'
    | 'machine'
    | 'sheet'
    | 'certificate'
    | 'equipment'
    | 'service'
    | 'member'
    | null
  >(null);
  const [certificate, setCertificate] = useState({
    name: '',
    category: '',
    issuingAuthority: '',
  });
  const [equipment, setEquipment] = useState({ name: '', quantity: '1' });
  /** Null while adding a sheet; the sheet's id while rewriting one. */
  const [sheetId, setSheetId] = useState<string | null>(null);
  const [sheet, setSheet] = useState(() => emptySheet(CAPABILITY_KINDS[0]?.kind ?? 'other'));
  /** Null while adding; the machine's id while editing one already listed. */
  const [machineId, setMachineId] = useState<string | null>(null);
  const [machinePage, setMachinePage] = useState(1);
  const [equipmentPage, setEquipmentPage] = useState(1);
  const [memberPage, setMemberPage] = useState(1);
  const [memberEdit, setMemberEdit] = useState({ id: '', title: '' });
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
  const [machine, setMachine] = useState(EMPTY_MACHINE);
  const [moq, setMoq] = useState(data.minimumOrderQuantity);
  const [lead, setLead] = useState(data.standardLeadTimeDays);

  useEffect(() => setHydrated(true), []);

  const memberPageCount = Math.max(1, Math.ceil(data.members.length / MEMBERS_PER_PAGE));
  const currentMemberPage = Math.min(memberPage, memberPageCount);
  const membersOnPage = data.members.slice(
    (currentMemberPage - 1) * MEMBERS_PER_PAGE,
    currentMemberPage * MEMBERS_PER_PAGE,
  );

  const equipmentPageCount = Math.max(1, Math.ceil(data.equipment.length / EQUIPMENT_PER_PAGE));
  const currentEquipmentPage = Math.min(equipmentPage, equipmentPageCount);
  const equipmentOnPage = data.equipment.slice(
    (currentEquipmentPage - 1) * EQUIPMENT_PER_PAGE,
    currentEquipmentPage * EQUIPMENT_PER_PAGE,
  );

  const machinePageCount = Math.max(1, Math.ceil(data.machines.length / MACHINES_PER_PAGE));
  // Removing the last machine on the last page would otherwise leave the pager
  // pointing past the end and the grid empty with no way back.
  const currentMachinePage = Math.min(machinePage, machinePageCount);
  const machinesOnPage = data.machines.slice(
    (currentMachinePage - 1) * MACHINES_PER_PAGE,
    currentMachinePage * MACHINES_PER_PAGE,
  );

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

  const sheetSpec: CapabilityKindSpec | undefined = findCapabilityKind(sheet.kind);

  const saveMemberTitle = (): void => {
    setError(undefined);
    startTransition(async () => {
      const result = await setMemberTitleAction(memberEdit.id, memberEdit.title);
      if (!result.saved) {
        setError(result.error ?? 'That role was not saved.');
        return;
      }
      setEditing(null);
      push({ title: 'Role saved', tone: 'success' });
      router.refresh();
    });
  };

  const openCertificateForm = (): void => {
    setError(undefined);
    setCertificate({ name: '', category: '', issuingAuthority: '' });
    setEditing('certificate');
  };

  /** Choosing the name fills the rest in; a shop can still overrule both. */
  const chooseCertificate = (name: string): void => {
    const known = CERTIFICATE_CATALOGUE.find((entry) => entry.name === name);
    setCertificate({
      name,
      category: known?.category ?? '',
      issuingAuthority: known?.authority ?? '',
    });
  };

  const saveCertificate = (): void => {
    setError(undefined);
    startTransition(async () => {
      const result = await addCertificateAction(certificate);
      if (!result.saved) {
        setError(result.error ?? 'That certificate was not added.');
        return;
      }
      setEditing(null);
      push({
        title: 'Certificate added',
        body: 'It reads as pending until IDEEZA has seen it.',
        tone: 'success',
      });
      router.refresh();
    });
  };

  const dropCertificate = (id: string): void => {
    startTransition(async () => {
      const result = await removeCertificateAction(id);
      if (!result.saved) {
        push({ title: result.error ?? 'It was not removed.', tone: 'danger' });
        return;
      }
      router.refresh();
    });
  };

  const saveEquipment = (): void => {
    setError(undefined);
    startTransition(async () => {
      const result = await addEquipmentAction({
        name: equipment.name,
        quantity: Number(equipment.quantity),
      });
      if (!result.saved) {
        setError(result.error ?? 'That was not added.');
        return;
      }
      setEditing(null);
      setEquipment({ name: '', quantity: '1' });
      push({ title: 'Added to your equipment list', tone: 'success' });
      router.refresh();
    });
  };

  const dropEquipment = (id: string): void => {
    startTransition(async () => {
      const result = await removeEquipmentAction(id);
      if (!result.saved) {
        push({ title: result.error ?? 'It was not removed.', tone: 'danger' });
        return;
      }
      router.refresh();
    });
  };

  /** Saves only the services, from the tab's own form. */
  const saveServices = (): void => {
    setError(undefined);
    startTransition(async () => {
      const result = await saveCapabilityAction({
        services,
        certifications: data.certifications,
        servedRegions: regions,
        minimumOrderQuantity: moq,
        standardLeadTimeDays: lead,
      });
      if (!result.saved) {
        setError(result.error ?? 'Those were not saved.');
        return;
      }
      setEditing(null);
      push({
        title: 'Services saved',
        body: 'A request now reaches you only if these cover it.',
        tone: 'success',
      });
      router.refresh();
    });
  };

  /**
   * Opens the capability form: blank for a new kind, or filled from a sheet
   * already published.
   *
   * Filling it reads the stored rows back by the label the card shows, which is
   * the same label the spec writes them under — one table, so the round trip
   * cannot drift.
   */
  const openSheetForm = (existing?: ProfileData['capabilitySheets'][number]): void => {
    setError(undefined);
    setSheetId(existing?.id ?? null);

    if (existing === undefined) {
      const taken = new Set(data.capabilitySheets.map((row) => row.kind));
      const free = CAPABILITY_KINDS.find((entry) => !taken.has(entry.kind));
      setSheet(emptySheet(free?.kind ?? CAPABILITY_KINDS[0]?.kind ?? 'other'));
      setEditing('sheet');
      return;
    }

    const spec = findCapabilityKind(existing.kind);
    const answers: Record<string, readonly string[]> = {};
    for (const field of spec?.fields ?? []) {
      const row = existing.parameters.find((entry) => entry.label === field.cardLabel);
      if (row !== undefined) answers[field.id] = row.values;
    }
    setSheet({ kind: existing.kind, answers, attachments: existing.attachmentNames });
    setEditing('sheet');
  };

  const setAnswer = (fieldId: string, values: readonly string[]): void => {
    setSheet((current) => ({ ...current, answers: { ...current.answers, [fieldId]: values } }));
  };

  /** Every required field answered — what the design's Add Now waits for. */
  const sheetReady =
    sheetSpec !== undefined &&
    sheetSpec.fields
      .filter((field) => field.required)
      .every((field) => (sheet.answers[field.id] ?? []).some((value) => value.trim() !== ''));

  const saveSheet = (): void => {
    setError(undefined);
    if (sheetSpec === undefined) return;
    const payload = {
      kind: sheet.kind,
      title: sheetSpec.label,
      parameters: sheetSpec.fields.map((field) => ({
        label: field.cardLabel,
        values: sheet.answers[field.id] ?? [],
      })),
      attachmentNames: sheet.attachments,
    };
    startTransition(async () => {
      const result =
        sheetId === null
          ? await addCapabilitySheetAction(payload)
          : await updateCapabilitySheetAction(sheetId, payload);
      if (!result.saved) {
        setError(result.error ?? 'That sheet was not saved.');
        return;
      }
      setEditing(null);
      setSheetId(null);
      push({
        title: sheetId === null ? 'Capability published' : 'Capability updated',
        body: 'IDEEZA reads it before it says Verified.',
        tone: 'success',
      });
      router.refresh();
    });
  };

  const dropSheet = (id: string): void => {
    startTransition(async () => {
      const result = await removeCapabilitySheetAction(id);
      if (!result.saved) {
        push({ title: result.error ?? 'It was not removed.', tone: 'danger' });
        return;
      }
      router.refresh();
    });
  };

  /** Opens the form empty to add, or filled to change one already listed. */
  const openMachineForm = (existing?: ProfileData['machines'][number]): void => {
    setError(undefined);
    setMachineId(existing?.id ?? null);
    setMachine(
      existing === undefined
        ? EMPTY_MACHINE
        : {
            name: existing.name,
            process: existing.process,
            subProcesses: existing.subProcesses,
            tolerance: existing.tolerance ?? '',
            turnaroundTime: existing.turnaroundTime ?? '',
          },
    );
    setEditing('machine');
  };

  const saveMachine = (): void => {
    setError(undefined);
    startTransition(async () => {
      const edit = {
        name: machine.name,
        process: machine.process,
        subProcesses: machine.subProcesses,
        tolerance: machine.tolerance,
        turnaroundTime: machine.turnaroundTime,
      };
      const result =
        machineId === null
          ? await addMachineAction(edit)
          : await updateMachineAction(machineId, edit);
      if (!result.saved) {
        setError(result.error ?? 'That machine was not saved.');
        return;
      }
      setEditing(null);
      setMachine(EMPTY_MACHINE);
      push({
        title: machineId === null ? 'Added to your floor list' : 'Machine updated',
        tone: 'success',
      });
      setMachineId(null);
      router.refresh();
    });
  };

  const dropMachine = (id: string): void => {
    startTransition(async () => {
      const result = await removeMachineAction(id);
      if (!result.saved) {
        push({ title: result.error ?? 'It was not removed.', tone: 'danger' });
        return;
      }
      router.refresh();
    });
  };

  /**
   * A sub-process is chosen one at a time and shown as a chip, because a
   * machine has several and the design draws one select. Choosing the same one
   * twice is a no-op rather than a duplicate chip.
   */
  const addSubProcess = (value: string): void => {
    if (value === '' || machine.subProcesses.includes(value)) return;
    setMachine({ ...machine, subProcesses: [...machine.subProcesses, value] });
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
        <Card>
          <h2 className="text-xl font-semibold text-text-primary">Reviews</h2>

          {/*
            The three readings the design puts side by side: how many there
            are, what they average, and how they are spread. The spread is the
            one that cannot be faked by a good week — a shop with one bad month
            shows it here.
          */}
          <div className="mt-4 grid grid-cols-1 gap-6 rounded-xl border border-border-subtle p-4 md:grid-cols-3 md:divide-x md:divide-border-subtle">
            <div>
              <Text tone="muted" size="sm" className="block font-medium text-text-primary">
                Total Reviews
              </Text>
              <p className="mt-1 text-3xl font-bold text-text-brand" data-numeric>
                {data.reviewCount}
              </p>
              <Text tone="muted" size="xs" className="block">
                Every review a delivered order has earned
              </Text>
            </div>

            <div className="md:pl-6">
              <Text tone="muted" size="sm" className="block font-medium text-text-primary">
                Average Rating
              </Text>
              <p className="mt-1 flex items-center gap-2">
                <span className="text-sm text-text-brand" aria-hidden>
                  {'★'.repeat(Math.round(data.averageRating ?? 0))}
                  <span className="text-text-tertiary">
                    {'★'.repeat(5 - Math.round(data.averageRating ?? 0))}
                  </span>
                </span>
                <span className="text-sm font-semibold text-text-primary" data-numeric>
                  {data.averageRating === null ? 'No rating yet' : data.averageRating.toFixed(1)}
                </span>
              </p>
              <Text tone="muted" size="xs" className="block">
                Averaged over all of them, not the newest page
              </Text>
            </div>

            <ul aria-label="Ratings breakdown" className="flex flex-col gap-1 md:pl-6">
              {data.reviewBreakdown.map((row) => {
                const share =
                  data.reviewCount === 0 ? 0 : Math.round((row.count / data.reviewCount) * 100);
                return (
                  <li key={row.rating} className="flex items-center gap-2">
                    <span className="w-3 shrink-0 text-xs text-text-tertiary" data-numeric>
                      {row.rating}
                    </span>
                    <span
                      aria-hidden
                      className="h-1.5 min-w-1.5 flex-1 overflow-hidden rounded-full bg-bg-subtle"
                    >
                      <span
                        className="block h-full rounded-full bg-bg-brand"
                        style={{ width: `${String(share)}%` }}
                      />
                    </span>
                    <span className="w-8 shrink-0 text-right text-xs text-text-tertiary" data-numeric>
                      {row.count}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>

          {data.reviews.length === 0 ? (
            <div className="mt-4">
              <EmptyState
                title="No reviews yet"
                description="A buyer can review a shop once an order is delivered and they have confirmed it."
              />
            </div>
          ) : (
            <ul aria-label="Reviews" className="mt-2">
              {data.reviews.map((review) => (
                <li key={review.id} className="border-b border-border-subtle py-5 last:border-b-0">
                  <div className="flex items-center gap-3">
                    <span
                      aria-hidden
                      className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-bg-brand text-sm font-semibold text-text-on-brand"
                    >
                      {review.buyerName.slice(0, 1).toUpperCase()}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-text-primary">
                        {review.buyerName}
                      </p>
                      <Text tone="muted" size="xs">
                        {review.countryCode}
                      </Text>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-text-primary">
                      {review.productName}
                    </p>
                    <span className="text-sm text-text-brand" aria-label={`${String(review.rating)} out of 5`}>
                      {'★'.repeat(review.rating)}
                      <span className="text-text-tertiary">{'★'.repeat(5 - review.rating)}</span>
                    </span>
                    <Text tone="muted" size="xs">
                      {review.on}
                    </Text>
                  </div>

                  {review.body !== null && (
                    <Text size="sm" className="mt-2 block max-w-measure">
                      &ldquo;{review.body}&rdquo;
                    </Text>
                  )}

                  <div className="mt-3 flex flex-wrap items-start gap-6">
                    <div>
                      <p className="text-sm font-semibold text-text-primary" data-numeric>
                        {review.total}
                      </p>
                      <Text tone="muted" size="xs">
                        Total price
                      </Text>
                    </div>
                    <div className="border-l border-border-subtle pl-6">
                      <p className="text-sm font-semibold text-text-primary">
                        {review.durationDays === null
                          ? 'Not delivered yet'
                          : `${String(review.durationDays)} day${review.durationDays === 1 ? '' : 's'}`}
                      </p>
                      <Text tone="muted" size="xs">
                        Project duration
                      </Text>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      {tab === 'machines' && (
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xl font-semibold text-text-primary">Machines &amp; Processes</h2>
            <Button
              variant="tonal"
              size="xs"
              leadingIcon={<Icon name="plus" size={18} />}
              onClick={() => openMachineForm()}
            >
              Add New
            </Button>
          </div>

          {data.machines.length === 0 ? (
            <div className="mt-4">
              <EmptyState
                title="No machines listed"
                description="A buyer deciding between two shops reads this before the quote. What is on your floor, and what can it hold?"
                action={
                  <Button variant="secondary" size="sm" onClick={() => openMachineForm()}>
                    Add a machine
                  </Button>
                }
              />
            </div>
          ) : (
            <>
              <ul className="mt-4 grid grid-cols-1 gap-5 lg:grid-cols-2">
                {machinesOnPage.map((item) => (
                  <li
                    key={item.id}
                    className="flex flex-col rounded-xl border border-border-subtle bg-bg-surface p-4"
                  >
                    {/*
                      The design photographs each machine. Nothing here uploads a
                      photo yet, so the frame keeps its place and says what it is
                      rather than showing a stock picture of somebody else's shop.
                    */}
                    <div className="flex h-48 items-center justify-center rounded-lg border border-border-subtle bg-bg-subtle">
                      <Icon name="factory" size={40} className="text-icon-disabled" />
                    </div>

                    <div className="mt-4 flex items-start justify-between gap-2">
                      <p className="text-base font-medium text-text-primary">{item.name}</p>
                      <DropdownMenu
                        label={`Actions for ${item.name}`}
                        items={[
                          { id: 'edit', label: 'Edit', onSelect: () => openMachineForm(item) },
                          {
                            id: 'delete',
                            label: 'Delete',
                            tone: 'danger',
                            onSelect: () => dropMachine(item.id),
                          },
                        ]}
                        trigger={({ ref, onClick, ...aria }) => (
                          <button
                            ref={ref}
                            type="button"
                            onClick={onClick}
                            disabled={pending}
                            aria-label={`Actions for ${item.name}`}
                            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-text-tertiary hover:bg-bg-surface-raised focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus"
                            {...aria}
                          >
                            <Icon name="more" size={20} />
                          </button>
                        )}
                      />
                    </div>

                    <p className="mt-2 text-xs text-text-tertiary">Process</p>
                    <div className="mt-1">
                      <Badge tone="brand">{item.process}</Badge>
                    </div>

                    {item.subProcesses.length > 0 && (
                      <>
                        <p className="mt-3 text-xs text-text-tertiary">Sub Process</p>
                        <div className="mt-1 flex flex-wrap gap-2">
                          {item.subProcesses.map((sub) => (
                            <Badge key={sub} tone="brand">
                              {sub}
                            </Badge>
                          ))}
                        </div>
                      </>
                    )}

                    <div className="mt-auto pt-4">
                      <div className="flex items-start justify-between gap-4 border-t border-border-subtle pt-3">
                        <div>
                          <p className="text-xs text-text-tertiary">Tolerance</p>
                          <p className="mt-0.5 text-sm text-text-primary">
                            {item.tolerance ?? 'Not stated'}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-text-tertiary">TAT</p>
                          <p className="mt-0.5 text-sm text-text-primary">
                            {item.turnaroundTime ?? 'Not stated'}
                          </p>
                        </div>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
              <Pagination
                page={currentMachinePage}
                pageCount={machinePageCount}
                onChange={setMachinePage}
                className="mt-5"
              />
            </>
          )}
        </Card>
      )}

      {tab === 'capabilities' && (
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xl font-semibold text-text-primary">Capabilities</h2>
            <Button
              variant="tonal"
              size="xs"
              leadingIcon={<Icon name="plus" size={18} />}
              disabled={data.capabilitySheets.length >= CAPABILITY_KINDS.length}
              onClick={() => openSheetForm()}
            >
              Add New
            </Button>
          </div>

          {data.capabilitySheets.length === 0 ? (
            <div className="mt-4">
              <EmptyState
                title="No capability sheets yet"
                description="A sheet is what a buyer reads once a request has reached you — layer counts, tolerances, finishes, how long a build takes."
                action={
                  <Button variant="secondary" size="sm" onClick={() => openSheetForm()}>
                    Add a capability
                  </Button>
                }
              />
            </div>
          ) : (
            <ul className="mt-4 grid grid-cols-1 gap-5 lg:grid-cols-2">
              {data.capabilitySheets.map((entry) => {
                const spec = findCapabilityKind(entry.kind);
                const verified = entry.verification === 'verified';
                return (
                  <li
                    key={entry.id}
                    className="flex flex-col rounded-xl border border-border-subtle bg-bg-surface"
                  >
                    <div className="flex items-start justify-between gap-2 border-b border-border-subtle p-4">
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-bg-brand-subtle text-icon-brand">
                          <Icon name={spec?.icon ?? 'grid'} size={20} />
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-text-primary">
                            {entry.title}
                          </p>
                          <Text tone="muted" size="xs">
                            {entry.parameters.length}{' '}
                            {entry.parameters.length === 1 ? 'Parameter' : 'Parameters'}
                          </Text>
                        </div>
                      </div>
                      <DropdownMenu
                        label={`Actions for ${entry.title}`}
                        items={[
                          { id: 'edit', label: 'Edit', onSelect: () => openSheetForm(entry) },
                          {
                            id: 'delete',
                            label: 'Delete',
                            tone: 'danger',
                            onSelect: () => dropSheet(entry.id),
                          },
                        ]}
                        trigger={({ ref, onClick, ...aria }) => (
                          <button
                            ref={ref}
                            type="button"
                            onClick={onClick}
                            disabled={pending}
                            aria-label={`Actions for ${entry.title}`}
                            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-text-tertiary hover:bg-bg-surface-raised focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus"
                            {...aria}
                          >
                            <Icon name="more" size={20} />
                          </button>
                        )}
                      />
                    </div>

                    <ul aria-label={`${entry.title} parameters`} className="flex flex-col gap-2.5 p-4">
                      {entry.parameters.map((row) => (
                        <li key={row.id} className="flex items-start justify-between gap-3">
                          <Text tone="muted" size="sm" className="shrink-0">
                            {row.label}
                          </Text>
                          <span className="flex flex-wrap justify-end gap-1.5">
                            {row.values.map((value) => (
                              <Badge key={value} tone="brand">
                                {value}
                              </Badge>
                            ))}
                          </span>
                        </li>
                      ))}
                    </ul>

                    {/*
                      Whether IDEEZA has read the evidence, in the platform's own
                      voice. Nothing a shop does sets this to Verified — that is
                      the point of showing it.
                    */}
                    <div className="mt-auto flex items-center justify-between gap-3 border-t border-border-subtle p-4">
                      <Text tone="muted" size="sm">
                        Verification Status
                      </Text>
                      <Badge tone={verified ? 'success' : 'warning'}>
                        <span className="inline-flex items-center gap-1">
                          <Icon name={verified ? 'check-circle' : 'clock'} size={14} />
                          {verified ? 'Verified' : 'Pending'}
                        </span>
                      </Badge>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      )}

      {tab === 'blog' && (
        <Card>
          {data.articles.length === 0 ? (
            <EmptyState
              title="Nothing written yet"
              description="Write from the Blog section in the rail; what you publish appears here for buyers to read."
            />
          ) : (
            <ul aria-label="Articles">
              {data.articles.map((article) => (
                <li
                  key={article.id}
                  className="flex flex-col gap-4 border-b border-border-subtle py-5 first:pt-0 last:border-b-0 last:pb-0 sm:flex-row"
                >
                  {/*
                    No article carries a cover image yet — nothing uploads one —
                    so the frame is drawn from the title, the way the draft and
                    model previews are. It keeps the row's shape without
                    pretending to be a photograph somebody chose.
                  */}
                  <span
                    aria-hidden
                    className="h-40 w-full shrink-0 rounded-lg bg-gradient-to-br from-bg-brand-subtle to-bg-info-subtle sm:h-[158px] sm:w-[236px]"
                  />
                  <div className="min-w-0 flex-1">
                    <Text tone="muted" size="xs" className="block">
                      {data.displayName} · {article.on}
                    </Text>
                    <p className="mt-1 text-base font-semibold text-text-primary">
                      {article.title}
                    </p>
                    <Text size="sm" className="mt-1 block max-w-measure">
                      {article.excerpt}
                    </Text>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      {article.tags.map((entry) => (
                        <span
                          key={entry}
                          className="inline-flex items-center rounded-lg border border-border-brand px-3 py-1 text-xs text-text-brand"
                        >
                          {entry}
                        </span>
                      ))}
                      {/*
                        A draft or a rejection is not what a buyer sees, and a
                        shop reading its own profile has to be able to tell
                        which is which.
                      */}
                      {article.status !== 'published' && (
                        <Badge
                          tone={
                            article.status === 'rejected'
                              ? 'danger'
                              : article.status === 'in_review'
                                ? 'warning'
                                : 'neutral'
                          }
                        >
                          {article.status.replace(/_/g, ' ')}
                        </Badge>
                      )}
                    </div>
                    {article.rejectReason !== null && (
                      <Text size="xs" className="mt-2 block max-w-measure text-text-error">
                        {article.rejectReason}
                      </Text>
                    )}
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
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-xl font-semibold text-text-primary">Certifications</h2>
              <Button
                variant="tonal"
                size="xs"
                leadingIcon={<Icon name="plus" size={18} />}
                onClick={openCertificateForm}
              >
                Add New
              </Button>
            </div>

            {data.certificates.length === 0 ? (
              <div className="mt-4">
                <EmptyState
                  title="No certificates yet"
                  description="A buyer choosing between two shops reads these first. Add what you hold; IDEEZA marks it verified once it has seen the certificate."
                  action={
                    <Button variant="secondary" size="sm" onClick={openCertificateForm}>
                      Add a certificate
                    </Button>
                  }
                />
              </div>
            ) : (
              <ul className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {data.certificates.map((entry) => {
                  const standing =
                    CERTIFICATE_STANDING[entry.status] ?? CERTIFICATE_STANDING['pending'];
                  return (
                    <li
                      key={entry.id}
                      className="flex flex-col rounded-xl border border-border-subtle bg-bg-surface"
                    >
                      <div className="flex items-start gap-3 p-4">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-bg-brand-subtle text-icon-brand">
                          <Icon name="check-circle" size={20} />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-text-primary">
                            {entry.name}
                          </p>
                          <Text tone="muted" size="xs">
                            {entry.issuingAuthority ?? 'Issuer not stated'}
                          </Text>
                        </div>
                        <DropdownMenu
                          label={`Actions for ${entry.name}`}
                          items={[
                            {
                              id: 'delete',
                              label: 'Delete',
                              tone: 'danger',
                              onSelect: () => dropCertificate(entry.id),
                            },
                          ]}
                          trigger={({ ref, onClick, ...aria }) => (
                            <button
                              ref={ref}
                              type="button"
                              onClick={onClick}
                              disabled={pending}
                              aria-label={`Actions for ${entry.name}`}
                              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-text-tertiary hover:bg-bg-surface-raised focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus"
                              {...aria}
                            >
                              <Icon name="more" size={20} />
                            </button>
                          )}
                        />
                      </div>
                      <div className="mt-auto flex items-center justify-between gap-2 border-t border-border-subtle px-4 py-3">
                        <Text tone="muted" size="xs">
                          {entry.category ?? 'Uncategorised'}
                        </Text>
                        {/*
                          Whose word this is. "Verified" is IDEEZA's, "By IDEEZA"
                          means the platform issued it, and a shop's own claim
                          reads Pending until somebody has seen the certificate.
                        */}
                        <Badge tone={standing?.tone ?? 'warning'}>
                          <span className="inline-flex items-center gap-1">
                            <Icon name={standing?.icon ?? 'clock'} size={14} />
                            {standing?.label ?? 'Pending'}
                          </span>
                        </Badge>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          <Card>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-xl font-semibold text-text-primary">Service</h2>
              <DropdownMenu
                label="Actions for services"
                items={[
                  {
                    id: 'edit',
                    label: 'Edit',
                    onSelect: () => {
                      setError(undefined);
                      setServices(data.services);
                      setEditing('service');
                    },
                  },
                ]}
                trigger={({ ref, onClick, ...aria }) => (
                  <button
                    ref={ref}
                    type="button"
                    onClick={onClick}
                    disabled={pending}
                    aria-label="Actions for services"
                    className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-text-tertiary hover:bg-bg-surface-raised focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus"
                    {...aria}
                  >
                    <Icon name="more" size={20} />
                  </button>
                )}
              />
            </div>
            {data.services.length === 0 ? (
              <Text tone="muted" size="sm" className="mt-3 block">
                None published — no request can reach you until at least one is.
              </Text>
            ) : (
              <div className="mt-4 flex flex-wrap gap-2">
                {data.services.map((service) => (
                  <span
                    key={service}
                    className="inline-flex items-center rounded-lg border border-border px-3 py-1.5 text-sm text-text-primary"
                  >
                    {SERVICE_OPTIONS.find((option) => option.value === service)?.label ??
                      service.replace(/_/g, ' ')}
                  </span>
                ))}
              </div>
            )}
          </Card>

          <Card>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-xl font-semibold text-text-primary">Equipment</h2>
              <Button
                variant="tonal"
                size="xs"
                leadingIcon={<Icon name="plus" size={18} />}
                onClick={() => {
                  setError(undefined);
                  setEquipment({ name: '', quantity: '1' });
                  setEditing('equipment');
                }}
              >
                Add New
              </Button>
            </div>

            {data.equipment.length === 0 ? (
              <div className="mt-4">
                <EmptyState
                  title="No equipment counted yet"
                  description="How many of each machine you run. The Machine & process tab is what each one does; this is how much of it there is."
                />
              </div>
            ) : (
              <>
                <ul className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {equipmentOnPage.map((item) => (
                    <li
                      key={item.id}
                      className="flex items-start justify-between gap-2 rounded-xl border border-border-subtle bg-bg-surface p-4"
                    >
                      <div className="min-w-0">
                        <p className="text-lg font-semibold text-text-primary" data-numeric>
                          {String(item.quantity).padStart(2, '0')}
                        </p>
                        <Text tone="muted" size="sm" className="block truncate">
                          {item.name}
                        </Text>
                      </div>
                      <DropdownMenu
                        label={`Actions for ${item.name}`}
                        items={[
                          {
                            id: 'delete',
                            label: 'Delete',
                            tone: 'danger',
                            onSelect: () => dropEquipment(item.id),
                          },
                        ]}
                        trigger={({ ref, onClick, ...aria }) => (
                          <button
                            ref={ref}
                            type="button"
                            onClick={onClick}
                            disabled={pending}
                            aria-label={`Actions for ${item.name}`}
                            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-text-tertiary hover:bg-bg-surface-raised focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus"
                            {...aria}
                          >
                            <Icon name="more" size={20} />
                          </button>
                        )}
                      />
                    </li>
                  ))}
                </ul>
                <Pagination
                  page={currentEquipmentPage}
                  pageCount={equipmentPageCount}
                  onChange={setEquipmentPage}
                  className="mt-5"
                />
              </>
            )}
          </Card>

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

        </>
      )}

      {tab === 'agent' && (
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xl font-semibold text-text-primary">Agent</h2>
            {/*
              Inviting somebody means creating an account for them, and this
              build has no invitation, no acceptance and no way for that person
              to set a password. The control is drawn where the design has it
              and says what is true, because a button that opened a form and
              then did nothing would be worse than one that admits it.
            */}
            <Button
              variant="tonal"
              size="xs"
              leadingIcon={<Icon name="plus" size={18} />}
              disabled
              title="Inviting a teammate needs an account for them, which this build does not create yet."
            >
              Add New
            </Button>
          </div>

          {data.members.length === 0 ? (
            <div className="mt-4">
              <EmptyState
                title="Nobody is listed yet"
                description="The people in this shop, as a buyer sees them."
              />
            </div>
          ) : (
            <>
              <ul className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {membersOnPage.map((member) => (
                  <li
                    key={member.id}
                    className="relative flex flex-col items-center gap-1 rounded-xl border border-border-subtle bg-bg-surface px-4 py-6 text-center"
                  >
                    <div className="absolute right-2 top-2">
                      <DropdownMenu
                        label={`Actions for ${member.name}`}
                        items={[
                          {
                            id: 'role',
                            label: 'Edit role',
                            onSelect: () => {
                              setError(undefined);
                              setMemberEdit({ id: member.id, title: member.title ?? '' });
                              setEditing('member');
                            },
                          },
                        ]}
                        trigger={({ ref, onClick, ...aria }) => (
                          <button
                            ref={ref}
                            type="button"
                            onClick={onClick}
                            disabled={pending}
                            aria-label={`Actions for ${member.name}`}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-text-tertiary hover:bg-bg-surface-raised focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus"
                            {...aria}
                          >
                            <Icon name="more" size={20} />
                          </button>
                        )}
                      />
                    </div>
                    <span
                      aria-hidden
                      className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-bg-brand text-base font-semibold text-text-on-brand"
                    >
                      {member.name.slice(0, 1).toUpperCase()}
                    </span>
                    <p className="mt-2 text-sm font-semibold text-text-primary">{member.name}</p>
                    <Text tone="muted" size="xs">
                      {member.title ?? (member.owner ? 'Owner' : 'Role not set')}
                    </Text>
                  </li>
                ))}
              </ul>
              <Pagination
                page={currentMemberPage}
                pageCount={memberPageCount}
                onChange={setMemberPage}
                className="mt-5"
              />
            </>
          )}
        </Card>
      )}

      <Modal
        open={editing === 'member'}
        onClose={() => setEditing(null)}
        title="Edit role"
        description="What this person does here. A buyer reads it; nothing in the platform acts on it."
        size="sm"
        footer={
          <div className="grid w-full grid-cols-2 gap-3">
            <Button variant="secondary" fullWidth onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              fullWidth
              loading={pending || !hydrated}
              disabled={!hydrated}
              onClick={saveMemberTitle}
            >
              Save
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          <FormField
            label="Role"
            hint="Leave it empty to take the role off the card. This is not a permission."
          >
            <Input
              value={memberEdit.title}
              maxLength={60}
              placeholder="eg: Director of Engineering"
              onChange={(event) => setMemberEdit({ ...memberEdit, title: event.target.value })}
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
        open={editing === 'certificate'}
        onClose={() => setEditing(null)}
        title="Add new certification"
        description="What you hold. IDEEZA marks it verified once it has seen the certificate."
        size="sm"
        footer={
          <div className="grid w-full grid-cols-2 gap-3">
            <Button variant="secondary" fullWidth onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              fullWidth
              loading={pending || !hydrated}
              disabled={!hydrated}
              onClick={saveCertificate}
            >
              Add
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          <FormField label="Certification name" required>
            <Select
              options={CERTIFICATE_CATALOGUE.map((entry) => ({
                value: entry.name,
                label: entry.name,
                // Already on the profile: adding it twice would show a buyer
                // the same certificate with two different standings.
                disabled: data.certificates.some((row) => row.name === entry.name),
              }))}
              placeholder="Select a Name"
              value={certificate.name}
              onChange={(event) => chooseCertificate(event.target.value)}
            />
          </FormField>
          <FormField
            label="Category"
            hint="Filled in from the name; change it if yours covers something else."
          >
            <Select
              options={CERTIFICATE_CATEGORIES.map((name) => ({ value: name, label: name }))}
              placeholder="Select a Category"
              value={certificate.category}
              onChange={(event) =>
                setCertificate({ ...certificate, category: event.target.value })
              }
            />
          </FormField>
          <FormField label="Issuing Authority">
            <Select
              options={CERTIFICATE_AUTHORITIES.map((name) => ({ value: name, label: name }))}
              placeholder="eg: ISO"
              value={certificate.issuingAuthority}
              onChange={(event) =>
                setCertificate({ ...certificate, issuingAuthority: event.target.value })
              }
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
        open={editing === 'equipment'}
        onClose={() => setEditing(null)}
        title="Add New Equipment"
        description="How many of each machine you run."
        size="sm"
        footer={
          <div className="grid w-full grid-cols-2 gap-3">
            <Button variant="secondary" fullWidth onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              fullWidth
              loading={pending || !hydrated}
              disabled={!hydrated}
              onClick={saveEquipment}
            >
              Add
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          <FormField label="Equipment Name" required>
            <Input
              value={equipment.name}
              maxLength={80}
              placeholder="Write equipment Name"
              onChange={(event) => setEquipment({ ...equipment, name: event.target.value })}
            />
          </FormField>
          <FormField label="Quantity" required>
            <Input
              type="number"
              min={1}
              max={999}
              placeholder="eg: 3"
              value={equipment.quantity}
              onChange={(event) => setEquipment({ ...equipment, quantity: event.target.value })}
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
        open={editing === 'service'}
        onClose={() => setEditing(null)}
        title="Add New Service"
        description="This one is not decoration: a request only reaches you if these cover it."
        size="sm"
        footer={
          <div className="grid w-full grid-cols-2 gap-3">
            <Button variant="secondary" fullWidth onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              fullWidth
              loading={pending || !hydrated}
              disabled={!hydrated}
              onClick={saveServices}
            >
              Save
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          {/*
            The design draws a searchable multi-select. With this many services
            a search box would be a box nobody types in, so the same answer is
            asked as chips — every option visible, one tap each.
          */}
          <ChoiceChips
            label="Service Name"
            options={SERVICE_OPTIONS.map((option) => option.label)}
            value={SERVICE_OPTIONS.filter((option) => services.includes(option.value)).map(
              (option) => option.label,
            )}
            onChange={(next) =>
              setServices(
                SERVICE_OPTIONS.filter((option) => next.includes(option.label)).map(
                  (option) => option.value,
                ),
              )
            }
            hint="Publishing none of them takes you out of matching entirely."
          />
          {error !== undefined && (
            <Alert tone="danger" title="Not saved">
              {error}
            </Alert>
          )}
        </div>
      </Modal>

      <Modal
        open={editing === 'sheet'}
        onClose={() => setEditing(null)}
        title={sheetId === null ? 'Add New Capability' : 'Edit Capability'}
        description="What a buyer reads once a request has reached you."
        size="sm"
        footer={
          <div className="w-full">
            <Button
              variant="primary"
              fullWidth
              loading={pending || !hydrated}
              disabled={!hydrated || !sheetReady}
              onClick={saveSheet}
            >
              {sheetId === null ? 'Add Now' : 'Save changes'}
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          <FormField
            label="Select Capability type"
            hint={
              sheetId === null
                ? 'One sheet for each kind of work. Changing this starts the answers again.'
                : 'A published sheet keeps its kind; add another for different work.'
            }
          >
            <Select
              options={CAPABILITY_KIND_OPTIONS.map((option) => ({
                ...option,
                // One sheet per kind: a shop with two PCB sheets would show a
                // buyer two answers to the same question.
                disabled:
                  sheetId === null &&
                  data.capabilitySheets.some((row) => row.kind === option.value),
              }))}
              value={sheet.kind}
              disabled={sheetId !== null}
              onChange={(event) => setSheet(emptySheet(event.target.value))}
            />
          </FormField>

          {(sheetSpec?.fields ?? []).map((field) => {
            const chosen = sheet.answers[field.id] ?? [];
            if (field.control === 'chips') {
              return (
                <ChoiceChips
                  key={field.id}
                  label={field.formLabel}
                  required={field.required}
                  single={field.single ?? false}
                  options={field.options ?? []}
                  value={chosen}
                  onChange={(next) => setAnswer(field.id, next)}
                />
              );
            }
            if (field.control === 'select') {
              return (
                <FormField key={field.id} label={field.formLabel} required={field.required}>
                  <Select
                    options={(field.options ?? []).map((option) => ({
                      value: option,
                      label: option,
                    }))}
                    placeholder={field.placeholder ?? `Select ${field.formLabel}`}
                    value={chosen[0] ?? ''}
                    onChange={(event) => setAnswer(field.id, [event.target.value])}
                  />
                </FormField>
              );
            }
            return (
              <FormField key={field.id} label={field.formLabel} required={field.required}>
                <Input
                  value={chosen[0] ?? ''}
                  maxLength={80}
                  placeholder={field.placeholder ?? ''}
                  onChange={(event) => setAnswer(field.id, [event.target.value])}
                />
              </FormField>
            );
          })}

          {/*
            The design's dropzone. The file itself goes nowhere in this build —
            there is no store behind it — so the sheet records the names offered
            and the hint says exactly that. A required field that silently threw
            the file away would be worse than an honest optional one.
          */}
          <FormField
            label="Attachments"
            hint="The names are kept with the sheet; the files themselves are not uploaded in this build."
          >
            <label className="flex cursor-pointer flex-col items-center gap-1 rounded-lg border border-dashed border-border px-6 py-8 text-center transition-colors hover:bg-bg-subtle focus-within:ring-3 focus-within:ring-focus">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-bg-brand-subtle text-icon-brand">
                <Icon name="send" size={18} />
              </span>
              <span className="mt-1 text-sm font-medium text-text-primary">
                Click or drag a file to upload
              </span>
              <span className="text-xs text-text-tertiary">
                PNG, JPG, PDF, DOC, GIF, Video or DOCX
              </span>
              <input
                type="file"
                multiple
                className="sr-only"
                onChange={(event) =>
                  setSheet((current) => ({
                    ...current,
                    attachments: Array.from(event.target.files ?? []).map((file) => file.name),
                  }))
                }
              />
            </label>
          </FormField>
          {sheet.attachments.length > 0 && (
            <ul className="-mt-2 flex flex-wrap gap-2">
              {sheet.attachments.map((name) => (
                <li key={name}>
                  <Tag>{name}</Tag>
                </li>
              ))}
            </ul>
          )}

          {error !== undefined && (
            <Alert tone="danger" title="Not saved">
              {error}
            </Alert>
          )}
        </div>
      </Modal>

      <Modal
        open={editing === 'machine'}
        onClose={() => setEditing(null)}
        title={machineId === null ? 'Add Manufacturing Capability' : 'Edit Manufacturing Capability'}
        description="What is on your floor, and what it can hold. Buyers read this before they choose."
        size="sm"
        footer={
          <div className="grid w-full grid-cols-2 gap-3">
            <Button variant="secondary" fullWidth onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              fullWidth
              loading={pending || !hydrated}
              disabled={!hydrated}
              onClick={saveMachine}
            >
              {machineId === null ? 'Add' : 'Save'}
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          <FormField label="Machine" required>
            <Select
              options={MACHINE_OPTIONS}
              placeholder="Select machine"
              value={machine.name}
              onChange={(event) => setMachine({ ...machine, name: event.target.value })}
            />
          </FormField>
          <FormField label="Select Process" required>
            <Select
              options={PROCESS_OPTIONS}
              placeholder="Select Process"
              value={machine.process}
              // Changing the process drops the sub-processes with it: they
              // belong to the process, and keeping "Reflow" under CNC machining
              // would publish a line this shop does not have.
              onChange={(event) =>
                setMachine({ ...machine, process: event.target.value, subProcesses: [] })
              }
            />
          </FormField>
          <FormField
            label="Select Sub-Process"
            hint={
              machine.process === ''
                ? 'Choose a process first.'
                : 'Choose them one at a time; a machine usually does several.'
            }
          >
            <Select
              options={(SUB_PROCESSES[machine.process] ?? []).map((name) => ({
                value: name,
                label: name,
              }))}
              placeholder="Select sub-process"
              disabled={machine.process === ''}
              value=""
              onChange={(event) => addSubProcess(event.target.value)}
            />
          </FormField>
          {machine.subProcesses.length > 0 && (
            <div className="-mt-2 flex flex-wrap gap-2">
              {machine.subProcesses.map((sub) => (
                <button
                  key={sub}
                  type="button"
                  onClick={() =>
                    setMachine({
                      ...machine,
                      subProcesses: machine.subProcesses.filter((entry) => entry !== sub),
                    })
                  }
                  aria-label={`Remove ${sub}`}
                  className="rounded-full focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus"
                >
                  <Badge tone="brand">{sub} ✕</Badge>
                </button>
              ))}
            </div>
          )}
          <FormField label="Tolerance">
            <Select
              options={TOLERANCE_OPTIONS}
              placeholder="Select Tolerance"
              value={machine.tolerance}
              onChange={(event) => setMachine({ ...machine, tolerance: event.target.value })}
            />
          </FormField>
          <FormField label="Turnaround time">
            <Input
              value={machine.turnaroundTime}
              maxLength={60}
              placeholder="eg: 3-7 Days"
              onChange={(event) =>
                setMachine({ ...machine, turnaroundTime: event.target.value })
              }
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
