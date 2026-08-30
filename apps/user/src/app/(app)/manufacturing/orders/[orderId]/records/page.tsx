import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  Card,
  CardHeader,
  EmptyState,
  PageHeader,
  StatusChip,
  Tag,
  Text,
  buttonAppearance,
} from '@ideeza/ui';
import { Crumbs } from '@/components/crumbs.js';
import { day } from '@/components/rfq/quote-money.js';
import { getOrder } from '@/data/orders.js';
import { getProduction } from '@/data/production.js';
import { requireBuyer } from '@/lib/auth.js';
import { asId, type OrderId } from '@ideeza/domain';

export const dynamic = 'force-dynamic';

const KIND_LABEL: Readonly<Record<string, string>> = {
  accepted_quote: 'Accepted quote',
  order_terms: 'Order terms',
  design_file: 'Design file',
  bom_revision: 'BOM revision',
  approved_substitution: 'Approved replacement',
  change_order: 'Change during production',
  quality_report: 'Quality report',
  measurement_data: 'Measurement data',
  photo: 'Photo',
  shipping_record: 'Shipping record',
  delivery_record: 'Delivery record',
  buyer_statement: 'Your statement',
  manufacturer_statement: 'Manufacturer statement',
};

const STAGE_LABEL: Readonly<Record<string, string>> = {
  quote_accepted: 'Quote accepted',
  payment_secured: 'Payment secured',
  files_under_review: 'Files under review',
  materials_confirmed: 'Materials confirmed',
  in_production: 'In production',
  quality_check: 'Quality check',
  ready_to_ship: 'Ready to ship',
  shipped: 'Shipped',
  delivered: 'Delivered',
  completed: 'Completed',
};

/**
 * The documented record of one order.
 *
 * This is the evidence a refund or a dispute is decided on: quality reports,
 * photographs, shipping and delivery records, and every change agreed during
 * production. It is read-only for the buyer — a record that could be edited
 * afterwards would be worth nothing.
 */
const RecordsPage = async ({
  params,
}: {
  readonly params: Promise<{ readonly orderId: string }>;
}) => {
  const { orderId } = await params;
  const actor = await requireBuyer(`/manufacturing/orders/${orderId}/records`);
  const id = asId<OrderId>(orderId);

  const [order, production] = await Promise.all([
    getOrder(actor.userId, id),
    getProduction(actor.userId, id),
  ]);
  if (order === null || production === null) notFound();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Order records"
        description={`${order.productName} · ${production.evidence.length} record${
          production.evidence.length === 1 ? '' : 's'
        }`}
        breadcrumbs={
          <Crumbs
            items={[
              { label: 'Manufacturing', href: '/manufacturing' },
              { label: 'Active Orders', href: '/manufacturing/orders' },
              { label: 'Order', href: `/manufacturing/orders/${orderId}` },
              { label: 'Records' },
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
        <CardHeader
          title="The record"
          description="Captured as things happened, by whoever was responsible for them. Nothing here can be edited."
        />
        {production.evidence.length === 0 ? (
          <div className="mt-4">
            <EmptyState
              title="Nothing recorded yet"
              description="Records arrive as production moves: the accepted terms, quality reports at the quality check, then the shipping and delivery records."
            />
          </div>
        ) : (
          <ul aria-label="Order records" className="mt-4 flex flex-col gap-3">
            {production.evidence.map((record) => (
              <li
                key={record.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border-subtle p-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-text-primary">{record.title}</p>
                  <Text tone="muted" size="xs" className="mt-0.5">
                    {KIND_LABEL[record.kind] ?? record.kind.replace(/_/g, ' ')} ·{' '}
                    {record.contextKind}
                    {record.stageKey === null
                      ? ''
                      : ` · ${STAGE_LABEL[record.stageKey] ?? record.stageKey}`}
                    {record.fileName === null ? '' : ` · ${record.fileName}`}
                  </Text>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Tag tone="neutral">{day(record.capturedAt)}</Tag>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <CardHeader
          title="Where the record comes from"
          description="Each stage can carry its own evidence, so a report is tied to the moment it was produced."
        />
        <ul aria-label="Records per stage" className="mt-4 flex flex-col gap-2">
          {production.stages.map((stage) => (
            <li
              key={stage.id}
              className="flex flex-col gap-1 text-sm sm:flex-row sm:items-center sm:justify-between sm:gap-3"
            >
              <span className="min-w-0 text-text-secondary">{stage.label}</span>
              <span className="flex shrink-0 items-center gap-2">
                <Text tone="muted" size="xs">
                  {stage.evidenceCount} record{stage.evidenceCount === 1 ? '' : 's'}
                </Text>
                <StatusChip status={stage.status} />
              </span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
};

export default RecordsPage;
