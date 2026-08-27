'use server';

import {
  DomainError,
  asId,
  assertProductManufacturable,
  type ProductId,
  type RfqId,
} from '@ideeza/domain';
import { saveDraftSchema } from '@ideeza/types';
import { createDraft, updateDraft, withdrawDraft } from '@/data/drafts.js';
import { requireBuyer } from '@/lib/auth.js';
import { database } from '@/lib/db.js';

export interface DraftFormState {
  readonly error?: string;
  /** Field-level messages, keyed by the form field name. */
  readonly fieldErrors?: Readonly<Record<string, string>>;
  /** Set when a new draft has just been created: where it now lives. */
  readonly redirectTo?: string;
  /** Set when an existing draft was saved where it already was. */
  readonly saved?: boolean;
}

const numberOf = (value: FormDataEntryValue | null): number => {
  const parsed = Number(typeof value === 'string' ? value.trim() : '');
  return Number.isFinite(parsed) ? parsed : Number.NaN;
};

const textOf = (value: FormDataEntryValue | null): string =>
  typeof value === 'string' ? value.trim() : '';

const optionalTextOf = (value: FormDataEntryValue | null): string | undefined => {
  const text = textOf(value);
  return text === '' ? undefined : text;
};

/**
 * Saves a draft: creates one the first time, updates it afterwards.
 *
 * The form is validated against the same schema the request boundary uses, so a
 * draft can never hold a shape a request could not carry.
 *
 * The action reports where the buyer should end up rather than redirecting
 * itself, and the form performs the navigation. That keeps the outcome of the
 * save visible to the component that has to render it.
 */
export const saveDraftAction = async (
  _previous: DraftFormState,
  form: FormData,
): Promise<DraftFormState> => {
  const draftId = optionalTextOf(form.get('draftId'));
  const actor = await requireBuyer(
    draftId === undefined ? '/manufacturing/draft/new' : `/manufacturing/draft/${draftId}`,
  );

  const parsed = saveDraftSchema.safeParse({
    productId: textOf(form.get('productId')),
    // The package kind follows the files that were chosen; the data layer derives
    // it and overwrites whatever arrives here.
    kind: textOf(form.get('kind')) === '' ? 'pcb' : textOf(form.get('kind')),
    includedFileIds: form.getAll('fileIds').map((value) => String(value)),
    includedBomLineIds: form.getAll('bomLineIds').map((value) => String(value)),
    quantity: numberOf(form.get('quantity')),
    material: textOf(form.get('material')),
    manufacturingMethod: textOf(form.get('manufacturingMethod')),
    tolerance: textOf(form.get('tolerance')),
    leadTimeDays: numberOf(form.get('leadTimeDays')),
    shippingRequirement: textOf(form.get('shippingRequirement')),
    assembly: textOf(form.get('assembly')),
    qualityCheckRequirement: textOf(form.get('qualityCheckRequirement')),
    substitutionPolicy: textOf(form.get('substitutionPolicy')),
    notes: optionalTextOf(form.get('notes')),
    printTechnology: optionalTextOf(form.get('printTechnology')),
    printMaterial: optionalTextOf(form.get('printMaterial')),
    printColor: optionalTextOf(form.get('printColor')),
    surfaceFinish: optionalTextOf(form.get('surfaceFinish')),
    infillPercent:
      optionalTextOf(form.get('infillPercent')) === undefined
        ? undefined
        : numberOf(form.get('infillPercent')),
    deliveryAddress: {
      line1: textOf(form.get('line1')),
      line2: optionalTextOf(form.get('line2')),
      city: textOf(form.get('city')),
      region: optionalTextOf(form.get('region')),
      postalCode: optionalTextOf(form.get('postalCode')),
      countryCode: textOf(form.get('countryCode')).toUpperCase(),
    },
  });

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path.filter((part) => typeof part === 'string').join('.');
      fieldErrors[field === '' ? 'form' : field] ??= issue.message;
    }
    return {
      error: 'Some of the requirements still need attention.',
      fieldErrors,
    };
  }

  const product = await database().product.findUnique({
    where: { id: parsed.data.productId },
    select: { id: true, availability: true },
  });
  if (product === null) return { error: 'That product does not exist.' };

  try {
    assertProductManufacturable({
      id: asId<ProductId>(product.id),
      availability: product.availability,
    });

    if (draftId === undefined) {
      const created = await createDraft(actor.userId, parsed.data);
      return { redirectTo: `/manufacturing/draft/${created}?saved=1` };
    }

    await updateDraft(actor.userId, asId<RfqId>(draftId), parsed.data);
    return { saved: true };
  } catch (error) {
    if (error instanceof DomainError) return { error: error.message };
    throw error;
  }
};

export interface WithdrawResult {
  readonly withdrawn: boolean;
  readonly error?: string;
}

/** Drops a draft the buyer no longer wants to send. */
export const withdrawDraftAction = async (
  draftIdInput: string,
): Promise<WithdrawResult> => {
  const actor = await requireBuyer(`/manufacturing/draft/${draftIdInput}`);

  try {
    await withdrawDraft(actor.userId, asId<RfqId>(draftIdInput));
  } catch (error) {
    if (error instanceof DomainError) return { withdrawn: false, error: error.message };
    throw error;
  }

  return { withdrawn: true };
};
