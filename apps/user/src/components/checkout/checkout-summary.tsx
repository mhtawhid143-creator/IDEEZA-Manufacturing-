'use client';

import { useState, useTransition } from 'react';
import { Alert, Button, Card, Input, Text, cn } from '@ideeza/ui';
import { readPromoAction } from '@/app/(app)/manufacturing/checkout/actions.js';

export interface SummaryLine {
  readonly label: string;
  readonly amountMinor: number;
  readonly note?: string;
}

export interface CheckoutSummaryProps {
  readonly orderId: string;
  readonly currency: string;
  readonly lines: readonly SummaryLine[];
  readonly totalMinor: number;
  readonly appliedCode: string | null;
  readonly appliedDescription: string | null;
  readonly discountMinor: number;
  /** Rendered under the total: the button that moves the flow on. */
  readonly action: React.ReactNode;
  readonly onPromoChange?: (
    applied:
      | { readonly code: string; readonly discountMinor: number; readonly description: string | null }
      | null,
  ) => void;
}

const money = (currency: string, minor: number): string =>
  `${currency} ${(minor / 100).toFixed(2)}`;

/**
 * The order summary the design puts beside the checkout.
 *
 * The coupon field is real: the code is read on the server against this order,
 * and the reason it cannot be used is the reason the server gives.
 */
export const CheckoutSummary = ({
  orderId,
  currency,
  lines,
  totalMinor,
  appliedCode,
  appliedDescription,
  discountMinor,
  action,
  onPromoChange,
}: CheckoutSummaryProps) => {
  const [open, setOpen] = useState(appliedCode !== null);
  const [code, setCode] = useState(appliedCode ?? '');
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const apply = (): void => {
    startTransition(async () => {
      const result = await readPromoAction(orderId, code);
      if (result.usable === true) {
        setMessage(null);
        onPromoChange?.({
          code: result.code ?? code.trim().toUpperCase(),
          discountMinor: result.discountMinor ?? 0,
          description: result.description ?? null,
        });
        return;
      }
      setMessage(result.message ?? 'That code cannot be used here.');
      onPromoChange?.(null);
    });
  };

  const clear = (): void => {
    setCode('');
    setMessage(null);
    onPromoChange?.(null);
  };

  return (
    <Card className="flex flex-col gap-4">
      <h3 className="text-sm font-semibold text-text-primary">Order summary</h3>

      <dl className="flex flex-col gap-2 text-sm">
        {lines.map((line) => (
          <div key={line.label} className="flex items-start justify-between gap-4">
            <dt className="text-text-secondary">
              {line.label}
              {line.note !== undefined && (
                <span className="block text-xs text-text-tertiary">{line.note}</span>
              )}
            </dt>
            <dd
              className={cn(
                'text-right font-medium',
                line.amountMinor < 0 ? 'text-text-success' : 'text-text-primary',
              )}
            >
              {line.amountMinor < 0 ? '−' : ''}
              {money(currency, Math.abs(line.amountMinor))}
            </dd>
          </div>
        ))}
      </dl>

      <div className="border-t border-border-subtle pt-3">
        {appliedCode === null ? (
          open ? (
            <div className="flex flex-col gap-2">
              <div className="flex items-end gap-2">
                <label className="min-w-0 flex-1">
                  <span className="mb-1 block text-xs font-medium text-text-secondary">
                    Coupon code
                  </span>
                  <Input
                    value={code}
                    onChange={(event) => setCode(event.target.value.toUpperCase())}
                    placeholder="IDEEZA10"
                    invalid={message !== null}
                    aria-label="Coupon code"
                  />
                </label>
                <Button
                  variant="secondary"
                  loading={pending}
                  disabled={code.trim() === ''}
                  onClick={apply}
                >
                  Apply
                </Button>
              </div>
              {message !== null && (
                <Text tone="danger" size="xs">
                  {message}
                </Text>
              )}
            </div>
          ) : (
            <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
              Have a coupon?
            </Button>
          )
        ) : (
          <Alert tone="success" title={`${appliedCode} applied`}>
            {appliedDescription ?? 'The discount is on the total below.'}{' '}
            <button
              type="button"
              onClick={clear}
              className="font-semibold underline focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus"
            >
              Remove
            </button>
            <span className="mt-1 block text-xs">
              −{money(currency, discountMinor)}
            </span>
          </Alert>
        )}
      </div>

      <div className="flex items-end justify-between gap-4 border-t border-border-subtle pt-3">
        <span className="text-sm font-semibold text-text-primary">Total to pay now</span>
        <span className="text-right">
          <span className="block text-xl font-semibold text-text-primary">
            {money(currency, totalMinor)}
          </span>
          <span className="block text-xs text-text-tertiary">held by IDEEZA until delivery</span>
        </span>
      </div>

      {action}

      <Text tone="muted" size="xs">
        By continuing you agree to the IDEEZA Terms &amp; Conditions and the IDEEZA
        product-specific terms. The platform holds the funds; they reach the
        manufacturer only against a documented order event.
      </Text>
    </Card>
  );
};
