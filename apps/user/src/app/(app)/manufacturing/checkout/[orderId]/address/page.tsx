import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { Card, PageHeader, Stepper, buttonAppearance } from '@ideeza/ui';
import { Crumbs } from '@/components/crumbs.js';
import { AddressForm } from '@/components/checkout/address-form.js';
import { getCheckout } from '@/data/checkout.js';
import { requireBuyer } from '@/lib/auth.js';
import { CHECKOUT_STEPS } from '@/lib/checkout-steps.js';
import { asId, type OrderId } from '@ideeza/domain';

export const dynamic = 'force-dynamic';

/** Changing where the order ships to, without leaving the checkout. */
const CheckoutAddressPage = async ({
  params,
}: {
  readonly params: Promise<{ readonly orderId: string }>;
}) => {
  const { orderId } = await params;
  const actor = await requireBuyer(`/manufacturing/checkout/${orderId}/address`);
  const checkout = await getCheckout(actor.userId, asId<OrderId>(orderId));
  if (checkout === null) notFound();
  if (checkout.status !== 'awaiting_payment') {
    redirect(`/manufacturing/orders/${orderId}`);
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Delivery address"
        description={`${checkout.productName} · ${checkout.quantity} units`}
        breadcrumbs={
          <Crumbs
            items={[
              { label: 'Manufacturing', href: '/manufacturing' },
              { label: 'Checkout', href: `/manufacturing/checkout/${orderId}` },
              { label: 'Address' },
            ]}
          />
        }
        actions={
          <Link
            href={`/manufacturing/checkout/${orderId}`}
            className={buttonAppearance({ variant: 'secondary' })}
          >
            Back to checkout
          </Link>
        }
      />

      <Card>
        <Stepper steps={CHECKOUT_STEPS} currentId="confirm" label="Checkout progress" />
      </Card>

      <AddressForm
        orderId={checkout.orderId}
        current={{
          line1: checkout.deliveryAddress.line1,
          line2: checkout.deliveryAddress.line2 ?? '',
          city: checkout.deliveryAddress.city,
          region: checkout.deliveryAddress.region ?? '',
          postalCode: checkout.deliveryAddress.postalCode ?? '',
          countryCode: checkout.deliveryAddress.countryCode,
        }}
        saved={checkout.savedAddresses}
      />
    </div>
  );
};

export default CheckoutAddressPage;
