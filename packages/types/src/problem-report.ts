import { z } from 'zod';

/**
 * The "Report a Problem" dialog, at the boundary.
 *
 * The two lists are the Figma dialog's own options, stored as the enum values
 * the database holds rather than as the sentences shown on screen. A sentence
 * is presentation and will be reworded; `technical_bug` is what the row means.
 */
export const problemKindSchema = z.enum([
  'technical_bug',
  'design_issue',
  'confusion',
  'performance',
  'feature_request',
  'other',
]);

export type ProblemKind = z.infer<typeof problemKindSchema>;

/**
 * How much the trouble is costing the reporter.
 *
 * Three steps, because the dialog offers three: a note, an irritation, and a
 * stoppage. What separates them is whether work continues, which is the thing
 * worth knowing when the reports are read in order.
 */
export const problemFrustrationSchema = z.enum(['informational', 'annoying', 'blocking']);

export type ProblemFrustration = z.infer<typeof problemFrustrationSchema>;

/**
 * One image a reporter attached.
 *
 * The dialog takes screenshots, which are the whole reason it takes files at
 * all, so the name and the size travel with the reference: a report read later
 * should say what was attached even if the file itself has been swept up.
 */
export const problemAttachmentSchema = z.object({
  name: z.string().min(1).max(200),
  sizeBytes: z.number().int().nonnegative().max(10_000_000),
  contentType: z.string().min(1).max(120),
});

export type ProblemAttachment = z.infer<typeof problemAttachmentSchema>;

/**
 * What the dialog sends.
 *
 * Title, kind, frustration and detail are required because the Figma marks
 * them with an asterisk and because a report missing any of them cannot be
 * acted on. `extra` is the optional second box. `pageName` is not typed by the
 * reporter — the dialog fills it from the route they were on, which is the
 * single most useful fact in the whole form and the one a person would most
 * often get wrong.
 */
export const submitProblemReportSchema = z.object({
  title: z.string().trim().min(1, 'A title says what the problem is.').max(200),
  kind: problemKindSchema,
  frustration: problemFrustrationSchema,
  detail: z
    .string()
    .trim()
    .min(1, 'Describe what happened, so it can be looked into.')
    .max(4000),
  extra: z.string().trim().max(4000).optional(),
  pageName: z.string().trim().min(1).max(200),
  attachments: z.array(problemAttachmentSchema).max(5).default([]),
});

export type SubmitProblemReport = z.infer<typeof submitProblemReportSchema>;
