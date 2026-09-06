'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';
import {
  Alert,
  Button,
  FormField,
  Input,
  OptionChips,
  SpecSection,
  Text,
  Textarea,
  buttonAppearance,
  useToast,
} from '@ideeza/ui';
import {
  INFILL_PATTERNS,
  INFILL_PATTERN_LABEL,
  SUPPORT_STRUCTURES,
  SUPPORT_STRUCTURE_LABEL,
} from '@ideeza/domain';
import { savePrintSpecAction } from '@/app/(app)/manufacturing/draft/spec-actions.js';
import { goTo } from '@/lib/navigate.js';

export interface PrintSpecFormValues {
  readonly layerHeightMm: string;
  readonly infillPattern: string;
  readonly wallThicknessMm: string;
  readonly dimensionXMm: string;
  readonly dimensionYMm: string;
  readonly dimensionZMm: string;
  readonly toleranceMm: string;
  readonly supportStructure: string;
  readonly orientationRequirement: string;
  readonly durometer: string;
  readonly postProcessing: string;
  readonly certification: string;
}

export interface PrintSpecFormProps {
  readonly draftId: string;
  readonly values: PrintSpecFormValues;
  readonly readOnly: boolean;
  readonly modelFiles: readonly string[];
  /** True when the material is one whose Shore hardness means anything. */
  readonly flexible: boolean;
  /** False for a process that removes material rather than filling it. */
  readonly fills: boolean;
}

/** The layer heights the processes this platform routes to actually run. */
const LAYER_HEIGHTS_MM = [0.05, 0.1, 0.15, 0.2, 0.3];

/** Tolerances a shop will hold to without a conversation first. */
const TOLERANCES_MM = [0.05, 0.1, 0.2, 0.3, 0.5];

/**
 * The detailed 3D printing specification, edited from the draft.
 *
 * The peer of the board's, and the same shape on purpose: sections with a head,
 * the label on the left, the options as chips, and every row able to be left
 * open. Leaving one open is a real answer — the manufacturer decides and says
 * what it chose in its quote.
 *
 * The size is three numbers rather than chips because a part is whatever size it
 * is; the form takes all three or none, because two of them describe nothing
 * that can go on a build plate.
 */
export const PrintSpecForm = ({
  draftId,
  values,
  readOnly,
  modelFiles,
  flexible,
  fills,
}: PrintSpecFormProps) => {
  const router = useRouter();
  const { push } = useToast();
  const [pending, startTransition] = useTransition();
  const [hydrated, setHydrated] = useState(false);
  const [form, setForm] = useState<PrintSpecFormValues>(values);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => setHydrated(true), []);

  const set = <K extends keyof PrintSpecFormValues>(
    key: K,
    value: PrintSpecFormValues[K],
  ): void => {
    setForm((current) => ({ ...current, [key]: value }));
    setError(null);
  };

  const chip = (key: keyof PrintSpecFormValues) => (value: string) =>
    set(key, value as PrintSpecFormValues[typeof key]);

  const save = (): void => {
    setError(null);
    startTransition(async () => {
      const result = await savePrintSpecAction({ draftId, ...form });
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
        title="How it is printed"
        description={`Describes ${modelFiles.length === 0 ? 'the model files in this package' : modelFiles.join(', ')}.`}
      >
        <OptionChips
          label="Layer height"
          name="layerHeightMm"
          readOnly={readOnly}
          value={form.layerHeightMm}
          onChange={chip('layerHeightMm')}
          options={LAYER_HEIGHTS_MM.map((value) => ({
            value: String(value),
            label: `${value}mm`,
          }))}
          help="Finer layers take longer and cost more. Leave it open and the shop picks for the geometry."
        />
        {fills && (
          <OptionChips
            label="Infill pattern"
            name="infillPattern"
            readOnly={readOnly}
            value={form.infillPattern}
            onChange={chip('infillPattern')}
            options={INFILL_PATTERNS.map((value) => ({
              value,
              label: INFILL_PATTERN_LABEL[value],
            }))}
            help="How the inside is arranged. The percentage is on the request itself."
          />
        )}
        <OptionChips
          label="Support"
          name="supportStructure"
          readOnly={readOnly}
          value={form.supportStructure}
          onChange={chip('supportStructure')}
          options={SUPPORT_STRUCTURES.map((value) => ({
            value,
            label: SUPPORT_STRUCTURE_LABEL[value],
          }))}
          help="Removing supports marks the face they touched, so say if a face has to stay clear."
        />
      </SpecSection>

      <SpecSection
        title="How big it is, and how close it has to be"
        description="The bounding box of the part as designed, and what the finished one may vary by."
      >
        <div className="grid grid-cols-1 gap-3 py-3 sm:grid-cols-3">
          <FormField label="Width (X)" hint="mm">
            <Input
              type="number"
              step="0.01"
              min="0"
              value={form.dimensionXMm}
              disabled={readOnly}
              onChange={(event) => set('dimensionXMm', event.target.value)}
              placeholder="70.17"
            />
          </FormField>
          <FormField label="Depth (Y)" hint="mm">
            <Input
              type="number"
              step="0.01"
              min="0"
              value={form.dimensionYMm}
              disabled={readOnly}
              onChange={(event) => set('dimensionYMm', event.target.value)}
              placeholder="70.2"
            />
          </FormField>
          <FormField label="Height (Z)" hint="mm">
            <Input
              type="number"
              step="0.01"
              min="0"
              value={form.dimensionZMm}
              disabled={readOnly}
              onChange={(event) => set('dimensionZMm', event.target.value)}
              placeholder="24"
            />
          </FormField>
        </div>
        <Text tone="muted" size="xs" className="block pb-3">
          All three or none — a size with one axis missing is not a size. Leave them
          empty and the shop measures your model.
        </Text>
        <OptionChips
          label="Tolerance"
          name="toleranceMm"
          readOnly={readOnly}
          value={form.toleranceMm}
          onChange={chip('toleranceMm')}
          options={TOLERANCES_MM.map((value) => ({
            value: String(value),
            label: `+/-${value}mm`,
          }))}
          help="Cannot be finer than the layer it is built from."
        />
        <OptionChips
          label="Wall thickness"
          name="wallThicknessMm"
          readOnly={readOnly}
          value={form.wallThicknessMm}
          onChange={chip('wallThicknessMm')}
          options={[0.8, 1.2, 1.6, 2, 3].map((value) => ({
            value: String(value),
            label: `${value}mm`,
          }))}
        />
      </SpecSection>

      <SpecSection
        title="How it is finished"
        description="What happens to the part after it comes off the machine."
      >
        <div className="flex flex-col gap-3 py-3">
          <FormField
            label="Orientation"
            hint="Which way up it must be made, and which face has to stay clean."
          >
            <Textarea
              rows={2}
              value={form.orientationRequirement}
              disabled={readOnly}
              onChange={(event) => set('orientationRequirement', event.target.value)}
              placeholder="The lens face must not carry supports."
            />
          </FormField>
          <FormField
            label="Post-processing"
            hint="Curing, heat treatment, dyeing — anything after the build."
          >
            <Textarea
              rows={2}
              value={form.postProcessing}
              disabled={readOnly}
              onChange={(event) => set('postProcessing', event.target.value)}
              placeholder="UV cure, 30 minutes."
            />
          </FormField>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {/*
              Shown only on a flexible material: a Shore hardness on a rigid
              resin is a number with no meaning, and the domain refuses it, so
              the form does not ask for it either.
            */}
            {flexible && (
              <FormField label="Durometer" hint="Shore hardness, e.g. 95A.">
                <Input
                  value={form.durometer}
                  disabled={readOnly}
                  onChange={(event) => set('durometer', event.target.value)}
                  placeholder="95A"
                />
              </FormField>
            )}
            <FormField
              label="Certification"
              hint="Only if the part has to carry one."
            >
              <Input
                value={form.certification}
                disabled={readOnly}
                onChange={(event) => set('certification', event.target.value)}
                placeholder="RoHS"
              />
            </FormField>
          </div>
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
