'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Badge, Button, buttonAppearance, cn, EmptyState, Icon, IconButton, Modal, Text, Tooltip } from '@ideeza/ui';
import { RowMenu } from '@/components/row-menu.js';
import { PACKAGE_COPY, selectHref } from '@/lib/rfq-copy.js';
import type { PackageKind } from '@ideeza/domain';

export interface DraftRow {
  readonly rfqId: string;
  readonly productId: string;
  readonly productName: string;
  readonly creatorName: string;
  readonly kind: PackageKind;
  readonly quantity: number;
  readonly leadTimeDays: number;
  readonly fileCount: number;
  readonly bomLineCount: number;
  readonly files: readonly { readonly id: string; readonly name: string; readonly revision: number }[];
}

export interface DraftListProps {
  readonly drafts: readonly DraftRow[];
}

/** A stable hue per draft, so the row thumbnail is the same on every render. */
const hueOf = (seed: string): number => {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) % 360;
  }
  return hash;
};

const TYPE_ICONS: Readonly<Record<PackageKind, readonly { readonly key: string; readonly icon: React.ReactNode; readonly label: string }[]>> = {
  pcb: [{ key: 'board', icon: <Icon name="board" size={16} />, label: 'Printed circuit board' }],
  module_3d: [{ key: 'cube', icon: <Icon name="cube" size={16} />, label: '3D module' }],
  full_product: [
    { key: 'board', icon: <Icon name="board" size={16} />, label: 'Printed circuit board' },
    { key: 'cube', icon: <Icon name="cube" size={16} />, label: 'Enclosure' },
  ],
};

/**
 * The Draft tab, as the design lays it out: what the draft is, what travels
 * with it, and the one action that moves it on.
 *
 * The cost column stays empty on purpose until a manufacturer quotes: a number
 * there before anybody has priced the work would be a guess.
 */
export const DraftList = ({ drafts }: DraftListProps) => {
  const [showFiles, setShowFiles] = useState<DraftRow | null>(null);

  if (drafts.length === 0) {
    return (
      <EmptyState
        title="No drafts yet"
        description="A draft starts from a product you have kept: open it and choose Start Manufacturing."
        action={
          <Link href="/favorites" className={buttonAppearance({ variant: 'secondary' })}>
            Go to Favorites
          </Link>
        }
      />
    );
  }

  return (
    <>
      <ul aria-label="Manufacturing drafts" className="flex flex-col gap-3">
        {drafts.map((draft) => {
          const hue = hueOf(draft.productName);
          return (
            <li
              key={draft.rfqId}
              className="flex flex-wrap items-center gap-4 rounded-xl border border-border-subtle bg-bg-surface p-4"
            >
              {/* identity */}
              <div className="flex min-w-[220px] flex-1 items-center gap-3">
                <span
                  aria-hidden
                  className="flex h-9 w-12 shrink-0 items-center justify-center rounded border border-border-subtle"
                  style={{
                    // eslint-disable-next-line ideeza/design-tokens -- placeholder artwork generated from the board's own hue, not a colour of the interface
                    background: `linear-gradient(135deg, hsl(${hue} 45% 74%), hsl(${(hue + 40) % 360} 50% 58%))`,
                  }}
                >
                  <Icon name="board" size={18} className="opacity-overlay" />
                </span>
                <div className="min-w-0">
                  <Link
                    href={`/manufacturing/draft/${draft.rfqId}`}
                    className="block truncate text-sm font-medium text-text-secondary hover:text-text-brand focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus"
                  >
                    {draft.productName}
                  </Link>
                  <button
                    type="button"
                    onClick={() => setShowFiles(draft)}
                    className="text-sm font-medium text-text-brand underline focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus"
                  >
                    Show files ({draft.fileCount})
                  </button>
                </div>
              </div>

              {/* what is included */}
              <div className="flex min-w-[140px] flex-col gap-1">
                <Text tone="muted" size="xs">
                  Type included
                </Text>
                <div className="flex items-center gap-1.5 text-text-secondary">
                  {TYPE_ICONS[draft.kind].map((entry, index) => (
                    <span key={entry.key} className="flex items-center gap-1.5">
                      {index > 0 && <span aria-hidden className="text-text-tertiary">·</span>}
                      <Tooltip content={entry.label}>
                        <span aria-label={entry.label}>{entry.icon}</span>
                      </Tooltip>
                    </span>
                  ))}
                  <span className="ml-1 text-xs text-text-tertiary">{PACKAGE_COPY[draft.kind]}</span>
                </div>
              </div>

              {/* the run */}
              <div className="flex min-w-[110px] flex-col gap-1">
                <Text tone="muted" size="xs">
                  Volume
                </Text>
                <span className="text-base font-semibold text-text-secondary">{draft.quantity}</span>
              </div>

              {/* cost, which nobody has quoted yet */}
              <div className="flex min-w-[110px] flex-col gap-1">
                <span className="flex items-center gap-1">
                  <Text tone="muted" size="xs">
                    Cost
                  </Text>
                  <Tooltip content="A cost appears once a manufacturer has quoted this request.">
                    <span
                      aria-label="Why is there no cost?"
                      className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-border text-3xs text-text-tertiary"
                    >
                      i
                    </span>
                  </Tooltip>
                </span>
                <span className="text-base font-semibold text-text-tertiary">Not quoted</span>
              </div>

              {/* the one action, plus the rest behind a menu */}
              <div className="flex items-center gap-3">
                <Link href={selectHref(draft.rfqId)} className={buttonAppearance({ size: 'sm' })}>
                  Select manufacturer
                </Link>
                <RowMenu
                  label={`More actions for ${draft.productName}`}
                  align="end"
                  items={[
                    {
                      id: 'edit',
                      label: 'Edit the draft',
                      href: `/manufacturing/draft/${draft.rfqId}`,
                    },
                    {
                      id: 'files',
                      label: `Show files (${draft.fileCount})`,
                      onSelect: () => setShowFiles(draft),
                    },
                    {
                      id: 'product',
                      label: 'View the product',
                      href: `/products/${draft.productId}`,
                    },
                  ]}
                  trigger={(props) => (
                    <IconButton
                      {...props}
                      label={`More actions for ${draft.productName}`}
                      variant="ghost"
                      icon={
                        <Icon name="more" size={18} />
                      }
                    />
                  )}
                />
              </div>
            </li>
          );
        })}
      </ul>

      <Modal
        open={showFiles !== null}
        onClose={() => setShowFiles(null)}
        title={`Files travelling with ${showFiles?.productName ?? 'this draft'}`}
        description="These are the files a manufacturer receives with the request."
        size="sm"
        footer={
          <div className="flex justify-end">
            <Button variant="secondary" onClick={() => setShowFiles(null)}>
              Close
            </Button>
          </div>
        }
      >
        {showFiles !== null && (
          <ul className="flex flex-col gap-2">
            {showFiles.files.length === 0 ? (
              <Text tone="muted" size="sm">
                No files are included yet. Add them in the draft.
              </Text>
            ) : (
              showFiles.files.map((file) => (
                <li
                  key={file.id}
                  className="flex items-center gap-2 rounded-lg border border-border-subtle px-3 py-2"
                >
                  <span className={cn('text-text-tertiary')}><Icon name="file" /></span>
                  <span className="min-w-0 flex-1 truncate text-sm text-text-primary">{file.name}</span>
                  <Badge tone="neutral">rev {file.revision}</Badge>
                </li>
              ))
            )}
          </ul>
        )}
      </Modal>
    </>
  );
};
