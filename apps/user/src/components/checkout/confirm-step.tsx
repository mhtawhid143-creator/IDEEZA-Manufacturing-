'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import {
  Button,
  Card,
  CardHeader,
  Radio,
  RadioGroup,
  Tag,
  Text,
  buttonAppearance,
  majorAmount,
} from '@ideeza/ui';
import { CheckoutSummary } from './checkout-summary.js';
import type { ShippingChoice } from '@ideeza/domain';
import { goTo } from '@/lib/navigate.js';

export interface ConfirmStepProps {
  readonly orderId: string;
  readonly currency: string;
  readonly manufacturerName: string;
  readonly manufacturerPlace: string;
  readonly productName: string;
  readonly quantity: number;
  readonly leadTimeDays: number;
  readonly includedServices: readonly string[];
  readonly specRows: readonly { readonly label: string; readonly value: string }[];
  readonly items: readonly {
    readonly name: string;
    readonly detail: string;
    readonly quantityNote: string;
  }[];
  readonly goodsMinor: number;
  readonly toolingMinor: number;
  readonly quotedShippingMinor: number;
  readonly expressSurchargeMinor: number;
  readonly platformFeeMinor: number;
  readonly shippingChoice: ShippingChoice;
  readonly deliveryAddress: {
    readonly line1: string;
    readonly line2: string | null;
    readonly city: string;
    readonly region: string | null;
    readonly postalCode: string | null;
    readonly countryCode: string;
  };
}

const money = (currency: string, minor: number): string =>
  `${currency} ${majorAmount(minor)}`;

/**
 * Step one: what is being bought, where it goes, and what it costs.
 *
 * The production scope is read-only on purpose. It comes from the accepted
 * quote's immutable snapshot, so the only way to change it is a new request —
 * which is exactly what the design's own note says.
 */
export const ConfirmStep = ({
  orderId,
  currency,
  manufacturerName,
  manufacturerPlace,
  productName,
  quantity,
  leadTimeDays,
  includedServices,
  specRows,
  items,
  goodsMinor,
  toolingMinor,
  quotedShippingMinor,
  expressSurchargeMinor,
  platformFeeMinor,
  shippingChoice: initialChoice,
  deliveryAddress,
}: ConfirmStepProps) => {
  const router = useRouter();
  const [choice, setChoice] = useState<ShippingChoice>(initialChoice);
  const [promo, setPromo] = useState<string | null>(null);
  const [discountMinor, setDiscountMinor] = useState(0);
  const [promoDescription, setPromoDescription] = useState<string | null>(null);

  const shippingMinor =
    quotedShippingMinor + (choice === 'express' ? expressSurchargeMinor : 0);
  const totalMinor =
    goodsMinor + toolingMinor + shippingMinor + platformFeeMinor - discountMinor;

  const lines = useMemo(
    () => [
      { label: `Units (${quantity})`, amountMinor: goodsMinor },
      ...(toolingMinor > 0
        ? [{ label: 'Tooling and setup', amountMinor: toolingMinor }]
        : []),
      {
        label: 'Shipping',
        amountMinor: shippingMinor,
        note: choice === 'express' ? 'Express' : 'Standard, as quoted',
      },
      { label: 'Platform fee', amountMinor: platformFeeMinor, note: '3% of the goods' },
      ...(discountMinor > 0
        ? [{ label: promo ?? 'Discount', amountMinor: -discountMinor }]
        : []),
    ],
    [
      quantity,
      goodsMinor,
      toolingMinor,
      shippingMinor,
      platformFeeMinor,
      discountMinor,
      choice,
      promo,
    ],
  );

  const goToPayment = (): void => {
    const query = new URLSearchParams({ shipping: choice });
    if (promo !== null) query.set('promo', promo);
    goTo(router, `/manufacturing/checkout/${orderId}/payment?${query.toString()}`);
  };

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
      <div className="flex min-w-0 flex-col gap-5">
        <Card className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-bg-page text-sm font-semibold text-text-brand">
              {manufacturerName.slice(0, 2).toUpperCase()}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-text-primary">
                {manufacturerName}
              </p>
              <Text tone="muted" size="xs">
                {manufacturerPlace} · {productName}
              </Text>
            </div>
          </div>
          <Tag tone="brand">{quantity} units</Tag>
        </Card>

        <Card>
          <CardHeader
            title="Production scope"
            description="Locked from the accepted quote — to change it, send a new request."
          />
          <ul className="mt-4 flex flex-col">
            {includedServices.map((service) => (
              <li
                key={service}
                className="flex items-center justify-between gap-3 border-b border-border-subtle py-2.5 last:border-0"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <span
                    aria-hidden
                    className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-bg-success-subtle text-2xs font-bold text-text-success"
                  >
                    ✓
                  </span>
                  <span className="truncate text-sm text-text-primary">{service}</span>
                </span>
                <span className="shrink-0 text-xs text-text-tertiary">Included</span>
              </li>
            ))}
            {specRows.map((row) => (
              <li
                key={row.label}
                className="flex items-center justify-between gap-3 border-b border-border-subtle py-2.5 last:border-0"
              >
                <span className="min-w-0 truncate text-sm text-text-secondary">{row.label}</span>
                <span className="shrink-0 text-xs font-medium text-text-primary">
                  {row.value}
                </span>
              </li>
            ))}
            <li className="flex items-center justify-between gap-3 py-2.5">
              <span className="text-sm text-text-secondary">Build time</span>
              <span className="text-xs font-medium text-text-primary">
                {leadTimeDays} days · as quoted
              </span>
            </li>
          </ul>
        </Card>

        <Card>
          <CardHeader title="Order items" />
          <ul className="mt-4 flex flex-col gap-3">
            {items.map((item) => (
              <li key={item.name} className="flex items-start gap-3">
                <span
                  aria-hidden
                  className="h-11 w-11 shrink-0 rounded-lg bg-gradient-to-br from-bg-brand-subtle to-bg-brand-subtle"
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-text-primary">
                    {item.name}
                  </span>
                  <span className="block truncate text-xs text-text-tertiary">{item.detail}</span>
                </span>
                <Tag>{item.quantityNote}</Tag>
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <CardHeader
            title="Shipping"
            description="The manufacturer quoted standard shipping. Express is an IDEEZA upgrade."
            actions={
              <Link
                href={`/manufacturing/checkout/${orderId}/address`}
                className={buttonAppearance({ variant: 'secondary', size: 'sm' })}
              >
                Change address
              </Link>
            }
          />
          <div className="mt-4 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <RadioGroup legend="Shipping method">
              <Radio
                name="shipping"
                value="standard"
                label={`Standard — ${money(currency, quotedShippingMinor)}`}
                description="As quoted by the manufacturer."
                checked={choice === 'standard'}
                onChange={() => setChoice('standard')}
              />
              <Radio
                name="shipping"
                value="express"
                label={`Express — ${money(currency, quotedShippingMinor + expressSurchargeMinor)}`}
                description="Priority courier, arranged by IDEEZA."
                checked={choice === 'express'}
                onChange={() => setChoice('express')}
              />
            </RadioGroup>
            <div className="rounded-lg border border-border-subtle p-3 text-sm md:max-w-xs">
              <p className="text-xs font-semibold uppercase tracking-caps text-text-tertiary">
                Delivering to
              </p>
              <p className="mt-1 text-text-secondary">
                {deliveryAddress.line1}
                {deliveryAddress.line2 === null ? '' : `, ${deliveryAddress.line2}`}
                <br />
                {deliveryAddress.city}
                {deliveryAddress.region === null ? '' : `, ${deliveryAddress.region}`}{' '}
                {deliveryAddress.postalCode ?? ''}
                <br />
                {deliveryAddress.countryCode}
              </p>
            </div>
          </div>
        </Card>
      </div>

      <div className="lg:sticky lg:top-24 lg:self-start">
        <CheckoutSummary
          orderId={orderId}
          currency={currency}
          lines={lines}
          totalMinor={totalMinor}
          appliedCode={promo}
          appliedDescription={promoDescription}
          discountMinor={discountMinor}
          onPromoChange={(applied) => {
            setPromo(applied?.code ?? null);
            setDiscountMinor(applied?.discountMinor ?? 0);
            setPromoDescription(applied?.description ?? null);
          }}
          action={
            <Button size="lg" fullWidth onClick={goToPayment}>
              Continue to payment
            </Button>
          }
        />
      </div>
    </div>
  );
};
