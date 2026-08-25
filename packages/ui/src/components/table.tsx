import type { ReactNode } from 'react';
import { cn } from '../lib/cn.js';

export interface Column<TRow> {
  readonly id: string;
  readonly header: ReactNode;
  readonly cell: (row: TRow) => ReactNode;
  readonly align?: 'left' | 'right' | 'center';
  /** Hidden below the large breakpoint, for the columns the phone drops. */
  readonly hideBelowLg?: boolean;
  readonly width?: string;
}

export interface DataTableProps<TRow> {
  readonly caption: string;
  readonly columns: readonly Column<TRow>[];
  readonly rows: readonly TRow[];
  readonly rowKey: (row: TRow) => string;
  readonly emptyState?: ReactNode;
  readonly className?: string;
  readonly captionHidden?: boolean;
}

const ALIGN = { left: 'text-left', right: 'text-right', center: 'text-center' } as const;

/**
 * A real table: caption, scope on the headers and one row per record, so screen
 * readers can navigate it. Wide content scrolls inside its own container rather
 * than pushing the page sideways.
 */
export const DataTable = <TRow,>({
  caption,
  columns,
  rows,
  rowKey,
  emptyState,
  className,
  captionHidden = true,
}: DataTableProps<TRow>) => {
  if (rows.length === 0 && emptyState !== undefined) {
    return <div className={className}>{emptyState}</div>;
  }

  return (
    <div className={cn('w-full overflow-x-auto', className)}>
      <table className="w-full border-collapse text-sm">
        <caption className={cn('text-left text-sm text-muted', captionHidden && 'ids-sr-only')}>
          {caption}
        </caption>
        <thead>
          <tr className="border-b border-line">
            {columns.map((column) => (
              <th
                key={column.id}
                scope="col"
                style={column.width === undefined ? undefined : { width: column.width }}
                className={cn(
                  'whitespace-nowrap px-3 py-3 text-xs font-semibold uppercase tracking-wide text-muted',
                  ALIGN[column.align ?? 'left'],
                  column.hideBelowLg === true && 'hidden lg:table-cell',
                )}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={rowKey(row)} className="border-b border-line last:border-0 hover:bg-canvas">
              {columns.map((column) => (
                <td
                  key={column.id}
                  className={cn(
                    'px-3 py-3.5 align-middle text-sm text-body',
                    ALIGN[column.align ?? 'left'],
                    column.hideBelowLg === true && 'hidden lg:table-cell',
                  )}
                >
                  {column.cell(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export interface DefinitionListProps {
  readonly items: readonly { readonly label: string; readonly value: ReactNode }[];
  readonly className?: string;
  readonly columns?: 1 | 2;
}

/** The "label : value" blocks the Figma detail panels are made of. */
export const DefinitionList = ({ items, className, columns = 1 }: DefinitionListProps) => (
  <dl
    className={cn(
      'grid gap-x-6 gap-y-3',
      columns === 2 ? 'sm:grid-cols-2' : 'grid-cols-1',
      className,
    )}
  >
    {items.map((item) => (
      <div key={item.label} className="flex items-start justify-between gap-4">
        <dt className="text-sm text-muted">{item.label}</dt>
        <dd className="text-right text-sm font-medium text-heading">{item.value}</dd>
      </div>
    ))}
  </dl>
);
