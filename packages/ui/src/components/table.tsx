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
 *
 * Painted per the system's table molecules: the header row (M60) sits on the
 * subtle surface in 14 medium secondary with no stroke of its own, and each
 * body row (M61/M62) carries a subtle bottom border, 16px cell padding and
 * body text at 16, taking the subtle surface on hover.
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
        <caption className={cn('text-left text-sm text-text-tertiary', captionHidden && 'sr-only')}>
          {caption}
        </caption>
        <thead>
          <tr>
            {columns.map((column) => (
              <th
                key={column.id}
                scope="col"
                style={column.width === undefined ? undefined : { width: column.width }}
                className={cn(
                  'whitespace-nowrap bg-bg-subtle px-4 py-3 text-sm font-medium text-text-secondary',
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
            <tr
              key={rowKey(row)}
              className="border-b border-border-subtle transition-colors duration-fast last:border-0 hover:bg-bg-subtle"
            >
              {columns.map((column) => (
                <td
                  key={column.id}
                  className={cn(
                    'px-4 py-4 align-middle text-base text-text-secondary',
                    // A cell's link measured 20px tall, under the 24px a
                    // pointer target needs. Padding an inline box grows what
                    // can be clicked without growing the line it sits on, so
                    // the hit area reaches 24px and the row keeps its height.
                    '[&_a]:py-0.5',
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
        <dt className="text-sm text-text-tertiary">{item.label}</dt>
        <dd className="text-right text-sm font-medium text-text-primary">{item.value}</dd>
      </div>
    ))}
  </dl>
);
