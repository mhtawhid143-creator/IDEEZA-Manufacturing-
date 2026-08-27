import { Card, CardHeader, StatusChip, Text, Timeline, type TimelineItem } from '@ideeza/ui';
import type { ProductionStageView } from '@/data/production.js';

const moment = (value: Date | null): string =>
  value === null
    ? ''
    : `${value.toISOString().slice(0, 10)} · ${value.toISOString().slice(11, 16)} UTC`;

const ADVANCED_BY: Readonly<Record<string, string>> = {
  system: 'Moved by the platform',
  manufacturer: 'Moved by the manufacturer',
  buyer: 'Moved by you',
};

export interface ProductionProgressProps {
  readonly stages: readonly ProductionStageView[];
  readonly delayDays: number;
}

/**
 * The ten canonical stages, as the buyer reads them.
 *
 * Every order has all ten from the moment the funds are held, so the buyer can
 * see what is still ahead rather than only what has happened. The tasks inside a
 * stage are the manufacturer's own detail and are read-only here — the buyer
 * never moves production.
 */
export const ProductionProgress = ({ stages, delayDays }: ProductionProgressProps) => {
  const items: readonly TimelineItem[] = stages.map((stage) => {
    const state =
      stage.status === 'completed'
        ? ('done' as const)
        : stage.status === 'in_progress'
          ? ('current' as const)
          : ('upcoming' as const);

    const when =
      stage.completedAt !== null
        ? moment(stage.completedAt)
        : stage.startedAt !== null
          ? `started ${moment(stage.startedAt)}`
          : 'not started';

    return {
      id: stage.id,
      label: stage.label,
      state,
      meta: when,
      description: stage.note ?? ADVANCED_BY[stage.advancedBy] ?? null,
      children:
        stage.tasks.length === 0 && stage.evidenceCount === 0 ? undefined : (
          <div className="flex flex-col gap-2">
            {stage.tasks.length > 0 && (
              <ul aria-label={`${stage.label} tasks`} className="flex flex-col gap-1.5">
                {stage.tasks.map((task) => (
                  <li key={task.id} className="flex items-center justify-between gap-3">
                    <span className="min-w-0 truncate text-sm text-body">{task.label}</span>
                    <StatusChip status={task.status} />
                  </li>
                ))}
              </ul>
            )}
            {stage.evidenceCount > 0 && (
              <Text tone="muted" size="xs">
                {stage.evidenceCount} record
                {stage.evidenceCount === 1 ? '' : 's'} attached to this stage
              </Text>
            )}
          </div>
        ),
    };
  });

  return (
    <Card>
      <CardHeader
        title="Production Progress"
        description="The ten stages every IDEEZA order runs through, with the shop-floor tasks inside the stage that is live."
      />
      {delayDays !== 0 && (
        <Text tone="muted" size="xs" className="mt-2">
          {delayDays > 0
            ? `${delayDays} days were added by decisions you approved during production.`
            : `${Math.abs(delayDays)} days were saved by decisions you approved during production.`}
        </Text>
      )}
      <Timeline className="mt-4" label="Production stages" items={items} />
    </Card>
  );
};
