import type { IconName } from '@ideeza/ui';

/**
 * What a capability sheet asks, per kind of work.
 *
 * The Figma "Add New Capability" popup is a different form for each kind — a
 * PCB shop is asked for layer counts and copper weights, a print shop for
 * technologies and resolutions — and the card on the profile then lists the
 * answers back. Both read this table, so a field cannot exist on the form and
 * be missing from the card, or be labelled one thing in one place and another
 * in the other.
 *
 * The form label and the card label differ on purpose, as the design has them:
 * the form asks "Material Support" because it is a question, the card says
 * "Material" because it is an answer in a narrow column.
 *
 * The vocabulary is the design's, tidied where it was plainly a slip —
 * "Immersion Ting" is immersion tin, "Hologen-Free" is halogen-free, "IPC
 * Closes" is the IPC class. A shop publishing a misspelt finish to a buyer is
 * the kind of small wrongness nobody owns later.
 */
export type CapabilityKind =
  | 'pcb_fabrication'
  | 'pcb_assembly'
  | 'printing_3d'
  | 'cnc_machining'
  | 'injection_moulding';

export interface CapabilityField {
  /** Stable key. Answers are stored under `cardLabel`, this is for React. */
  readonly id: string;
  readonly formLabel: string;
  readonly cardLabel: string;
  readonly control: 'select' | 'chips' | 'text';
  readonly required: boolean;
  readonly options?: readonly string[];
  readonly placeholder?: string;
  /** Chips that take one answer rather than several. */
  readonly single?: boolean;
}

export interface CapabilityKindSpec {
  readonly kind: CapabilityKind;
  /** What the card and the type list call it. */
  readonly label: string;
  readonly icon: IconName;
  readonly fields: readonly CapabilityField[];
}

/** Every sheet ends with the same two questions, so they are written once. */
const buildTime: CapabilityField = {
  id: 'build-time',
  formLabel: 'Build Time',
  cardLabel: 'Build time',
  control: 'text',
  required: false,
  placeholder: '24-48 Hours',
};

export const CAPABILITY_KINDS: readonly CapabilityKindSpec[] = [
  {
    kind: 'pcb_fabrication',
    label: 'PCB Manufacturing',
    icon: 'board',
    fields: [
      {
        id: 'layers',
        formLabel: 'Supported Layers',
        cardLabel: 'Layer support',
        control: 'select',
        required: true,
        placeholder: 'Select Supported Layers',
        options: [
          '1 layer',
          '2 layers',
          '4 layers',
          '6 layers',
          '8 layers',
          '10 layers',
          '12 layers',
          '16 layers',
          '20+ layers',
        ],
      },
      {
        id: 'hole',
        formLabel: 'Min Hole size',
        cardLabel: 'Min hole size',
        control: 'select',
        required: true,
        placeholder: 'Select Hole size',
        options: ['0.1mm', '0.15mm', '0.2mm', '0.25mm', '0.3mm', '0.4mm'],
      },
      {
        id: 'finish',
        formLabel: 'Surface Finish',
        cardLabel: 'Surface finish',
        control: 'chips',
        required: true,
        options: [
          'HASL',
          'Hard Gold',
          'ENIG',
          'Immersion Tin',
          'OSP',
          'ENEPIG',
          'Lead-Free HASL',
        ],
      },
      {
        id: 'material',
        formLabel: 'Material Support',
        cardLabel: 'Material',
        control: 'chips',
        required: false,
        options: [
          'FR-4',
          'High-Tg FR4',
          'Halogen-Free',
          'Rogers 4350',
          'Polyimide',
          'Aluminium',
          'Copper Core',
        ],
      },
      {
        id: 'copper',
        formLabel: 'Copper Weight',
        cardLabel: 'Copper',
        control: 'chips',
        required: false,
        options: ['0.5oz', '1oz', '2oz', '3oz', '4oz', '5oz'],
      },
      {
        id: 'impedance',
        formLabel: 'Impedance Control',
        cardLabel: 'Impedance',
        control: 'select',
        required: false,
        placeholder: 'Select Impedance Control',
        options: ['plus or minus 5%', 'plus or minus 7%', 'plus or minus 10%', 'Not offered'],
      },
      buildTime,
    ],
  },
  {
    kind: 'pcb_assembly',
    label: 'PCB Assembly (PCBA)',
    icon: 'layers',
    fields: [
      {
        id: 'technology',
        formLabel: 'Assembly Technology',
        cardLabel: 'Technology',
        control: 'chips',
        required: true,
        options: ['SMT', 'Through-Hole', 'Mixed', 'BGA', 'QFN', 'Press-Fit'],
      },
      {
        id: 'component',
        formLabel: 'Min Component size',
        cardLabel: 'Min component size',
        control: 'select',
        required: true,
        placeholder: 'Select component size',
        options: ['01005', '0201', '0402', '0603', '0805'],
      },
      {
        id: 'ipc',
        formLabel: 'IPC Class',
        cardLabel: 'IPC class',
        control: 'select',
        required: true,
        placeholder: 'Select IPC Class',
        options: ['Class 1', 'Class 2', 'Class 3'],
      },
      {
        id: 'lines',
        formLabel: 'SMT Lines',
        cardLabel: 'SMT lines',
        control: 'select',
        required: true,
        placeholder: 'Select SMT Lines',
        options: ['1 line', '2 lines', '3 lines', '4 lines', '5+ lines'],
      },
      buildTime,
    ],
  },
  {
    kind: 'printing_3d',
    label: '3D Printing',
    icon: 'cube',
    fields: [
      {
        id: 'technology',
        formLabel: 'Technology Type',
        cardLabel: 'Technology',
        control: 'chips',
        required: true,
        options: ['FDM', 'SLA', 'SLS', 'MJF', 'DMLS', 'PolyJet', 'SLM', 'Carbon DLS'],
      },
      {
        id: 'material',
        formLabel: 'Material Support',
        cardLabel: 'Material',
        control: 'chips',
        required: true,
        options: [
          'PLA',
          'ABS',
          'PETG',
          'Nylon (PA12)',
          'Nylon GF',
          'TPU',
          'Resin (Standard)',
          'Resin (Tough)',
          'Stainless 316L',
          'Titanium Ti-6Al-4V',
          'Aluminium AlSi10Mg',
          'Inconel 718',
        ],
      },
      {
        id: 'size',
        formLabel: 'Max Print size',
        cardLabel: 'Max print size',
        control: 'text',
        required: true,
        placeholder: 'eg: 500 x 500 mm',
      },
      {
        id: 'resolution',
        formLabel: 'Resolution',
        cardLabel: 'Resolution',
        control: 'text',
        required: true,
        placeholder: 'eg: 25 micron layer height',
      },
      {
        id: 'batch',
        formLabel: 'Batch Production support',
        cardLabel: 'Batch production',
        control: 'chips',
        required: true,
        single: true,
        options: ['Yes', 'Limited', 'No'],
      },
      buildTime,
    ],
  },
  {
    kind: 'cnc_machining',
    label: 'CNC Machining',
    icon: 'settings',
    fields: [
      {
        id: 'axis',
        formLabel: 'Axis Support',
        cardLabel: 'Axis',
        control: 'chips',
        required: true,
        options: ['3-Axis', '4-Axis', '5-Axis', 'Mill-Turn', 'Swiss'],
      },
      {
        id: 'material',
        formLabel: 'Material Support',
        cardLabel: 'Material',
        control: 'chips',
        required: false,
        options: [
          'Aluminium 6061',
          'Aluminium 7075',
          'Stainless 304',
          'Stainless 316',
          'Brass',
          'Copper',
          'Titanium',
          'Delrin',
          'PEEK',
          'ABS',
        ],
      },
      {
        id: 'tolerance',
        formLabel: 'Tolerance',
        cardLabel: 'Tolerance',
        control: 'select',
        required: true,
        placeholder: 'Select Tolerance',
        options: [
          'plus or minus 0.025mm',
          'plus or minus 0.05mm',
          'plus or minus 0.1mm',
          'plus or minus 0.25mm',
          'ISO 2768-f',
          'ISO 2768-m',
        ],
      },
      {
        id: 'area',
        formLabel: 'Max work Area',
        cardLabel: 'Max work area',
        control: 'select',
        required: true,
        placeholder: 'Select work area',
        options: [
          '400 x 400 x 300 mm',
          '800 x 500 x 400 mm',
          '1200 x 700 x 500 mm',
          '2000 x 1000 x 800 mm',
        ],
      },
      {
        id: 'finish',
        formLabel: 'Surface Finish',
        cardLabel: 'Finish',
        control: 'chips',
        required: false,
        options: [
          'As-Machined',
          'Bead Blast',
          'Anodize type II',
          'Black oxide',
          'Electropolish',
          'Powder coat',
        ],
      },
      buildTime,
    ],
  },
  {
    kind: 'injection_moulding',
    label: 'Injection Molding',
    icon: 'factory',
    fields: [
      {
        id: 'mould',
        formLabel: 'Mold type',
        cardLabel: 'Mold type',
        control: 'chips',
        required: true,
        options: [
          'Prototype (Aluminium)',
          'Production (P20)',
          'Production (H13)',
          'Overmold',
          'Insert Mold',
          'Multi-Cavity',
        ],
      },
      {
        id: 'material',
        formLabel: 'Material type',
        cardLabel: 'Material',
        control: 'chips',
        required: true,
        options: [
          'ABS',
          'PC',
          'PC/ABS',
          'PP',
          'Nylon',
          'Nylon GF',
          'POM',
          'TPU',
          'TPE',
          'Silicone',
          'PEEK',
        ],
      },
      {
        id: 'tonnage',
        formLabel: 'Press Tonnage',
        cardLabel: 'Press tonnage',
        control: 'text',
        required: false,
        placeholder: 'eg: 50-100 ton',
      },
      {
        id: 'shot',
        formLabel: 'Max shot size',
        cardLabel: 'Max shot size',
        control: 'text',
        required: false,
        placeholder: 'eg: 2500 g',
      },
      buildTime,
    ],
  },
];

export const findCapabilityKind = (kind: string): CapabilityKindSpec | undefined =>
  CAPABILITY_KINDS.find((entry) => entry.kind === kind);

/** What the type list in the popup shows, in the design's order. */
export const CAPABILITY_KIND_OPTIONS = CAPABILITY_KINDS.map((entry) => ({
  value: entry.kind,
  label: entry.label,
}));
