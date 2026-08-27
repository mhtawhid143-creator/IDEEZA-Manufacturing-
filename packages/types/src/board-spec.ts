import { z } from 'zod';
import {
  ASSEMBLED_FACES,
  BASE_MATERIALS,
  BOARD_COLORS,
  BOARD_PACKAGINGS,
  BOARD_SURFACE_FINISHES,
  DELIVERY_FORMATS,
  ELECTRICAL_TESTS,
  MARKS_ON_BOARD,
  SILKSCREEN_COLORS,
  SUPPLIED_BY,
  UL_MARKINGS,
  VIA_COVERINGS,
  WORKMANSHIP_CLASSES,
} from '@ideeza/domain';
import { idSchema } from './common.js';

/**
 * The board specification as it crosses into the platform.
 *
 * Every field is optional because a missing answer is a real answer here: the
 * manufacturer decides. The numbers are checked against the values a shop can
 * actually run inside the domain, so this boundary only has to see that they are
 * numbers of the right shape.
 */
export const saveBoardSpecSchema = z.object({
  draftId: idSchema,
  baseMaterial: z.enum(BASE_MATERIALS).optional(),
  layerCount: z.number().int().min(1).max(12).optional(),
  thicknessMm: z.number().min(0.2).max(4).optional(),
  boardColor: z.enum(BOARD_COLORS).optional(),
  silkscreenColor: z.enum(SILKSCREEN_COLORS).optional(),
  surfaceFinish: z.enum(BOARD_SURFACE_FINISHES).optional(),
  outerCopperOz: z.number().min(0.5).max(6).optional(),
  innerCopperOz: z.number().min(0.5).max(6).optional(),
  viaCovering: z.enum(VIA_COVERINGS).optional(),
  minViaHoleMm: z.number().min(0.1).max(1).optional(),
  outlineToleranceMm: z.number().min(0.05).max(1).optional(),
  deliveryFormat: z.enum(DELIVERY_FORMATS).optional(),
  distinctDesigns: z.number().int().min(1).max(8).optional(),
  electricalTest: z.enum(ELECTRICAL_TESTS).optional(),
  goldFingers: z.boolean().default(false),
  castellatedHoles: z.boolean().default(false),
  edgePlating: z.boolean().default(false),
  blindOrBuriedVias: z.boolean().default(false),
  ulMarking: z.enum(UL_MARKINGS).optional(),
  markOnBoard: z.enum(MARKS_ON_BOARD).optional(),
  workmanshipClass: z.enum(WORKMANSHIP_CLASSES).optional(),
  packaging: z.enum(BOARD_PACKAGINGS).optional(),
  assembledFace: z.enum(ASSEMBLED_FACES).optional(),
  partsSuppliedBy: z.enum(SUPPLIED_BY).optional(),
  toolingHolesAddedBy: z.enum(SUPPLIED_BY).optional(),
  conformalCoating: z.boolean().default(false),
  functionalTest: z.boolean().default(false),
  stencilRequired: z.boolean().default(false),
  remarks: z.string().trim().max(4000).optional(),
});
export type SaveBoardSpecInput = z.infer<typeof saveBoardSpecSchema>;
