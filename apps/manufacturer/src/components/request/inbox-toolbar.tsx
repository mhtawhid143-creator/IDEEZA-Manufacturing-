'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { FormField, SearchInput, Select } from '@ideeza/ui';

const STATUS_OPTIONS = [
  { value: 'all', label: 'Any status' },
  { value: 'routed', label: 'New RFQ' },
  { value: 'viewed', label: 'Opened' },
  { value: 'quoted', label: 'Quote sent' },
  { value: 'declined', label: 'Declined' },
  { value: 'expired', label: 'Expired' },
];

const KIND_OPTIONS = [
  { value: 'all', label: 'Any work type' },
  { value: 'pcb', label: 'PCB only' },
  { value: 'module_3d', label: '3D module' },
  { value: 'full_product', label: 'Full product' },
];

/**
 * Searching and narrowing the inbox.
 *
 * The filters live in the address bar, so a shop can keep "new PCB requests"
 * bookmarked and the back button behaves. Changing a filter always returns to
 * page one, because staying on page four of a different result set shows nothing.
 */
export const InboxToolbar = () => {
  const router = useRouter();
  const params = useSearchParams();
  const [search, setSearch] = useState(params.get('q') ?? '');

  // Keeps the box in step when the address changes for another reason.
  useEffect(() => {
    setSearch(params.get('q') ?? '');
  }, [params]);

  const apply = (changes: Readonly<Record<string, string>>): void => {
    const next = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(changes)) {
      if (value === '' || value === 'all') next.delete(key);
      else next.set(key, value);
    }
    next.delete('page');
    const query = next.toString();
    router.push(query === '' ? '/rfqs' : `/rfqs?${query}`);
  };

  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <form
        className="min-w-[240px] flex-1"
        onSubmit={(event) => {
          event.preventDefault();
          apply({ q: search });
        }}
      >
        <FormField label="Search by product name" labelHidden>
          <SearchInput
            name="q"
            placeholder="Search by Quote Name"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </FormField>
      </form>

      <div className="flex flex-wrap items-end gap-3">
        <FormField label="Status" labelHidden className="min-w-[160px]">
          <Select
            options={STATUS_OPTIONS}
            value={params.get('status') ?? 'all'}
            onChange={(event) => apply({ status: event.target.value })}
          />
        </FormField>
        <FormField label="Work type" labelHidden className="min-w-[170px]">
          <Select
            options={KIND_OPTIONS}
            value={params.get('kind') ?? 'all'}
            onChange={(event) => apply({ kind: event.target.value })}
          />
        </FormField>
      </div>
    </div>
  );
};
