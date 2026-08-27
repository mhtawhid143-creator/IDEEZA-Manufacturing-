import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { Alert, Card, PageHeader, Stepper, buttonAppearance } from '@ideeza/ui';
import { Crumbs } from '@/components/crumbs.js';
import { ConfirmStep } from '@/components/checkout/confirm-step.js';
import { EXPRESS_SURCHARGE_MINOR, getCheckout } from '@/data/checkout.js';
import { requireBuyer } from '@/lib/auth.js';
import { CHECKOUT_STEPS } from '@/lib/checkout-steps.js';
import { asId, type OrderId } from '@ideeza/domain';

export const dynamic = 'force-dynamic';

/**
 * Step one of the secured checkout.
 *
 * Everything priced here comes from the accepted quote's immutable snapshot, so
 * the buyer is confirming what was actually agreed rather than a fresh
 * calculation.
 */
const CheckoutPage = async ({
  params,
}: {
  readonly params: Promise<{ readonly orderId: string }>;
}) => {
  const { orderId } = await params;
  const actor = await requireBuyer(`/manufacturing/checkout/${orderId}`);
  const checkout = await getCheckout(actor.userId, asId<OrderId>(orderId));
  if (checkout === null) notFound();

  // An order that is already paid has nothing to check out.
  if (checkout.status !== 'awaiting_payment') {
    redirect(`/manufacturing/orders/${orderId}`);
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Secured checkout"
        description={`${checkout.productName} · ${checkout.quantity} units · ${checkout.manufacturerName}`}
        breadcrumbs={
          <Crumbs
            items={[
              { label: 'Manufacturing', href: '/manufacturing' },
              { label: 'Order', href: `/manufacturing/orders/${orderId}` },
              { label: 'Checkout' },
            ]}
          />
        }
        actions={
          <Link
            href={`/manufacturing/orders/${orderId}`}
            className={buttonAppearance({ variant: 'secondary' })}
          >
            Back to the order
          </Link>
        }
      />

      <Card>
        <Stepper steps={CHECKOUT_STEPS} currentId="confirm" label="Checkout progress" />
      </Card>

      <Alert tone="info" title="Paying is what confirms this order">
        IDEEZA holds the funds. Production may start once they are held, and the
        money reaches the manufacturer only against a documented order event —
        your delivery confirmation, an accepted inspection, or a resolved issue.
      </Alert>

      <ConfirmStep
        orderId={checkout.orderId}
        currency={checkout.currency}
        manufacturerName={checkout.manufacturerName}
        manufacturerPlace={`${checkout.manufacturerCity}, ${checkout.manufacturerCountry}`}
        productName={checkout.productName}
        quantity={checkout.quantity}
        leadTimeDays={checkout.leadTimeDays}
        includedServices={checkout.includedServices}
        specRows={checkout.specRows}
        items={checkout.items}
        goodsMinor={checkout.goodsMinor}
        toolingMinor={checkout.toolingMinor}
        quotedShippingMinor={checkout.quotedShippingMinor}
        expressSurchargeMinor={EXPRESS_SURCHARGE_MINOR}
        platformFeeMinor={checkout.platformFeeMinor}
        shippingChoice={checkout.shippingChoice}
        deliveryAddress={checkout.deliveryAddress}
      />
    </div>
  );
};

export default CheckoutPage;
