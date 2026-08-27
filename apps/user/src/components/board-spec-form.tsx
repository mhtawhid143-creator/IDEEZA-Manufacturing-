'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';
import {
  Alert,
  Button,
  Checkbox,
  FormField,
  OptionChips,
  SpecSection,
  Text,
  Textarea,
  buttonAppearance,
  useToast,
} from '@ideeza/ui';
import {
  BASE_MATERIALS,
  BASE_MATERIAL_LABEL,
  BOARD_COLORS,
  BOARD_PACKAGINGS,
  BOARD_PACKAGING_LABEL,
  BOARD_SURFACE_FINISHES,
  BOARD_THICKNESSES_MM,
  COPPER_WEIGHTS_OZ,
  DELIVERY_FORMATS,
  DELIVERY_FORMAT_LABEL,
  ELECTRICAL_TESTS,
  ELECTRICAL_TEST_LABEL,
  LAYER_COUNTS,
  MARKS_ON_BOARD,
  MARK_ON_BOARD_LABEL,
  MIN_VIA_HOLES_MM,
  OUTLINE_TOLERANCES_MM,
  SILKSCREEN_COLORS,
  SUPPLIED_BY,
  SUPPLIED_BY_LABEL,
  SURFACE_FINISH_LABEL_BOARD,
  UL_MARKINGS,
  UL_MARKING_LABEL,
  VIA_COVERINGS,
  VIA_COVERING_LABEL,
  WORKMANSHIP_CLASSES,
  WORKMANSHIP_CLASS_LABEL,
} from '@ideeza/domain';
import { saveBoardSpecAction } from '@/app/(app)/manufacturing/draft/spec-actions.js';
import { goTo } from '@/lib/navigate.js';

export interface BoardSpecFormValues {
  readonly baseMaterial: string;
  readonly layerCount: string;
  readonly thicknessMm: string;
  readonly boardColor: string;
  readonly silkscreenColor: string;
  readonly surfaceFinish: string;
  readonly outerCopperOz: string;
  readonly innerCopperOz: string;
  readonly viaCovering: string;
  readonly minViaHoleMm: string;
  readonly outlineToleranceMm: string;
  readonly deliveryFormat: string;
  readonly distinctDesigns: string;
  readonly electricalTest: string;
  readonly goldFingers: boolean;
  readonly castellatedHoles: boolean;
  readonly edgePlating: boolean;
  readonly blindOrBuriedVias: boolean;
  readonly ulMarking: string;
  readonly markOnBoard: string;
  readonly workmanshipClass: string;
  readonly packaging: string;
  readonly assembledFace: string;
  readonly partsSuppliedBy: string;
  readonly toolingHolesAddedBy: string;
  readonly conformalCoating: boolean;
  readonly functionalTest: boolean;
  readonly stencilRequired: boolean;
  readonly remarks: string;
}

export interface BoardSpecFormProps {
  readonly draftId: string;
  readonly values: BoardSpecFormValues;
  readonly assembling: boolean;
  readonly bothSides: boolean;
  readonly readOnly: boolean;
  readonly boardFiles: readonly string[];
}

const SWATCH: Readonly<Record<string, string>> = {
  green: '#0f7b3f',
  black: '#111111',
  white: '#f5f5f5',
  blue: '#1d4ed8',
  red: '#dc2626',
  yellow: '#f5c518',
  purple: '#7c3aed',
};

const titleCase = (value: string): string =>
  value.charAt(0).toUpperCase() + value.slice(1).replace(/_/g, ' ');

/**
 * The detailed board specification, edited from the draft.
 *
 * The layout is the design's: sections with a grey head, the label on the left
 * and the options as chips. The lists are not the design's — those are one
 * fabrication house's brands and internal steps, and this request goes to several
 * manufacturers who each quote against it. Every row therefore offers the
 * industry value plus the open answer, and leaving a row open is a real answer:
 * the manufacturer decides and says so in its quote.
 */
export const BoardSpecForm = ({
  draftId,
  values,
  assembling,
  bothSides,
  readOnly,
  boardFiles,
}: BoardSpecFormProps) => {
  const router = useRouter();
  const { push } = useToast();
  const [pending, startTransition] = useTransition();
  const [hydrated, setHydrated] = useState(false);
  const [form, setForm] = useState<BoardSpecFormValues>(values);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => setHydrated(true), []);

  const set = <K extends keyof BoardSpecFormValues>(
    key: K,
    value: BoardSpecFormValues[K],
  ): void => {
    setForm((current) => ({ ...current, [key]: value }));
    setError(null);
  };

  const chip = (key: keyof BoardSpecFormValues) => (value: string) =>
    set(key, value as BoardSpecFormValues[typeof key]);

  const layers = form.layerCount === '' ? undefined : Number(form.layerCount);

  const save = (): void => {
    setError(null);
    startTransition(async () => {
      const result = await saveBoardSpecAction({ draftId, ...form });
      if (result.error !== undefined) {
        setError(result.error);
        return;
      }
      push({
        title: 'Specification saved',
        body: 'Every manufacturer you send this to will quote against it.',
        tone: 'success',
      });
      goTo(router, `/manufacturing/draft/${draftId}?spec=1`);
    });
  };

  return (
    <div className="flex flex-col gap-6">
      {readOnly && (
        <Alert tone="info" title="This specification is locked">
          The request has been sent, so what manufacturers are quoting against cannot
          change. To ask for something different, withdraw the request or start a new one.
        </Alert>
      )}

      <SpecSection
        title="The board"
        description={`Describes ${boardFiles.length === 0 ? 'the board files in this package' : boardFiles.join(', ')}.`}
      >
        <OptionChips
          label="Base material"
          name="baseMaterial"
          readOnly={readOnly}
          value={form.baseMaterial}
          onChange={chip('baseMaterial')}
          options={BASE_MATERIALS.map((value) => ({
            value,
            label: BASE_MATERIAL_LABEL[value],
          }))}
        />
        <OptionChips
          label="Layers"
          name="layerCount"
          readOnly={readOnly}
          value={form.layerCount}
          onChange={chip('layerCount')}
          options={LAYER_COUNTS.map((value) => ({
            value: String(value),
            label: String(value),
          }))}
          help="Read from your gerbers if you leave it open."
        />
        <OptionChips
          label="Thickness"
          name="thicknessMm"
          readOnly={readOnly}
          value={form.thicknessMm}
          onChange={chip('thicknessMm')}
          options={BOARD_THICKNESSES_MM.map((value) => ({
            value: value.toFixed(1),
            label: `${value.toFixed(1)}mm`,
            disabled: layers !== undefined && layers >= 6 && value < 1,
          }))}
        />
        <OptionChips
          label="Board colour"
          name="boardColor"
          readOnly={readOnly}
          value={form.boardColor}
          onChange={chip('boardColor')}
          options={BOARD_COLORS.map((value) => ({
            value,
            label: titleCase(value),
            ...(SWATCH[value] === undefined ? {} : { swatch: SWATCH[value] }),
          }))}
        />
        <OptionChips
          label="Silkscreen"
          name="silkscreenColor"
          readOnly={readOnly}
          value={form.silkscreenColor}
          onChange={chip('silkscreenColor')}
          options={SILKSCREEN_COLORS.map((value) => ({
            value,
            label: titleCase(value),
            ...(SWATCH[value] === undefined ? {} : { swatch: SWATCH[value] }),
          }))}
        />
        <OptionChips
          label="Surface finish"
          name="surfaceFinish"
          readOnly={readOnly}
          value={form.surfaceFinish}
          onChange={chip('surfaceFinish')}
          options={BOARD_SURFACE_FINISHES.map((value) => ({
            value,
            label: SURFACE_FINISH_LABEL_BOARD[value],
          }))}
        />
        <OptionChips
          label="Delivery format"
          name="deliveryFormat"
          readOnly={readOnly}
          value={form.deliveryFormat}
          onChange={chip('deliveryFormat')}
          options={DELIVERY_FORMATS.map((value) => ({
            value,
            label: DELIVERY_FORMAT_LABEL[value],
          }))}
        />
        <OptionChips
          label="Different designs on the panel"
          name="distinctDesigns"
          readOnly={readOnly}
          value={form.distinctDesigns}
          onChange={chip('distinctDesigns')}
          openLabel="One design"
          options={[2, 3, 4, 5, 6, 7, 8].map((value) => ({
            value: String(value),
            label: String(value),
            disabled: form.deliveryFormat === 'single_pcb',
          }))}
          help="More than one design has to travel as a panel."
        />
      </SpecSection>

      <SpecSection
        title="High-spec options"
        description="Leave these open unless the design actually needs them: each one narrows who can quote."
      >
        <OptionChips
          label="Outer copper weight"
          name="outerCopperOz"
          readOnly={readOnly}
          value={form.outerCopperOz}
          onChange={chip('outerCopperOz')}
          options={COPPER_WEIGHTS_OZ.map((value) => ({
            value: String(value),
            label: `${value} oz`,
          }))}
        />
        <OptionChips
          label="Inner copper weight"
          name="innerCopperOz"
          readOnly={readOnly}
          value={form.innerCopperOz}
          onChange={chip('innerCopperOz')}
          options={COPPER_WEIGHTS_OZ.map((value) => ({
            value: String(value),
            label: `${value} oz`,
            disabled: layers === undefined || layers < 4,
          }))}
          help="Only a board of four layers or more has inner copper."
        />
        <OptionChips
          label="Via covering"
          name="viaCovering"
          readOnly={readOnly}
          value={form.viaCovering}
          onChange={chip('viaCovering')}
          options={VIA_COVERINGS.map((value) => ({
            value,
            label: VIA_COVERING_LABEL[value],
          }))}
        />
        <OptionChips
          label="Minimum via hole"
          name="minViaHoleMm"
          readOnly={readOnly}
          value={form.minViaHoleMm}
          onChange={chip('minViaHoleMm')}
          options={MIN_VIA_HOLES_MM.map((value) => ({
            value: String(value),
            label: `${value}mm`,
          }))}
        />
        <OptionChips
          label="Board outline tolerance"
          name="outlineToleranceMm"
          readOnly={readOnly}
          value={form.outlineToleranceMm}
          onChange={chip('outlineToleranceMm')}
          options={OUTLINE_TOLERANCES_MM.map((value) => ({
            value: String(value),
            label: `+/-${value}mm${value === 0.1 ? ' (precision)' : ' (regular)'}`,
          }))}
        />
        <OptionChips
          label="Electrical test"
          name="electricalTest"
          readOnly={readOnly}
          value={form.electricalTest}
          onChange={chip('electricalTest')}
          options={ELECTRICAL_TESTS.map((value) => ({
            value,
            label: ELECTRICAL_TEST_LABEL[value],
          }))}
        />
        <OptionChips
          label="Workmanship standard"
          name="workmanshipClass"
          readOnly={readOnly}
          value={form.workmanshipClass}
          onChange={chip('workmanshipClass')}
          options={WORKMANSHIP_CLASSES.map((value) => ({
            value,
            label: WORKMANSHIP_CLASS_LABEL[value],
          }))}
        />
        <OptionChips
          label="Mark on the board"
          name="markOnBoard"
          readOnly={readOnly}
          value={form.markOnBoard}
          onChange={chip('markOnBoard')}
          options={MARKS_ON_BOARD.map((value) => ({
            value,
            label: MARK_ON_BOARD_LABEL[value],
          }))}
        />
        <OptionChips
          label="UL marking"
          name="ulMarking"
          readOnly={readOnly}
          value={form.ulMarking}
          onChange={chip('ulMarking')}
          options={UL_MARKINGS.map((value) => ({
            value,
            label: UL_MARKING_LABEL[value],
          }))}
        />

        <div className="grid grid-cols-1 gap-3 py-3 sm:grid-cols-2">
          {(
            [
              ['goldFingers', 'Gold fingers', 'Plated edge connector fingers.'],
              [
                'castellatedHoles',
                'Castellated holes',
                'Half holes on the edge, for a module that solders onto another board.',
              ],
              ['edgePlating', 'Edge plating', 'Copper wrapped around the board edge.'],
              [
                'blindOrBuriedVias',
                'Blind or buried vias',
                'Needs four layers or more.',
              ],
            ] as const
          ).map(([key, label, hint]) => (
            <Checkbox
              key={key}
              label={label}
              description={hint}
              checked={form[key]}
              disabled={
                readOnly ||
                (key === 'blindOrBuriedVias' && (layers === undefined || layers < 4))
              }
              onChange={(event) => set(key, event.target.checked)}
            />
          ))}
        </div>

        <OptionChips
          label="Packaging"
          name="packaging"
          readOnly={readOnly}
          value={form.packaging}
          onChange={chip('packaging')}
          options={BOARD_PACKAGINGS.map((value) => ({
            value,
            label: BOARD_PACKAGING_LABEL[value],
          }))}
        />
      </SpecSection>

      {assembling ? (
        <SpecSection
          title="Assembly"
          description="This request asks the manufacturer to populate the board."
        >
          <OptionChips
            label="Parts supplied by"
            name="partsSuppliedBy"
            readOnly={readOnly}
            value={form.partsSuppliedBy}
            onChange={chip('partsSuppliedBy')}
            options={SUPPLIED_BY.map((value) => ({
              value,
              label: SUPPLIED_BY_LABEL[value],
            }))}
            help="If the manufacturer supplies them, parts sourcing has to be quoted too."
          />
          <OptionChips
            label="Tooling holes added by"
            name="toolingHolesAddedBy"
            readOnly={readOnly}
            value={form.toolingHolesAddedBy}
            onChange={chip('toolingHolesAddedBy')}
            options={SUPPLIED_BY.map((value) => ({
              value,
              label: value === 'buyer' ? 'Already in my design' : 'The manufacturer adds them',
            }))}
          />
          <OptionChips
            label="Face to populate"
            name="assembledFace"
            readOnly={readOnly}
            value={form.assembledFace}
            onChange={chip('assembledFace')}
            openLabel="As the design needs"
            options={[
              { value: 'top', label: 'Top side', disabled: bothSides },
              { value: 'bottom', label: 'Bottom side', disabled: bothSides },
            ]}
            help={
              bothSides
                ? 'Both sides are being populated, so a single face cannot be named.'
                : undefined
            }
          />
          <div className="grid grid-cols-1 gap-3 py-3 sm:grid-cols-2">
            <Checkbox
              label="Conformal coating"
              description="Protective coating over the populated board."
              checked={form.conformalCoating}
              disabled={readOnly}
              onChange={(event) => set('conformalCoating', event.target.checked)}
            />
            <Checkbox
              label="Functional test"
              description="Powered test against the acceptance criteria in your notes."
              checked={form.functionalTest}
              disabled={readOnly}
              onChange={(event) => set('functionalTest', event.target.checked)}
            />
          </div>
        </SpecSection>
      ) : (
        <SpecSection
          title="Populating it yourself"
          description="This request asks for bare boards, so assembly options do not apply."
        >
          <div className="py-3">
            <Checkbox
              label="I need a solder paste stencil"
              description="Asked for as its own quoted service, cut to this design."
              checked={form.stencilRequired}
              disabled={readOnly}
              onChange={(event) => set('stencilRequired', event.target.checked)}
            />
          </div>
        </SpecSection>
      )}

      <SpecSection
        title="Anything else"
        description="Whatever the lists above cannot say. It travels with the request and binds the quote."
      >
        <div className="py-3">
          <FormField label="Remarks" hint="Read by every manufacturer you send this to.">
            <Textarea
              rows={4}
              value={form.remarks}
              disabled={readOnly}
              onChange={(event) => set('remarks', event.target.value)}
              placeholder="Impedance control on the differential pairs; no clean flux; the mounting boss must stay within 0.2mm."
            />
          </FormField>
        </div>
      </SpecSection>

      {error !== null && (
        <Alert tone="danger" title="This specification was not saved">
          {error}
        </Alert>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Text tone="muted" size="xs">
          Anything left open is quoted at the manufacturer&rsquo;s discretion, and its
          quote says what it chose.
        </Text>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/manufacturing/draft/${draftId}`}
            className={buttonAppearance({ variant: 'secondary' })}
          >
            Back to the draft
          </Link>
          {!readOnly && (
            <Button
              onClick={save}
              disabled={!hydrated || pending}
              loading={pending || !hydrated}
            >
              Save specification
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};
