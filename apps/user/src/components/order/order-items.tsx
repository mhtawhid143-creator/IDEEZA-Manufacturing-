'use client';

import { useState } from 'react';
import {
  Button,
  Card,
  DefinitionList,
  Modal,
  Text,
  Tag,
} from '@ideeza/ui';

export interface ItemRow {
  readonly id: string;
  readonly name: string;
  readonly detail: string;
  readonly quantity: number;
  readonly unitPriceMajor: string;
  readonly lineTotalMajor: string;
  readonly reference: string | null;
  readonly manufacturerPartNumber: string | null;
  readonly sku: string | null;
}

export interface ItemGroup {
  readonly id: string;
  readonly title: string;
  readonly items: readonly ItemRow[];
  readonly grandTotalMajor: string;
}

export interface OrderItemsProps {
  readonly groups: readonly ItemGroup[];
  readonly currency: string;
  /** The frozen production spec every line was quoted against. */
  readonly spec: readonly { readonly label: string; readonly value: string }[];
}

/**
 * What was ordered, priced line by line.
 *
 * The prices are the accepted quote's own lines, so the detail a buyer opens is
 * the manufacturer's costing rather than a recalculation. The specification is
 * the one the terms froze: it belongs to the whole order, not to a line, so it
 * is shown identically for every item instead of being invented per row.
 */
export const OrderItems = ({ groups, currency, spec }: OrderItemsProps) => {
  const [open, setOpen] = useState<ItemRow | null>(null);

  return (
    <div className="flex flex-col gap-4">
      {groups.map((group) => (
        <Card key={group.id} padded={false}>
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-subtle px-4 py-3 md:px-6">
            <p className="text-sm font-semibold text-text-primary">
              {group.title}{' '}
              <span className="font-normal text-text-tertiary">
                ({group.items.length} {group.items.length === 1 ? 'item' : 'items'})
              </span>
            </p>
            <div className="text-right">
              <Text tone="muted" size="xs">
                Grand Total
              </Text>
              <p className="text-sm font-bold text-text-primary">
                {currency} {group.grandTotalMajor}
              </p>
            </div>
          </div>

          <ul aria-label={group.title}>
            {group.items.map((item) => (
              <li
                key={item.id}
                className="flex flex-wrap items-center gap-4 border-b border-border-subtle px-4 py-3 last:border-b-0 md:px-6"
              >
                <span
                  aria-hidden
                  className="h-12 w-12 shrink-0 rounded-md bg-gradient-to-br from-bg-brand-subtle to-blue-100"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-text-primary">{item.name}</p>
                  <Text tone="muted" size="xs" className="mt-0.5">
                    {item.detail}
                  </Text>
                </div>
                <div className="shrink-0">
                  <Text tone="muted" size="xs">
                    Per unit
                  </Text>
                  <p className="text-sm font-semibold text-text-primary">
                    {currency} {item.unitPriceMajor}
                  </p>
                </div>
                <Tag tone="brand">{item.quantity} pcs</Tag>
                <Button variant="ghost" size="sm" onClick={() => setOpen(item)}>
                  View Details
                </Button>
              </li>
            ))}
          </ul>
        </Card>
      ))}

      <Modal
        open={open !== null}
        onClose={() => setOpen(null)}
        title={open === null ? '' : `Details — ${open.name}`}
        description="Exactly what the accepted quote covers for this line."
        size="lg"
      >
        {open !== null && (
          <div className="flex flex-col gap-4">
            <DefinitionList
              columns={2}
              items={[
                { label: 'Quantity', value: String(open.quantity) },
                { label: 'Per unit', value: `${currency} ${open.unitPriceMajor}` },
                { label: 'Line total', value: `${currency} ${open.lineTotalMajor}` },
                { label: 'BOM reference', value: open.reference ?? 'Priced as one lot' },
                {
                  label: 'Manufacturer part number',
                  value: open.manufacturerPartNumber ?? '—',
                },
                { label: 'SKU', value: open.sku ?? '—' },
              ]}
            />
            <div>
              <p className="text-sm font-semibold text-text-primary">Production specification</p>
              <Text tone="muted" size="xs" className="mt-0.5">
                Frozen when the quote was accepted. It applies to the whole order.
              </Text>
              <DefinitionList className="mt-3" columns={2} items={[...spec]} />
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
