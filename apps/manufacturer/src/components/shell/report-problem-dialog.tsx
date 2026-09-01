'use client';

import { useEffect, useId, useRef, useState, useTransition } from 'react';
import { usePathname } from 'next/navigation';
import {
  Alert,
  Button,
  FormField,
  Input,
  Modal,
  Select,
  Icon,
  Text,
  Textarea,
  useToast,
} from '@ideeza/ui';
import type { ProblemFrustration, ProblemKind } from '@ideeza/types';
import { reportProblemAction } from '@/app/(app)/report-problem-action.js';

/**
 * The six kinds the Figma dialog offers, in its order.
 *
 * The sentences are the design's, with its typos corrected — "something isn't
 * working", not "something ist' working". A form is read by the person who is
 * already annoyed enough to fill it in; misspelt options make the platform look
 * like the reason they are there.
 */
const KINDS: readonly { readonly value: ProblemKind; readonly label: string }[] = [
  { value: 'technical_bug', label: "Technical bug (something isn't working)" },
  { value: 'design_issue', label: 'Design or layout issue (something looks wrong)' },
  { value: 'confusion', label: "Confusion (I don't know how to use a feature)" },
  { value: 'performance', label: 'Performance (the platform is slow)' },
  { value: 'feature_request', label: 'Feature request (I wish the platform could…)' },
  { value: 'other', label: 'Something else' },
];

/** The three steps of frustration, which are really "does work continue?". */
const FRUSTRATIONS: readonly { readonly value: ProblemFrustration; readonly label: string }[] = [
  { value: 'informational', label: 'Not at all — I just wanted to let you know' },
  { value: 'annoying', label: 'Slightly annoyed, but I can manage' },
  { value: 'blocking', label: "Very frustrated — it's stopping my work" },
];

/** What the browser will accept into the attachment field. */
const IMAGE_TYPES = 'image/png,image/jpeg,image/webp,image/gif';
const MAX_ATTACHMENTS = 5;
const MAX_BYTES = 10_000_000;

export interface ReportProblemDialogProps {
  readonly open: boolean;
  readonly onClose: () => void;
}

/**
 * "Report a Problem" — the dialog from the Figma Report Issue flow.
 *
 * It opens over whatever screen the reporter is on and fills the page field
 * from the route itself, because the single most useful line in a bug report is
 * where it happened and it is the line people most often leave out or get
 * wrong. That field is shown, not hidden: someone reporting a problem should be
 * able to see exactly what is being sent about them.
 *
 * Attachments are named and measured but not uploaded. There is no file store
 * behind this dialog yet, and inventing one that silently discards a screenshot
 * would be worse than saying so, which the hint under the field does.
 */
export const ReportProblemDialog = ({ open, onClose }: ReportProblemDialogProps) => {
  const pathname = usePathname();
  const { push } = useToast();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | undefined>(undefined);
  const [fieldErrors, setFieldErrors] = useState<Readonly<Record<string, string>>>({});
  const [files, setFiles] = useState<readonly File[]>([]);
  const fileInput = useRef<HTMLInputElement>(null);
  const formId = useId();

  // A dialog reopened after a send should be empty, and one reopened after a
  // failure should still hold what was typed — so the reset happens on open.
  useEffect(() => {
    if (!open) return;
    setError(undefined);
    setFieldErrors({});
    setFiles([]);
  }, [open]);

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const value = (name: string): string => String(form.get(name) ?? '').trim();

    const found: Record<string, string> = {};
    if (value('title') === '') found['title'] = 'A title says what the problem is.';
    if (value('kind') === '') found['kind'] = 'Pick the kind of trouble this is.';
    if (value('frustration') === '') found['frustration'] = 'Say how much it is costing you.';
    if (value('detail') === '') found['detail'] = 'Describe what happened.';
    setFieldErrors(found);
    if (Object.keys(found).length > 0) {
      setError(undefined);
      return;
    }

    const extra = value('extra');
    start(async () => {
      const result = await reportProblemAction({
        title: value('title'),
        kind: value('kind') as ProblemKind,
        frustration: value('frustration') as ProblemFrustration,
        detail: value('detail'),
        ...(extra === '' ? {} : { extra }),
        pageName: pathname,
        attachments: files.map((file) => ({
          name: file.name,
          sizeBytes: file.size,
          contentType: file.type === '' ? 'application/octet-stream' : file.type,
        })),
      });

      if (!result.sent) {
        setError(result.error ?? 'The report could not be sent. Try again.');
        return;
      }
      push({ tone: 'success', title: 'Thank you — the report was sent.' });
      onClose();
    });
  };

  const chooseFiles = (chosen: FileList | null) => {
    if (chosen === null) return;
    const accepted: File[] = [];
    for (const file of Array.from(chosen)) {
      if (file.size > MAX_BYTES) continue;
      if (accepted.length + files.length >= MAX_ATTACHMENTS) break;
      accepted.push(file);
    }
    setFiles((current) => [...current, ...accepted].slice(0, MAX_ATTACHMENTS));
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Report a Problem"
      size="md"
      footer={
        <Button type="submit" form={formId} variant="primary" fullWidth loading={pending}>
          Submit
        </Button>
      }
    >
      <form id={formId} onSubmit={submit} noValidate className="flex flex-col gap-4">
        {error !== undefined && (
          <Alert tone="danger" title="The report was not sent">
            {error}
          </Alert>
        )}

        <FormField label="Title" required error={fieldErrors['title']}>
          <Input name="title" placeholder="e.g. the quote total does not add up" maxLength={200} />
        </FormField>

        <FormField
          label="What type of issue are you experiencing?"
          required
          error={fieldErrors['kind']}
        >
          <Select name="kind" placeholder="Select issue" options={[...KINDS]} defaultValue="" />
        </FormField>

        <FormField
          label="How frustrated are you with this issue?"
          required
          error={fieldErrors['frustration']}
        >
          <Select
            name="frustration"
            placeholder="Choose"
            options={[...FRUSTRATIONS]}
            defaultValue=""
          />
        </FormField>

        <FormField
          label="Describe the problem in detail"
          required
          hint="What were you trying to do, and what happened instead?"
          error={fieldErrors['detail']}
        >
          <Textarea name="detail" rows={4} placeholder="Write your comments here" maxLength={4000} />
        </FormField>

        <FormField label="Anything else you'd like to share?">
          <Textarea name="extra" rows={3} placeholder="Write your comments here" maxLength={4000} />
        </FormField>

        <FormField
          label="Page name"
          hint="Taken from the screen you were on, so it is right without you typing it."
        >
          <Input name="pageName" value={pathname} readOnly />
        </FormField>

        <FormField
          label="Attach a screenshot"
          hint={`Up to ${MAX_ATTACHMENTS} images. Their names are sent with the report; the files themselves are not stored yet.`}
        >
          <div className="flex flex-col gap-2">
            <input
              ref={fileInput}
              type="file"
              accept={IMAGE_TYPES}
              multiple
              className="sr-only"
              onChange={(event) => {
                chooseFiles(event.currentTarget.files);
                event.currentTarget.value = '';
              }}
            />
            <Button
              type="button"
              variant="secondary"
              leadingIcon={<Icon name="file" />}
              onClick={() => fileInput.current?.click()}
              disabled={files.length >= MAX_ATTACHMENTS}
            >
              Choose an image or screenshot
            </Button>
            {files.length > 0 && (
              <ul className="flex flex-col gap-1">
                {files.map((file, index) => (
                  <li
                    key={`${file.name}-${String(index)}`}
                    className="flex items-center justify-between gap-3 rounded-lg border border-border-subtle bg-bg-surface-raised px-3 py-2"
                  >
                    <Text size="xs" className="min-w-0 truncate">
                      {file.name}
                    </Text>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        setFiles((current) => current.filter((_, at) => at !== index))
                      }
                    >
                      Remove
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </FormField>
      </form>
    </Modal>
  );
};
