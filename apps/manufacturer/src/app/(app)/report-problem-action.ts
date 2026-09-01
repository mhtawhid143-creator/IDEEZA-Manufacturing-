'use server';

import type { SubmitProblemReport } from '@ideeza/types';
import { submitProblemReport } from '@/data/problem-report.js';
import { requireManufacturer } from '@/lib/auth.js';

export interface ReportProblemState {
  readonly sent: boolean;
  readonly error?: string;
}

/**
 * Send a problem report from the dialog.
 *
 * The reporter comes from the session, never from the payload — the dialog can
 * be opened on any screen by any signed-in member, and none of them may file a
 * report in another person's name. Everything else is validated in the data
 * layer against the schema, and the sentence it returns is the one shown under
 * the form.
 */
export const reportProblemAction = async (
  payload: SubmitProblemReport,
): Promise<ReportProblemState> => {
  const actor = await requireManufacturer('/dashboard');
  const result = await submitProblemReport(actor.userId, payload);
  return result.ok ? { sent: true } : { sent: false, error: result.message };
};
