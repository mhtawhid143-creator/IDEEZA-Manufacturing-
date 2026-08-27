'use server';

import { DomainError } from '@ideeza/domain';
import { saveBoardSpecSchema } from '@ideeza/types';
import { saveBoardSpec } from '@/data/board-spec.js';
import { requireBuyer } from '@/lib/auth.js';

export interface BoardSpecState {
  readonly error?: string;
  readonly saved?: boolean;
}

const optionalText = (value: string | undefined): string | undefined =>
  value === undefined || value.trim() === '' ? undefined : value.trim();

const optionalNumber = (value: string | undefined): number | undefined => {
  const text = optionalText(value);
  if (text === undefined) return undefined;
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : undefined;
};

/**
 * Saves the detailed board specification of a draft.
 *
 * The screen sends every row, including the ones the buyer left open, and an
 * open row arrives as an empty string. Turning those into "absent" here is what
 * makes "the manufacturer decides" a stored fact rather than a guess.
 */
export const saveBoardSpecAction = async (input: {
  readonly draftId: string;
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
}): Promise<BoardSpecState> => {
  const actor = await requireBuyer(
    `/manufacturing/draft/${input.draftId}/specification`,
  );

  const parsed = saveBoardSpecSchema.safeParse({
    draftId: input.draftId,
    baseMaterial: optionalText(input.baseMaterial),
    layerCount: optionalNumber(input.layerCount),
    thicknessMm: optionalNumber(input.thicknessMm),
    boardColor: optionalText(input.boardColor),
    silkscreenColor: optionalText(input.silkscreenColor),
    surfaceFinish: optionalText(input.surfaceFinish),
    outerCopperOz: optionalNumber(input.outerCopperOz),
    innerCopperOz: optionalNumber(input.innerCopperOz),
    viaCovering: optionalText(input.viaCovering),
    minViaHoleMm: optionalNumber(input.minViaHoleMm),
    outlineToleranceMm: optionalNumber(input.outlineToleranceMm),
    deliveryFormat: optionalText(input.deliveryFormat),
    distinctDesigns: optionalNumber(input.distinctDesigns),
    electricalTest: optionalText(input.electricalTest),
    goldFingers: input.goldFingers,
    castellatedHoles: input.castellatedHoles,
    edgePlating: input.edgePlating,
    blindOrBuriedVias: input.blindOrBuriedVias,
    ulMarking: optionalText(input.ulMarking),
    markOnBoard: optionalText(input.markOnBoard),
    workmanshipClass: optionalText(input.workmanshipClass),
    packaging: optionalText(input.packaging),
    assembledFace: optionalText(input.assembledFace),
    partsSuppliedBy: optionalText(input.partsSuppliedBy),
    toolingHolesAddedBy: optionalText(input.toolingHolesAddedBy),
    conformalCoating: input.conformalCoating,
    functionalTest: input.functionalTest,
    stencilRequired: input.stencilRequired,
    remarks: optionalText(input.remarks),
  });

  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? 'Some of the specification is not valid.',
    };
  }

  try {
    await saveBoardSpec(actor.userId, parsed.data);
    return { saved: true };
  } catch (error) {
    if (error instanceof DomainError) return { error: error.message };
    if (error instanceof Error) return { error: error.message };
    return { error: 'That specification could not be saved.' };
  }
};
