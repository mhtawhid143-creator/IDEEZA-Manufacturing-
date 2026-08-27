'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';
import {
  Alert,
  Button,
  Drawer,
  FormField,
  Input,
  Select,
  Text,
  useToast,
} from '@ideeza/ui';
import { addPartAction, editPartAction } from '@/app/(app)/inventory/actions.js';
import { goTo } from '@/lib/navigate.js';

export interface PartFormDefaults {
  readonly partId: string;
  readonly partName: string;
  readonly sku: string;
  readonly category: string;
  readonly lowStockThreshold: string;
  readonly leadTimeDays: string;
  readonly minimumOrderQuantity: string;
  readonly storageLocation: string;
  readonly enabledForMatching: boolean;
}

export interface PartFormProps {
  readonly mode: 'add' | 'edit';
  readonly currency: string;
  readonly categories: readonly string[];
  readonly defaults?: PartFormDefaults;
  readonly trigger?: string;
  readonly triggerVariant?: 'primary' | 'secondary';
}

const CATEGORY_SUGGESTIONS = [
  'Microcontrollers',
  'Gate drivers',
  'Power MOSFETs',
  'Electrolytic capacitors',
  'Passives',
  'Connectors',
  'Electronics',
  'Raw materials',
  'Consumables',
  'Tools',
];

/**
 * Adding a part, or editing what it is.
 *
 * Quantities and prices are not here on purpose: they move through their own
 * recorded movements, so a stock figure can never be changed by editing a form.
 * Adding a part is the one exception, and the opening figure is written as a
 * count — which is what it is.
 */
export const PartForm = ({
  mode,
  currency,
  categories,
  defaults,
  trigger,
  triggerVariant = 'primary',
}: PartFormProps) => {
  const [open, setOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | undefined>(undefined);
  const router = useRouter();
  const { push } = useToast();

  const [partName, setPartName] = useState(defaults?.partName ?? '');
  const [sku, setSku] = useState(defaults?.sku ?? '');
  const [category, setCategory] = useState(defaults?.category ?? '');
  const [stock, setStock] = useState('');
  const [threshold, setThreshold] = useState(defaults?.lowStockThreshold ?? '');
  const [price, setPrice] = useState('');
  const [leadTime, setLeadTime] = useState(defaults?.leadTimeDays ?? '');
  const [moq, setMoq] = useState(defaults?.minimumOrderQuantity ?? '');
  const [location, setLocation] = useState(defaults?.storageLocation ?? '');
  const [matching, setMatching] = useState(
    defaults === undefined ? 'enabled' : defaults.enabledForMatching ? 'enabled' : 'disabled',
  );

  useEffect(() => setHydrated(true), []);

  const options = [...new Set([...categories, ...CATEGORY_SUGGESTIONS])]
    .sort((left, right) => left.localeCompare(right))
    .map((value) => ({ value, label: value }));

  const save = (): void => {
    setError(undefined);
    startTransition(async () => {
      const result =
        mode === 'add'
          ? await addPartAction({
              partName,
              sku,
              category,
              stockQuantity: stock,
              lowStockThreshold: threshold,
              unitPriceMajor: price,
              currency,
              leadTimeDays: leadTime,
              minimumOrderQuantity: moq,
              storageLocation: location,
              enabledForMatching: matching === 'enabled',
            })
          : await editPartAction({
              partId: defaults?.partId ?? '',
              partName,
              category,
              lowStockThreshold: threshold,
              leadTimeDays: leadTime,
              minimumOrderQuantity: moq,
              storageLocation: location,
              enabledForMatching: matching === 'enabled',
            });

      if (result.partId === undefined) {
        setError(result.error ?? 'That part was not saved.');
        return;
      }
      setOpen(false);
      push({
        title: mode === 'add' ? 'Part added' : 'Part updated',
        body:
          mode === 'add'
            ? 'Its opening stock is recorded as a count, and it can be quoted from now.'
            : 'What the part is has changed; its stock and price are unchanged.',
        tone: 'success',
      });
      if (mode === 'add') goTo(router, `/inventory/${result.partId}`);
      else router.refresh();
    });
  };

  return (
    <>
      <Button variant={triggerVariant} onClick={() => setOpen(true)}>
        {trigger ?? (mode === 'add' ? '+ Add New part' : 'Edit part')}
      </Button>

      <Drawer
        open={open}
        onClose={() => setOpen(false)}
        title={mode === 'add' ? 'Add new part' : 'Edit part'}
        description={
          mode === 'add'
            ? 'What the part is, and what is on the shelf right now.'
            : 'What the part is. Stock and price change through their own movements.'
        }
        width="lg"
        footer={
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              loading={pending || !hydrated}
              disabled={!hydrated}
              onClick={save}
            >
              {mode === 'add' ? 'Add new part' : 'Save changes'}
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          <p className="text-sm font-semibold text-heading">Basic information</p>

          <FormField label="Part name" required>
            <Input
              placeholder="eg. SMD Resistor"
              value={partName}
              onChange={(event) => setPartName(event.target.value)}
            />
          </FormField>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField
              label="SKU / part code"
              required
              hint={
                mode === 'edit'
                  ? 'A SKU cannot change: quotes and reservations point at it.'
                  : 'What a bill of materials is matched on.'
              }
            >
              <Input
                placeholder="eg. RES-10k-SMD"
                value={sku}
                readOnly={mode === 'edit'}
                disabled={mode === 'edit'}
                onChange={(event) => setSku(event.target.value)}
              />
            </FormField>
            <FormField
              label="Category"
              required
              hint="Substitutes are looked for in the same category."
            >
              <Select
                options={options}
                placeholder="Select a category"
                value={category}
                onChange={(event) => setCategory(event.target.value)}
              />
            </FormField>
          </div>

          {mode === 'add' && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField
                label="Stock quantity"
                required
                hint="What is on the shelf now. Recorded as a count."
              >
                <Input
                  inputMode="numeric"
                  placeholder="eg. 250"
                  value={stock}
                  onChange={(event) => setStock(event.target.value)}
                />
              </FormField>
              <FormField label={`Price per unit (${currency})`} required>
                <Input
                  inputMode="decimal"
                  placeholder="eg. 0.25"
                  value={price}
                  onChange={(event) => setPrice(event.target.value)}
                />
              </FormField>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField
              label="Low stock threshold"
              required
              hint="Below this, availability reads as low stock."
            >
              <Input
                inputMode="numeric"
                placeholder="eg. 50"
                value={threshold}
                onChange={(event) => setThreshold(event.target.value)}
              />
            </FormField>
            <FormField
              label="Lead time (days)"
              required
              hint="How long to restock. A substitute's extra days are worked out from it."
            >
              <Input
                inputMode="numeric"
                placeholder="eg. 7"
                value={leadTime}
                onChange={(event) => setLeadTime(event.target.value)}
              />
            </FormField>
            <FormField label="Minimum order quantity">
              <Input
                inputMode="numeric"
                placeholder="eg. 100"
                value={moq}
                onChange={(event) => setMoq(event.target.value)}
              />
            </FormField>
            <FormField label="Storage location">
              <Input
                placeholder="eg. Warehouse A, shelf 3"
                value={location}
                onChange={(event) => setLocation(event.target.value)}
              />
            </FormField>
          </div>

          <div className="border-t border-line pt-4">
            <p className="text-sm font-semibold text-heading">Visibility and settings</p>
            <FormField
              className="mt-3"
              label="Enable for order matching"
              hint="Off means this part is never counted when a buyer's bill of materials is matched against your stock."
            >
              <Select
                options={[
                  { value: 'enabled', label: 'Enabled' },
                  { value: 'disabled', label: 'Disabled' },
                ]}
                value={matching}
                onChange={(event) => setMatching(event.target.value)}
              />
            </FormField>
          </div>

          <Alert tone="info" title="Two things this form deliberately does not do">
            Quantities here are counts of parts, because that is what a bill of
            materials is matched line by line against — there is no unit type to
            choose. And there is no attachment: this build records a file&rsquo;s name
            and hash, not its bytes, so a picture of the part would be a promise it
            could not keep.
          </Alert>

          {error !== undefined && (
            <Text tone="danger" size="sm">
              {error}
            </Text>
          )}
        </div>
      </Drawer>
    </>
  );
};
