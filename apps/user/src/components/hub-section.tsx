import type { ReactNode } from 'react';
import { Card, PageHeader } from '@ideeza/ui';
import { HubTabs } from './hub-tabs.js';
import { MANUFACTURING_TABS } from '@/lib/navigation.js';
import { requireBuyer } from '@/lib/auth.js';

export interface HubSectionProps {
  /** The concrete path, authorised against the shared route table. */
  readonly path: string;
  /** Which hub tab this route is. */
  readonly activeId: string;
  /** What this tab lists. */
  readonly panel: ReactNode;
  /** How many records sit behind each tab, as the design shows them. */
  readonly counts?: Readonly<Record<string, number>> | undefined;
  readonly children?: ReactNode;
}

/**
 * The manufacturing hub frame.
 *
 * The four tabs are four routes, so the frame is shared rather than the page:
 * every tab renders the same header and tab row, passes the same guard, and
 * supplies its own list.
 */
export const HubSection = async ({
  path,
  activeId,
  panel,
  counts,
  children,
}: HubSectionProps) => {
  await requireBuyer(path);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Manufacturing"
        description="Send a product to manufacture, compare the quotes that come back, then pay to confirm the order."
      />

      <Card padded={false}>
        <div className="border-b border-line px-4 py-3 md:px-6">
          <HubTabs
            items={MANUFACTURING_TABS.map((tab) => ({
              id: tab.id,
              label: tab.label,
              href: tab.href,
              ...(counts?.[tab.id] === undefined ? {} : { count: counts[tab.id] }),
            }))}
            activeId={activeId}
          />
        </div>
        <div className="p-4 md:p-6">
          {panel}
        </div>
      </Card>

      {children}
    </div>
  );
};
