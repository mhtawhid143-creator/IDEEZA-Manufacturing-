'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';
import {
  Alert,
  Button,
  Card,
  DropdownMenu,
  FormField,
  Input,
  Modal,
  Select,
  StatusChip,
  Text,
  Textarea,
  Tooltip,
  useToast,
} from '@ideeza/ui';
import {
  attachEvidenceAction,
  moveStageAction,
  setTaskAction,
} from '@/app/(app)/orders/actions.js';

export interface TimelineTask {
  readonly id: string;
  readonly label: string;
  readonly status: 'pending' | 'in_progress' | 'completed' | 'blocked';
  readonly completedOn: string | null;
}

export interface TimelineStage {
  readonly id: string;
  readonly key: string;
  readonly label: string;
  readonly status: 'pending' | 'in_progress' | 'completed' | 'blocked';
  readonly advancedBy: 'system' | 'manufacturer' | 'buyer';
  readonly startedOn: string | null;
  readonly completedOn: string | null;
  readonly note: string | null;
  readonly tasks: readonly TimelineTask[];
  readonly evidenceCount: number;
  readonly movable: boolean;
  readonly blockedReason: string | null;
  /** What this stage is waiting for, in the shop's words. */
  readonly waitingFor: string;
}

export interface ProductionTimelineProps {
  readonly orderId: string;
  readonly stages: readonly TimelineStage[];
  readonly live: boolean;
}

const EVIDENCE_OPTIONS = [
  { value: 'quality_report', label: 'Quality report' },
  { value: 'measurement_data', label: 'Measurement data' },
  { value: 'photo', label: 'Photograph' },
  { value: 'manufacturer_statement', label: 'A statement from you' },
];

/**
 * Production tracking: the ten canonical stages, and the shop-floor tasks inside
 * them.
 *
 * The design's timeline mixes the two — "Code Flashing" and "3D Module
 * Production" sit beside "Order Received" — but they are not the same kind of
 * thing. The stages are what the buyer reads and what the platform's rules are
 * written against; the detail underneath is this shop's own work. Keeping them
 * apart is what lets both panels read one order without either inventing a step.
 */
export const ProductionTimeline = ({
  orderId,
  stages,
  live,
}: ProductionTimelineProps) => {
  const [hydrated, setHydrated] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | undefined>(undefined);
  const [evidenceStage, setEvidenceStage] = useState<TimelineStage | null>(null);
  const [kind, setKind] = useState('quality_report');
  const [title, setTitle] = useState('');
  const [detail, setDetail] = useState('');
  const router = useRouter();
  const { push } = useToast();

  useEffect(() => setHydrated(true), []);

  const move = (stage: TimelineStage, to: 'in_progress' | 'completed'): void => {
    setError(undefined);
    startTransition(async () => {
      const result = await moveStageAction(orderId, stage.key, to, '');
      if (!result.done) {
        push({
          title: 'That stage did not move',
          body: result.error ?? 'Try again.',
          tone: 'danger',
        });
        return;
      }
      push({
        title: to === 'completed' ? `${stage.label} completed` : `${stage.label} started`,
        body: 'The buyer’s production screen says the same thing, at the same time.',
        tone: 'success',
      });
      router.refresh();
    });
  };

  const tick = (task: TimelineTask, to: 'in_progress' | 'completed'): void => {
    startTransition(async () => {
      const result = await setTaskAction(orderId, task.id, to);
      if (!result.done) {
        push({
          title: 'That task did not move',
          body: result.error ?? 'Try again.',
          tone: 'danger',
        });
        return;
      }
      router.refresh();
    });
  };

  const saveEvidence = (): void => {
    const stage = evidenceStage;
    if (stage === null) return;
    setError(undefined);
    startTransition(async () => {
      const result = await attachEvidenceAction({
        orderId,
        stageId: stage.id,
        kind,
        title,
        detail,
      });
      if (!result.done) {
        setError(result.error ?? 'That record was not attached.');
        return;
      }
      setEvidenceStage(null);
      setTitle('');
      setDetail('');
      push({
        title: 'Record attached',
        body: `It is on ${stage.label}, and the buyer can read it on the order’s records.`,
        tone: 'success',
      });
      router.refresh();
    });
  };

  return (
    <>
      <Card padded={false}>
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-4 md:px-6">
          <div>
            <p className="text-base font-semibold text-heading">Production tracking</p>
            <Text tone="muted" size="xs">
              The ten stages the platform and the buyer read. What you tick inside one
              is your own work.
            </Text>
          </div>
          {live && (
            <span className="inline-flex items-center gap-2 text-xs font-semibold text-danger">
              <span
                aria-hidden
                className="inline-block h-2 w-2 animate-pulse rounded-full bg-danger"
              />
              Live
            </span>
          )}
        </div>

        <ol aria-label="Production stages" className="border-t border-line">
          {stages.map((stage) => (
            <li
              key={stage.id}
              className="flex gap-3 border-b border-line px-4 py-4 last:border-b-0 md:px-6"
            >
              <span aria-hidden className="mt-1 flex flex-col items-center">
                <span
                  className={
                    stage.status === 'completed'
                      ? 'inline-flex h-5 w-5 items-center justify-center rounded-full bg-brand text-[11px] font-bold text-white'
                      : stage.status === 'in_progress'
                        ? 'inline-flex h-5 w-5 items-center justify-center rounded-full border-2 border-brand text-[11px] font-bold text-brand'
                        : 'inline-flex h-5 w-5 items-center justify-center rounded-full border-2 border-line text-[11px] text-muted'
                  }
                >
                  {stage.status === 'completed' ? '✓' : ''}
                </span>
              </span>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-heading">{stage.label}</p>
                    <Text tone="muted" size="xs">
                      {stage.status === 'completed'
                        ? `Completed ${stage.completedOn ?? ''}`
                        : stage.status === 'in_progress'
                          ? `Started ${stage.startedOn ?? ''}`
                          : stage.waitingFor}
                      {stage.evidenceCount === 0
                        ? ''
                        : ` · ${stage.evidenceCount} record${
                            stage.evidenceCount === 1 ? '' : 's'
                          }`}
                    </Text>
                    {stage.note !== null && (
                      <Text size="sm" className="mt-1 block">
                        {stage.note}
                      </Text>
                    )}
                    {!stage.movable && stage.blockedReason !== null && (
                      <Text tone="muted" size="xs" className="mt-1 block">
                        {stage.blockedReason}
                      </Text>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <StatusChip status={stage.status} />
                    {stage.movable ? (
                      <DropdownMenu
                        label={`Move ${stage.label}`}
                        items={[
                          ...(stage.status === 'pending'
                            ? [
                                {
                                  id: 'start',
                                  label: 'In progress',
                                  onSelect: () => move(stage, 'in_progress'),
                                },
                              ]
                            : []),
                          {
                            id: 'complete',
                            label: 'Complete',
                            onSelect: () => move(stage, 'completed'),
                          },
                          {
                            id: 'evidence',
                            label: 'Attach a record',
                            onSelect: () => setEvidenceStage(stage),
                          },
                        ]}
                        trigger={({ ref, onClick, ...aria }) => (
                          <button
                            ref={ref}
                            type="button"
                            onClick={onClick}
                            disabled={!hydrated || pending}
                            aria-label={`Move ${stage.label}`}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted hover:bg-raised focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus disabled:cursor-not-allowed"
                            {...aria}
                          >
                            ⋮
                          </button>
                        )}
                      />
                    ) : (
                      <Tooltip content={stage.blockedReason ?? 'Not yours to move'}>
                        <span
                          aria-label={`${stage.label} cannot be moved`}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-disabled-text"
                        >
                          ⋮
                        </span>
                      </Tooltip>
                    )}
                  </div>
                </div>

                {stage.tasks.length > 0 && (
                  <ul
                    aria-label={`Tasks in ${stage.label}`}
                    className="mt-3 flex flex-col gap-2 rounded-lg border border-line bg-canvas p-3"
                  >
                    {stage.tasks.map((task) => (
                      <li
                        key={task.id}
                        className="flex flex-wrap items-center justify-between gap-2"
                      >
                        <div className="min-w-0">
                          <p className="text-sm text-body">{task.label}</p>
                          {task.completedOn !== null && (
                            <Text tone="muted" size="xs">
                              done {task.completedOn}
                            </Text>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <StatusChip status={task.status} />
                          {stage.status !== 'completed' && task.status !== 'completed' && (
                            <Button
                              variant="ghost"
                              size="xs"
                              disabled={!hydrated || pending || !stage.movable}
                              onClick={() =>
                                tick(
                                  task,
                                  task.status === 'pending' ? 'in_progress' : 'completed',
                                )
                              }
                            >
                              {task.status === 'pending' ? 'Start' : 'Done'}
                            </Button>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </li>
          ))}
        </ol>
      </Card>

      <Modal
        open={evidenceStage !== null}
        onClose={() => setEvidenceStage(null)}
        title={`Attach a record to ${evidenceStage?.label ?? ''}`}
        description="What this stage produced. The buyer reads it on the order’s records, and a claim later rests on it."
        size="sm"
        footer={
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="secondary" onClick={() => setEvidenceStage(null)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              loading={pending || !hydrated}
              disabled={!hydrated}
              onClick={saveEvidence}
            >
              Attach
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          <FormField label="Kind of record" required>
            <Select
              options={EVIDENCE_OPTIONS}
              value={kind}
              onChange={(event) => setKind(event.target.value)}
            />
          </FormField>
          <FormField
            label="Title"
            required
            hint="What somebody looking for this later would search for."
          >
            <Input
              value={title}
              placeholder="eg. AOI report, batch 1 of 2"
              onChange={(event) => setTitle(event.target.value)}
            />
          </FormField>
          <FormField label="What it says" hint="Optional. Readings, findings, context.">
            <Textarea
              rows={3}
              value={detail}
              onChange={(event) => setDetail(event.target.value)}
            />
          </FormField>
          <Alert tone="info" title="No file is uploaded here">
            This build records what a record is and what it says, not its bytes. The
            title and the note are what both sides read, so write them as if they were
            the document.
          </Alert>
          {error !== undefined && (
            <Text tone="danger" size="sm">
              {error}
            </Text>
          )}
        </div>
      </Modal>
    </>
  );
};
