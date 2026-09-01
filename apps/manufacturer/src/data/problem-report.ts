import { submitProblemReportSchema, type SubmitProblemReport } from '@ideeza/types';
import type { UserId } from '@ideeza/domain';
import { database } from '@/lib/db.js';

const identifier = (prefix: string): string =>
  `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

export type SubmitProblemReportResult =
  | { readonly ok: true; readonly reportId: string }
  | { readonly ok: false; readonly message: string };

/**
 * Store a problem someone reported from the dialog.
 *
 * Validated at the boundary, like every other write here: a report that cannot
 * be acted on is refused rather than stored half-formed, and the message that
 * comes back is the one the dialog shows.
 *
 * There is no state machine and no event, deliberately. A report is not part of
 * the order lifecycle — it does not move money, change a status, or oblige
 * anyone. It is a message from a person to whoever reads these, so the only
 * thing that matters is that it survives.
 *
 * The reporter is taken from the session by the caller and never from the
 * payload, so a report cannot be filed in someone else's name.
 */
export const submitProblemReport = async (
  reportedById: UserId,
  payload: SubmitProblemReport,
): Promise<SubmitProblemReportResult> => {
  const parsed = submitProblemReportSchema.safeParse(payload);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return {
      ok: false,
      message: first?.message ?? 'That report is missing something it needs.',
    };
  }

  // A report from an account that no longer exists would fail on the foreign
  // key; catching it here turns a stack trace into a sentence the dialog can
  // show, which is what the boundary is for.
  const reporter = await database().user.findUnique({
    where: { id: reportedById },
    select: { id: true },
  });
  if (reporter === null) {
    return { ok: false, message: 'That account could not be found. Sign in again.' };
  }

  const report = parsed.data;
  const reportId = identifier('prob');

  await database().problemReport.create({
    data: {
      id: reportId,
      reportedById,
      kind: report.kind,
      frustration: report.frustration,
      title: report.title,
      detail: report.detail,
      extra: report.extra ?? null,
      pageName: report.pageName,
      attachments: [...report.attachments],
    },
  });

  return { ok: true, reportId };
};
