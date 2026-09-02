import { z } from 'zod';

/**
 * A move on a guided tour, at the boundary.
 *
 * The tours themselves are editorial content in the panel that shows them, not
 * domain vocabulary, so the id is validated for shape here and for existence
 * there. The two are different questions: this one refuses a value that was
 * never an id at all — which is what arrives when somebody edits the query
 * string the runner keeps its place in — and the panel refuses a well-formed id
 * that names no tour.
 *
 * The stop is bounded well above any real tour's length. Its purpose is to stop
 * an absurd number reaching the database, not to know how long a tour is; that
 * belongs with the tour.
 */
export const tourMoveSchema = z.object({
  tourId: z
    .string()
    .min(1)
    .max(64)
    .regex(/^[a-z0-9-]+$/, 'A tour id is lower-case letters, digits and hyphens.'),
  stopIndex: z.number().int().min(0).max(200),
});

export type TourMove = z.infer<typeof tourMoveSchema>;
