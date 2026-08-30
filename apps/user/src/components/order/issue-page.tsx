import Link from 'next/link';
import type { ReactNode } from 'react';
import {
  Alert,
  Card,
  CardHeader,
  DefinitionList,
  PageHeader,
  StatusChip,
  Text,
  buttonAppearance,
} from '@ideeza/ui';
import { IssueForm, type IssueKind } from './issue-form.js';
import { Crumbs } from '@/components/crumbs.js';
import { major } from '@/components/rfq/quote-money.js';
import type { IssueContext } from '@/data/resolution.js';

export interface IssuePageProps {
  readonly kind: IssueKind;
  readonly title: string;
  readonly context: IssueContext;
  readonly blockedReason: string | null;
  readonly reasons: readonly { readonly value: string; readonly label: string }[];
  readonly submitLabel: string;
  /** What raising this does, stated before the form. */
  readonly consequences: readonly string[];
  readonly withAmount: boolean;
  readonly withRecords: boolean;
  readonly aside?: ReactNode;
  readonly refundId?: string | undefined;
}

/**
 * The frame the three issue screens share.
 *
 * The design puts each of these in a modal over the order list. They are given
 * their own route instead: each one changes what happens to money, each has to
 * be linkable from a notification or a message, and each needs room to say what
 * it does before the buyer commits to it. The form inside is the design's.
 */
export const IssuePage = ({
  kind,
  title,
  context,
  blockedReason,
  reasons,
  submitLabel,
  consequences,
  withAmount,
  withRecords,
  aside,
  refundId,
}: IssuePageProps) => {
  const orderId = String(context.orderId);
  const held = `${context.currency} ${major(BigInt(context.heldMinor))}`;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={title}
        description={`${context.productName} · ${context.quantity} units · ${context.manufacturerName}`}
        breadcrumbs={
          <Crumbs
            items={[
              { label: 'Manufacturing', href: '/manufacturing' },
              { label: 'Active Orders', href: '/manufacturing/orders' },
              { label: 'Order', href: `/manufacturing/orders/${orderId}` },
              { label: title },
            ]}
          />
        }
        actions={<StatusChip status={context.status} withDot />}
      />

      {blockedReason !== null && (
        <Alert
          tone="info"
          title="This is not the right instrument for this order"
          actions={
            <Link
              href={`/manufacturing/orders/${orderId}`}
              className={buttonAppearance({ variant: 'secondary' })}
            >
              Back to the order
            </Link>
          }
        >
          {blockedReason}
        </Alert>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader
              title={title}
              description={
                kind === 'cancel'
                  ? context.cancellationRoute === 'withdraw'
                    ? 'Nothing is being made and no money is held, so this closes the order straight away.'
                    : 'Production has started, so this is a request IDEEZA decides.'
                  : 'What you write here is the record the decision is made on.'
              }
            />
            {blockedReason === null ? (
              <div className="mt-4">
                <IssueForm
                  kind={kind}
                  orderId={orderId}
                  currency={context.currency}
                  paidMinor={context.paidMinor}
                  moneyReleased={context.moneyReleased}
                  reasons={reasons}
                  attachable={context.attachable}
                  withAmount={withAmount}
                  withRecords={withRecords}
                  submitLabel={submitLabel}
                  refundId={refundId}
                />
              </div>
            ) : (
              <Text tone="muted" size="sm" className="mt-3">
                The form is not shown because the rule above would refuse it.
              </Text>
            )}
          </Card>

          {aside}
        </div>

        <div className="flex flex-col gap-6">
          <Card tone="brand">
            <CardHeader title="What this does" />
            <ol className="mt-3 flex flex-col gap-2">
              {consequences.map((line, index) => (
                <li key={line} className="max-w-measure flex gap-2 text-sm text-text-secondary">
                  <span
                    aria-hidden
                    className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-bg-brand-subtle text-[11px] font-semibold text-text-brand"
                  >
                    {index + 1}
                  </span>
                  {line}
                </li>
              ))}
            </ol>
          </Card>

          <Card>
            <CardHeader title="The order" />
            <DefinitionList
              className="mt-3"
              items={[
                {
                  label: 'Held by IDEEZA',
                  value: context.fundsHeld
                    ? held
                    : context.moneyReleased
                      ? 'Already released to the manufacturer'
                      : 'Nothing yet',
                },
                { label: 'Paid', value: `${context.currency} ${major(BigInt(context.paidMinor))}` },
                { label: 'Manufacturer', value: context.manufacturerName },
                { label: 'Units', value: String(context.quantity) },
                {
                  label: 'Open refund',
                  value:
                    context.openRefund === null
                      ? 'None'
                      : `${context.openRefund.status.replace(/_/g, ' ')} · ${context.currency} ${major(BigInt(context.openRefund.requestedMinor))}`,
                },
                {
                  label: 'Open dispute',
                  value:
                    context.openDispute === null
                      ? 'None'
                      : context.openDispute.status.replace(/_/g, ' '),
                },
              ]}
            />
          </Card>

          <Card>
            <CardHeader title="The other instruments" />
            <div className="mt-3 flex flex-col gap-2">
              {kind !== 'cancel' && (
                <Link
                  href={`/manufacturing/orders/${orderId}/cancel`}
                  className={buttonAppearance({ variant: 'secondary', size: 'sm' })}
                >
                  Cancel the order
                </Link>
              )}
              {kind !== 'refund' && (
                <Link
                  href={`/manufacturing/orders/${orderId}/refund`}
                  className={buttonAppearance({ variant: 'secondary', size: 'sm' })}
                >
                  Request a refund
                </Link>
              )}
              {kind !== 'dispute' && (
                <Link
                  href={`/manufacturing/orders/${orderId}/dispute`}
                  className={buttonAppearance({ variant: 'secondary', size: 'sm' })}
                >
                  Open a dispute
                </Link>
              )}
              <Link
                href={`/manufacturing/orders/${orderId}/records`}
                className={buttonAppearance({ variant: 'ghost', size: 'sm' })}
              >
                The order record
              </Link>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};
