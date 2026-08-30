'use client';

import Link from 'next/link';
import { useState } from 'react';
import {
  Badge,
  Button,
  EmptyState,
  IconButton,
  Modal,
  Text,
  Tooltip,
  buttonAppearance,
  cn,
} from '@ideeza/ui';
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

const BoardIcon = (
  <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden>
    <rect x="3" y="3" width="14" height="14" rx="2" stroke="currentColor" strokeWidth="1.4" />
    <path d="M7 7h2v2H7zM11 7h2v2h-2zM7 11h6v2H7z" fill="currentColor" />
  </svg>
);

const CubeIcon = (
  <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden>
    <path
      d="M10 2.8 3.8 6v8L10 17.2 16.2 14V6L10 2.8Z"
      stroke="currentColor"
      strokeWidth="1.3"
      strokeLinejoin="round"
    />
    <path d="M3.8 6 10 9.4 16.2 6M10 9.4v7.8" stroke="currentColor" strokeWidth="1.3" />
  </svg>
);

const FileIcon = (
  <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden>
    <path
      d="M5 3h6l4 4v10H5V3Z"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinejoin="round"
    />
    <path d="M11 3v4h4" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
  </svg>
);

const TYPE_ICONS: Readonly<Record<PackageKind, readonly { readonly key: string; readonly icon: React.ReactNode; readonly label: string }[]>> = {
  pcb: [{ key: 'board', icon: BoardIcon, label: 'Printed circuit board' }],
  module_3d: [{ key: 'cube', icon: CubeIcon, label: '3D module' }],
  full_product: [
    { key: 'board', icon: BoardIcon, label: 'Printed circuit board' },
    { key: 'cube', icon: CubeIcon, label: 'Enclosure' },
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
                    background: `linear-gradient(135deg, hsl(${hue} 45% 74%), hsl(${(hue + 40) % 360} 50% 58%))`,
                  }}
                >
                  <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden>
                    <rect x="3" y="3" width="14" height="14" rx="2" stroke="white" strokeWidth="1.3" opacity="0.85" />
                    <path d="M7 7h2v2H7zM11 7h2v2h-2zM7 11h6v2H7z" fill="white" opacity="0.85" />
                  </svg>
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
                      className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-border text-[10px] text-text-tertiary"
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
                        <svg width="18" height="18" viewBox="0 0 20 20" aria-hidden>
                          <circle cx="4" cy="10" r="1.5" fill="currentColor" />
                          <circle cx="10" cy="10" r="1.5" fill="currentColor" />
                          <circle cx="16" cy="10" r="1.5" fill="currentColor" />
                        </svg>
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
                  <span className={cn('text-text-tertiary')}>{FileIcon}</span>
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
