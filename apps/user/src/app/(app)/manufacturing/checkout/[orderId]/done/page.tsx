import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  Alert,
  Card,
  CardHeader,
  DefinitionList,
  Heading,
  PageHeader,
  Stepper,
  StatusChip,
  Text,
  buttonAppearance,
  majorAmount,
} from '@ideeza/ui';
import { Crumbs } from '@/components/crumbs.js';
import { getCheckout } from '@/data/checkout.js';
import { requireBuyer } from '@/lib/auth.js';
import { CHECKOUT_STEPS } from '@/lib/checkout-steps.js';
import { asId, type OrderId } from '@ideeza/domain';

export const dynamic = 'force-dynamic';

const money = (currency: string, minor: number): string =>
  `${currency} ${majorAmount(minor)}`;

const METHOD_LABEL: Readonly<Record<string, string>> = {
  card: 'Card',
  paypal: 'PayPal',
  stablecoin: 'USDT',
  platform_token: 'IDZ',
  bank: 'Bank transfer',
};

/**
 * Step three: what happened.
 *
 * Both outcomes are real records. A payment that was refused is a payment row
 * with a reason on it, and the buyer can try again; a secured one has already
 * confirmed the order.
 */
const CheckoutDonePage = async ({
  params,
}: {
  readonly params: Promise<{ readonly orderId: string }>;
}) => {
  const { orderId } = await params;
  const actor = await requireBuyer(`/manufacturing/checkout/${orderId}/done`);
  const checkout = await getCheckout(actor.userId, asId<OrderId>(orderId));
  if (checkout === null) notFound();

  const payment = checkout.payment;
  const secured = payment !== null && payment.status !== 'initiated';

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={secured ? 'Payment secured' : 'Payment not taken'}
        description={`${checkout.productName} · ${checkout.quantity} units · ${checkout.manufacturerName}`}
        breadcrumbs={
          <Crumbs
            items={[
              { label: 'Manufacturing', href: '/manufacturing' },
              { label: 'Checkout', href: `/manufacturing/checkout/${orderId}` },
              { label: secured ? 'Done' : 'Failed' },
            ]}
          />
        }
        actions={<StatusChip status={checkout.status} withDot />}
      />

      <Card>
        <Stepper steps={CHECKOUT_STEPS} currentId="done" label="Checkout progress" />
      </Card>

      {secured ? (
        <Alert tone="success" title="IDEEZA is holding the funds">
          The order is confirmed and {checkout.manufacturerName} can start. The money
          reaches them only against a documented order event — your delivery
          confirmation, an accepted inspection, or a resolved issue.
        </Alert>
      ) : (
        <Alert tone="danger" title="Nothing was taken">
          {payment?.failureReason ?? 'The payment was not completed.'} The order is
          still waiting for payment, and nothing has been sent to the manufacturer.
        </Alert>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader
            title={secured ? 'Receipt' : 'What was attempted'}
            description={
              secured
                ? 'Kept against the order, with the accepted terms it was paid on.'
                : 'Recorded so you can see what happened, and try again.'
            }
          />
          <DefinitionList
            className="mt-4"
            columns={2}
            items={[
              { label: 'Order', value: checkout.orderId },
              { label: 'Payment', value: payment?.id ?? '—' },
              {
                label: 'Method',
                value:
                  payment === null ? '—' : (METHOD_LABEL[payment.method] ?? payment.method),
              },
              { label: 'State', value: payment?.status ?? 'not started' },
              {
                label: 'Held',
                value:
                  payment === null
                    ? '—'
                    : money(checkout.currency, payment.totalChargedMinor),
              },
              {
                label: 'Secured at',
                value:
                  payment?.securedAt === null || payment?.securedAt === undefined
                    ? '—'
                    : payment.securedAt.toISOString().slice(0, 16).replace('T', ' '),
              },
              { label: 'Units', value: `${checkout.quantity}` },
              { label: 'Build time', value: `${checkout.leadTimeDays} days, as quoted` },
            ]}
          />
        </Card>

        <div className="flex flex-col gap-4">
          <Card tone="brand">
            <Heading level={3}>{secured ? 'What happens next' : 'What you can do'}</Heading>
            <ol className="mt-3 flex flex-col gap-2 text-sm text-text-secondary">
              {(secured
                ? [
                    'The manufacturer reviews your files and confirms materials.',
                    'Production runs through the ten tracked stages.',
                    'Quality check evidence is attached to the order.',
                    'You confirm delivery, which releases the money.',
                  ]
                : [
                    'Check the details and try the payment again.',
                    'Or pay another way — card, PayPal, USDT, IDZ or bank transfer.',
                    'The accepted quote stays valid; nothing was lost.',
                  ]
              ).map((step, index) => (
                <li key={step} className="flex gap-2">
                  <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-bg-brand-subtle text-2xs font-semibold text-text-brand">
                    {index + 1}
                  </span>
                  {step}
                </li>
              ))}
            </ol>
          </Card>

          <div className="flex flex-col gap-2">
            {secured ? (
              <>
                <Link
                  href={`/manufacturing/orders/${orderId}`}
                  className={buttonAppearance({ fullWidth: true })}
                >
                  Track the order
                </Link>
                <Link
                  href="/manufacturing/orders"
                  className={buttonAppearance({ variant: 'secondary', fullWidth: true })}
                >
                  All active orders
                </Link>
              </>
            ) : (
              <>
                <Link
                  href={`/manufacturing/checkout/${orderId}/payment`}
                  className={buttonAppearance({ fullWidth: true })}
                >
                  Try the payment again
                </Link>
                <Link
                  href={`/manufacturing/orders/${orderId}`}
                  className={buttonAppearance({ variant: 'secondary', fullWidth: true })}
                >
                  Back to the order
                </Link>
              </>
            )}
          </div>

          <Text tone="muted" size="xs">
            No payment provider is connected in this build: the amount is recorded
            as held by the platform rather than charged. Wiring a provider is part
            of the deployment work.
          </Text>
        </div>
      </div>
    </div>
  );
};

export default CheckoutDonePage;
