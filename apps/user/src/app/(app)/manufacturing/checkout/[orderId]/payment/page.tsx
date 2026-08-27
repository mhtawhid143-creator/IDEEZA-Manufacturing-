import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { Card, PageHeader, Stepper, buttonAppearance } from '@ideeza/ui';
import { Crumbs } from '@/components/crumbs.js';
import { PaymentStep } from '@/components/checkout/payment-step.js';
import { getCheckout } from '@/data/checkout.js';
import { requireBuyer } from '@/lib/auth.js';
import { CHECKOUT_STEPS } from '@/lib/checkout-steps.js';
import { asId, type OrderId, type ShippingChoice } from '@ideeza/domain';

export const dynamic = 'force-dynamic';

/**
 * Step two: paying, which is what confirms the order.
 *
 * The shipping choice and any coupon travel in the query string, so a reload or
 * a back-and-forward keeps what the buyer picked on the first step.
 */
const CheckoutPaymentPage = async ({
  params,
  searchParams,
}: {
  readonly params: Promise<{ readonly orderId: string }>;
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}) => {
  const { orderId } = await params;
  const actor = await requireBuyer(`/manufacturing/checkout/${orderId}/payment`);
  const query = await searchParams;
  const shipping = query['shipping'] === 'express' ? 'express' : 'standard';
  const promo = typeof query['promo'] === 'string' ? query['promo'] : undefined;

  const checkout = await getCheckout(actor.userId, asId<OrderId>(orderId), {
    shippingChoice: shipping as ShippingChoice,
    promoCode: promo,
  });
  if (checkout === null) notFound();
  if (checkout.status !== 'awaiting_payment') {
    redirect(`/manufacturing/orders/${orderId}`);
  }

  const lines = [
    { label: `Units (${checkout.quantity})`, amountMinor: checkout.goodsMinor },
    ...(checkout.toolingMinor > 0
      ? [{ label: 'Tooling and setup', amountMinor: checkout.toolingMinor }]
      : []),
    {
      label: 'Shipping',
      amountMinor: checkout.shippingMinor,
      note: checkout.shippingChoice === 'express' ? 'Express' : 'Standard, as quoted',
    },
    {
      label: 'Platform fee',
      amountMinor: checkout.platformFeeMinor,
      note: '3% of the goods',
    },
    ...(checkout.discountMinor > 0
      ? [
          {
            label: checkout.promoCode ?? 'Discount',
            amountMinor: -checkout.discountMinor,
          },
        ]
      : []),
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Payment"
        description={`${checkout.productName} · ${checkout.manufacturerName}`}
        breadcrumbs={
          <Crumbs
            items={[
              { label: 'Manufacturing', href: '/manufacturing' },
              { label: 'Checkout', href: `/manufacturing/checkout/${orderId}` },
              { label: 'Payment' },
            ]}
          />
        }
        actions={
          <Link
            href={`/manufacturing/checkout/${orderId}`}
            className={buttonAppearance({ variant: 'secondary' })}
          >
            Back to confirm
          </Link>
        }
      />

      <Card>
        <Stepper steps={CHECKOUT_STEPS} currentId="payment" label="Checkout progress" />
      </Card>

      <PaymentStep
        orderId={checkout.orderId}
        currency={checkout.currency}
        shippingChoice={checkout.shippingChoice}
        lines={lines}
        totalMinor={checkout.totalMinor}
        promoCode={checkout.promoCode}
        promoDescription={checkout.promoDescription}
        discountMinor={checkout.discountMinor}
        manufacturerName={checkout.manufacturerName}
        quantity={checkout.quantity}
        productName={checkout.productName}
      />
    </div>
  );
};

export default CheckoutPaymentPage;
