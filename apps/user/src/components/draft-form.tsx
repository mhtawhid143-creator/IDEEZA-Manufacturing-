'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useActionState, useEffect, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  CardHeader,
  Checkbox,
  FormField,
  Heading,
  Input,
  Select,
  Textarea,
  buttonAppearance,
} from '@ideeza/ui';
import { DraftComposition } from './draft-composition.js';
import { saveDraftAction, type DraftFormState } from '@/app/(app)/manufacturing/draft/actions.js';
import { goTo } from '@/lib/navigate.js';

export interface DraftFormProduct {
  readonly id: string;
  readonly name: string;
  readonly creatorName: string;
  readonly files: readonly {
    readonly id: string;
    readonly name: string;
    readonly revision: number;
    readonly kind: 'pcb' | 'model_3d' | 'document';
  }[];
  readonly bomLines: readonly {
    readonly id: string;
    readonly reference: string;
    readonly componentName: string;
  }[];
}

export interface DraftFormValues {
  readonly kind: string;
  readonly printTechnology: string;
  readonly printMaterial: string;
  readonly printColor: string;
  readonly surfaceFinish: string;
  readonly infillPercent: string;
  readonly includedFileIds: readonly string[];
  readonly includedBomLineIds: readonly string[];
  readonly quantity: number | '';
  readonly material: string;
  readonly manufacturingMethod: string;
  readonly tolerance: string;
  readonly leadTimeDays: number | '';
  readonly shippingRequirement: string;
  readonly assembly: string;
  readonly qualityCheckRequirement: string;
  readonly substitutionPolicy: string;
  readonly notes: string;
  readonly deliveryAddress: {
    readonly line1: string;
    readonly line2: string;
    readonly city: string;
    readonly region: string;
    readonly postalCode: string;
    readonly countryCode: string;
  };
}

export interface DraftFormProps {
  readonly product: DraftFormProduct;
  readonly values: DraftFormValues;
  /** Present when an existing draft is being edited. */
  readonly draftId?: string | undefined;
}

const ASSEMBLY_OPTIONS = [
  { value: 'none', label: 'No assembly — parts only' },
  { value: 'smt', label: 'SMT' },
  { value: 'through_hole', label: 'Through hole' },
  { value: 'mixed', label: 'Mixed SMT and through hole' },
];

const SUBSTITUTION_OPTIONS = [
  { value: 'not_allowed', label: 'No substitutions' },
  { value: 'with_approval', label: 'Substitutions with my approval' },
  { value: 'manufacturer_discretion', label: "Manufacturer's discretion" },
];

/**
 * The package and requirements step.
 *
 * Every field here ends up in the request that manufacturers quote against and
 * in the record a dispute would be decided on, which is why none of it is free
 * text beyond the notes.
 */
export const DraftForm = ({ product, values, draftId }: DraftFormProps) => {
  const router = useRouter();
  // The action's outcome is applied on the client, so the button waits for the
  // client to exist. Without this, a click during hydration would run the
  // action and leave the page where it was.
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  const [state, action, pending] = useActionState<DraftFormState, FormData>(saveDraftAction, {});
  // What is in the package decides whether assembly can be asked for at all.
  const [hasBoard, setHasBoard] = useState(
    product.files.some(
      (file) => file.kind === 'pcb' && values.includedFileIds.includes(file.id),
    ),
  );
  const errorFor = (field: string): string | undefined => state.fieldErrors?.[field];

  // A brand new draft has a home of its own to move to; a saved one is already
  // where it belongs and only needs its server data read again.
  useEffect(() => {
    if (state.redirectTo !== undefined) goTo(router, state.redirectTo);
  }, [state.redirectTo, router]);

  useEffect(() => {
    if (state.saved === true) router.refresh();
  }, [state.saved, router]);

  return (
    <form action={action} className="flex flex-col gap-6">
      <input type="hidden" name="productId" value={product.id} />
      {draftId !== undefined && <input type="hidden" name="draftId" value={draftId} />}

      {state.error !== undefined && (
        <Alert tone="danger" title="This draft was not saved">
          {state.error}
        </Alert>
      )}

      {state.saved === true && (
        <Alert tone="success" title="Changes saved">
          The draft is up to date. Nothing has been sent to any manufacturer.
        </Alert>
      )}

      <Card>
        <CardHeader
          title="1. What should be manufactured"
          description={`From ${product.name} by ${product.creatorName}.`}
        />
        <div className="mt-4 flex flex-col gap-4">
          <DraftComposition
            files={product.files}
            selectedFileIds={values.includedFileIds}
            onCompositionChange={(composition) => setHasBoard(composition.hasBoard)}
            fileError={errorFor('includedFileIds')}
            print={{
              technology: values.printTechnology,
              material: values.printMaterial,
              color: values.printColor,
              surfaceFinish: values.surfaceFinish,
              infillPercent: values.infillPercent,
            }}
          />

          {product.bomLines.length > 0 && (
            <fieldset className="flex flex-col gap-2">
              <legend className="text-sm font-semibold text-heading">
                Bill of materials to quote
              </legend>
              {product.bomLines.map((line) => (
                <Checkbox
                  key={line.id}
                  name="bomLineIds"
                  value={line.id}
                  label={`${line.reference} — ${line.componentName}`}
                  defaultChecked={values.includedBomLineIds.includes(line.id)}
                />
              ))}
            </fieldset>
          )}
        </div>
      </Card>

      <Card>
        <CardHeader
          title="2. Manufacturing requirements"
          description="These are the terms every quote answers, so they are structured rather than free text."
        />
        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          <FormField label="Quantity" required error={errorFor('quantity')}>
            <Input
              name="quantity"
              type="number"
              min={1}
              step={1}
              defaultValue={values.quantity}
              required
            />
          </FormField>
          <FormField
            label="Lead time (days)"
            required
            hint="The longest you are willing to wait."
            error={errorFor('leadTimeDays')}
          >
            <Input
              name="leadTimeDays"
              type="number"
              min={1}
              step={1}
              defaultValue={values.leadTimeDays}
              required
            />
          </FormField>
          <FormField
            label="Material and finish"
            required
            error={errorFor('material')}
            hint="What it is made of, and how the surface is finished."
          >
            <Input name="material" defaultValue={values.material} required />
          </FormField>
          <FormField
            label="Manufacturing method"
            required
            error={errorFor('manufacturingMethod')}
          >
            <Input
              name="manufacturingMethod"
              defaultValue={values.manufacturingMethod}
              required
            />
          </FormField>
          <FormField label="Tolerance" required error={errorFor('tolerance')}>
            <Input name="tolerance" defaultValue={values.tolerance} required />
          </FormField>
          <FormField
            label="Assembly"
            required
            error={errorFor('assembly')}
            hint={
              hasBoard
                ? undefined
                : 'No board is in the package, so there is nothing to assemble.'
            }
          >
            <Select
              name="assembly"
              options={ASSEMBLY_OPTIONS}
              // Without a board the only honest answer is none, so the field
              // says so rather than posting something the domain will refuse.
              {...(hasBoard
                ? { defaultValue: values.assembly }
                : { value: 'none', disabled: true, onChange: () => undefined })}
            />
            {/* A disabled control is not submitted, so the answer is carried. */}
            {!hasBoard && <input type="hidden" name="assembly" value="none" />}
          </FormField>
          <FormField
            label="Quality check"
            required
            error={errorFor('qualityCheckRequirement')}
          >
            <Input
              name="qualityCheckRequirement"
              defaultValue={values.qualityCheckRequirement}
              required
            />
          </FormField>
          <FormField
            label="Shipping requirement"
            required
            error={errorFor('shippingRequirement')}
          >
            <Input
              name="shippingRequirement"
              defaultValue={values.shippingRequirement}
              required
            />
          </FormField>
          <FormField
            label="Part substitutions"
            required
            hint="What a manufacturer may do when a part is unavailable."
            error={errorFor('substitutionPolicy')}
            className="md:col-span-2"
          >
            <Select
              name="substitutionPolicy"
              options={SUBSTITUTION_OPTIONS}
              defaultValue={values.substitutionPolicy}
            />
          </FormField>
          <FormField
            label="Notes"
            hint="Anything else a manufacturer should know. Optional."
            error={errorFor('notes')}
            className="md:col-span-2"
          >
            <Textarea name="notes" rows={3} defaultValue={values.notes} />
          </FormField>
        </div>
      </Card>

      <Card>
        <CardHeader
          title="3. Where it ships"
          description="Manufacturers quote shipping against this destination. You can confirm it again before the request is sent."
        />
        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          <FormField
            label="Address line 1"
            required
            error={errorFor('deliveryAddress.line1')}
            className="md:col-span-2"
          >
            <Input name="line1" defaultValue={values.deliveryAddress.line1} required />
          </FormField>
          <FormField
            label="Address line 2"
            error={errorFor('deliveryAddress.line2')}
            className="md:col-span-2"
          >
            <Input name="line2" defaultValue={values.deliveryAddress.line2} />
          </FormField>
          <FormField label="City" required error={errorFor('deliveryAddress.city')}>
            <Input name="city" defaultValue={values.deliveryAddress.city} required />
          </FormField>
          <FormField label="Region" error={errorFor('deliveryAddress.region')}>
            <Input name="region" defaultValue={values.deliveryAddress.region} />
          </FormField>
          <FormField label="Postal code" error={errorFor('deliveryAddress.postalCode')}>
            <Input name="postalCode" defaultValue={values.deliveryAddress.postalCode} />
          </FormField>
          <FormField
            label="Country code"
            required
            hint="Two letters, for example BD."
            error={errorFor('deliveryAddress.countryCode')}
          >
            <Input
              name="countryCode"
              maxLength={2}
              defaultValue={values.deliveryAddress.countryCode}
              required
            />
          </FormField>
        </div>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href={draftId === undefined ? `/products/${product.id}` : '/manufacturing'}
          className={buttonAppearance({ variant: 'ghost' })}
        >
          Cancel
        </Link>
        <div className="flex items-center gap-2">
          <Heading level={2} className="sr-only">
            Save
          </Heading>
          <Button type="submit" size="lg" loading={pending || !ready} disabled={!ready}>
            {draftId === undefined ? 'Save draft' : 'Save changes'}
          </Button>
        </div>
      </div>
    </form>
  );
};
