'use client';

import { useEffect, useState, useTransition } from 'react';
import {
  Alert,
  Button,
  Card,
  CardHeader,
  FormField,
  Input,
  Tag,
  Text,
  cn,
} from '@ideeza/ui';
import { CheckoutSummary } from './checkout-summary.js';
import {
  payOrderAction,
  type PayState,
} from '@/app/(app)/manufacturing/checkout/actions.js';
import type { PaymentMethodKind, ShippingChoice } from '@ideeza/domain';

export interface PaymentStepProps {
  readonly orderId: string;
  readonly currency: string;
  readonly shippingChoice: ShippingChoice;
  readonly lines: readonly {
    readonly label: string;
    readonly amountMinor: number;
    readonly note?: string;
  }[];
  readonly totalMinor: number;
  readonly promoCode: string | null;
  readonly promoDescription: string | null;
  readonly discountMinor: number;
  readonly manufacturerName: string;
  readonly quantity: number;
  readonly productName: string;
}

interface MethodOption {
  readonly id: PaymentMethodKind;
  readonly label: string;
  readonly detail: string;
  readonly badge?: string;
}

const METHODS: readonly MethodOption[] = [
  { id: 'card', label: 'Card', detail: 'Visa, Mastercard, Amex' },
  { id: 'paypal', label: 'PayPal', detail: 'You approve the hold in PayPal' },
  { id: 'stablecoin', label: 'USDT', detail: 'Held on-chain by the platform wallet' },
  {
    id: 'platform_token',
    label: 'IDZ',
    detail: 'The IDEEZA token, from your connected wallet',
    badge: 'No platform fee on IDZ in future releases',
  },
  { id: 'bank', label: 'Bank transfer', detail: 'IDEEZA sends the account details' },
];

/**
 * Step two: how the platform comes to hold the money.
 *
 * No payment provider is connected in this build. The payment is recorded and
 * the funds are marked as held, which is the transition that confirms the
 * order; the screen says exactly that rather than implying a card was charged.
 */
export const PaymentStep = ({
  orderId,
  currency,
  shippingChoice,
  lines,
  totalMinor,
  promoCode,
  promoDescription,
  discountMinor,
  manufacturerName,
  quantity,
  productName,
}: PaymentStepProps) => {
  const [pending, startTransition] = useTransition();
  const [state, setState] = useState<PayState>({});
  const [method, setMethod] = useState<PaymentMethodKind>('card');
  const [hydrated, setHydrated] = useState(false);
  const [terms, setTerms] = useState(false);
  const [card, setCard] = useState({
    name: '',
    number: '',
    expiry: '',
    cvc: '',
    wallet: '',
  });
  const [applied, setApplied] = useState<{
    readonly code: string;
    readonly discountMinor: number;
    readonly description: string | null;
  } | null>(
    promoCode === null
      ? null
      : { code: promoCode, discountMinor, description: promoDescription },
  );

  useEffect(() => setHydrated(true), []);

  const pay = (): void => {
    const form = new FormData();
    form.set('orderId', orderId);
    form.set('shippingChoice', shippingChoice);
    form.set('method', method);
    if (applied !== null) form.set('promoCode', applied.code);
    if (method === 'card') {
      form.set('cardName', card.name);
      form.set('cardNumber', card.number);
      form.set('cardExpiry', card.expiry);
      form.set('cardCvc', card.cvc);
    }
    if (method === 'stablecoin' || method === 'platform_token') {
      form.set('walletAddress', card.wallet);
    }
    // Sent as it stands, so the server decides rather than trusting the button.
    form.set('acceptTerms', terms ? 'on' : 'off');

    startTransition(async () => {
      const result = await payOrderAction({}, form);
      setState(result);
      if (result.redirectTo === undefined) return;
      // A full navigation, not a client push: this is the one step that moves
      // money, and a soft navigation that gets dropped would leave the buyer on
      // a paid order with no receipt. It has been seen to happen under load, so
      // the receipt is fetched from the server outright.
      window.location.assign(result.redirectTo);
    });
  };

  const effectiveDiscount = applied?.discountMinor ?? 0;
  const effectiveTotal = totalMinor + discountMinor - effectiveDiscount;
  const summaryLines = lines
    .filter((line) => line.amountMinor >= 0)
    .concat(
      effectiveDiscount > 0
        ? [{ label: applied?.code ?? 'Discount', amountMinor: -effectiveDiscount }]
        : [],
    );

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">

      <div className="flex min-w-0 flex-col gap-5">
        {state.error !== undefined && (
          <Alert tone="danger" title="This payment was not taken">
            {state.error}
          </Alert>
        )}

        <Alert tone="info" title="How IDEEZA holds the money">
          The funds are held by the platform, not sent to {manufacturerName}. They
          are released only against a documented order event. No payment provider
          is connected in this build, so the amount is recorded as held rather
          than charged.
        </Alert>

        <Card padded={false}>
          <div className="border-b border-border-subtle p-4 md:px-6">
            <CardHeader
              title="Payment method"
              description={`${productName} · ${quantity} units`}
            />
          </div>
          <ul aria-label="Payment methods" className="flex flex-col">
            {METHODS.map((option) => (
              <li key={option.id} className="border-b border-border-subtle last:border-0">
                <label
                  className={cn(
                    'flex cursor-pointer items-start gap-3 p-4 transition-colors md:px-6',
                    method === option.id ? 'bg-bg-brand-subtle' : 'hover:bg-bg-surface-raised',
                  )}
                >
                  <input
                    type="radio"
                    name="methodChoice"
                    value={option.id}
                    checked={method === option.id}
                    onChange={() => setMethod(option.id)}
                    className="mt-0.5 h-5 w-5 shrink-0 appearance-none rounded-full border-2 border-border bg-bg-surface checked:border-border-brand checked:bg-bg-brand focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus"
                    aria-label={option.label}
                  />
                  <span className="min-w-0">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-text-primary">
                        {option.label}
                      </span>
                      {option.badge !== undefined && <Tag tone="brand">{option.badge}</Tag>}
                    </span>
                    <span className="block text-xs text-text-tertiary">{option.detail}</span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </Card>

        {method === 'card' && (
          <Card>
            <CardHeader
              title="Card details"
              description="Checked here and not stored: the platform holds funds, so a card number has no place in this database."
            />
            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
              <FormField
                label="Name on card"
                required
                error={state.fieldErrors?.['cardName']}
                className="md:col-span-2"
              >
                <Input
                  name="cardName"
                  autoComplete="cc-name"
                  value={card.name}
                  onChange={(event) =>
                    setCard((current) => ({ ...current, name: event.target.value }))
                  }
                />
              </FormField>
              <FormField
                label="Card number"
                required
                error={state.fieldErrors?.['cardNumber']}
                className="md:col-span-2"
              >
                <Input
                  value={card.number}
                  onChange={(event) =>
                    setCard((current) => ({ ...current, number: event.target.value }))
                  }
                  name="cardNumber"
                  inputMode="numeric"
                  autoComplete="cc-number"
                  placeholder="4242 4242 4242 4242"
                />
              </FormField>
              <FormField
                label="Expiry"
                required
                hint="MM/YY"
                error={state.fieldErrors?.['cardExpiry']}
              >
                <Input
                  name="cardExpiry"
                  placeholder="04/29"
                  autoComplete="cc-exp"
                  value={card.expiry}
                  onChange={(event) =>
                    setCard((current) => ({ ...current, expiry: event.target.value }))
                  }
                />
              </FormField>
              <FormField
                label="Security code"
                required
                error={state.fieldErrors?.['cardCvc']}
              >
                <Input
                  name="cardCvc"
                  inputMode="numeric"
                  autoComplete="cc-csc"
                  value={card.cvc}
                  onChange={(event) =>
                    setCard((current) => ({ ...current, cvc: event.target.value }))
                  }
                />
              </FormField>
            </div>
          </Card>
        )}

        {(method === 'stablecoin' || method === 'platform_token') && (
          <Card>
            <CardHeader
              title="Connect a wallet"
              description="The platform holds the funds in escrow at this address until the order is settled."
            />
            <div className="mt-4">
              <FormField
                label="Wallet address"
                required
                error={state.fieldErrors?.['walletAddress']}
              >
                <Input
                  name="walletAddress"
                  placeholder="0x…"
                  value={card.wallet}
                  onChange={(event) =>
                    setCard((current) => ({ ...current, wallet: event.target.value }))
                  }
                />
              </FormField>
            </div>
          </Card>
        )}

        {method === 'paypal' && (
          <Alert tone="info" title="You approve the hold in PayPal">
            IDEEZA records the hold against your PayPal account. Nothing leaves it
            until the funds are released to the manufacturer.
          </Alert>
        )}

        {method === 'bank' && (
          <Alert tone="info" title="IDEEZA sends the account details">
            The order is confirmed when the transfer arrives in the platform
            account. This build records the hold immediately so the flow can be
            reviewed end to end.
          </Alert>
        )}

        <Card>
          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              name="acceptTerms"
              checked={terms}
              onChange={(event) => setTerms(event.target.checked)}
              className="mt-0.5 h-5 w-5 shrink-0 appearance-none rounded border-2 border-border bg-bg-surface checked:border-border-brand checked:bg-bg-brand focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus"
            />
            <span className="text-sm text-text-secondary">
              I agree to the IDEEZA Terms &amp; Conditions and the product-specific
              terms, and I understand that accepting a quote and paying opens a
              manufacturing order that only IDEEZA operations can cancel once
              production has started.
            </span>
          </label>
          {state.fieldErrors?.['acceptTerms'] !== undefined && (
            <Text tone="danger" size="xs" className="mt-2">
              {state.fieldErrors['acceptTerms']}
            </Text>
          )}
        </Card>
      </div>

      <div className="lg:sticky lg:top-24 lg:self-start">
        <CheckoutSummary
          orderId={orderId}
          currency={currency}
          lines={summaryLines}
          totalMinor={effectiveTotal}
          appliedCode={applied?.code ?? null}
          appliedDescription={applied?.description ?? null}
          discountMinor={effectiveDiscount}
          onPromoChange={setApplied}
          action={
            <Button
              type="button"
              size="lg"
              fullWidth
              onClick={pay}
              loading={pending || !hydrated}
              disabled={!hydrated || !terms}
            >
              Pay {currency} {(effectiveTotal / 100).toFixed(2)}
            </Button>
          }
        />
      </div>
    </div>
  );
};
