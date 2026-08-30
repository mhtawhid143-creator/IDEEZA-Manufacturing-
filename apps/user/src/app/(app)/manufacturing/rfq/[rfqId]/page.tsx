import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  Alert,
  Card,
  CardHeader,
  DefinitionList,
  Text,
  buttonAppearance,
} from '@ideeza/ui';
import { RequestRecipients } from '@/components/rfq/request-recipients.js';
import { RequestShell } from '@/components/rfq/request-shell.js';
import { major } from '@/components/rfq/quote-money.js';
import { listQuotes } from '@/data/quotes.js';
import { boardSpecRows, getBoardSpec } from '@/data/board-spec.js';
import { getRequest, listManufacturers } from '@/data/requests.js';
import { requireBuyer } from '@/lib/auth.js';
import { SERVICE_COPY, SERVICE_LIST } from '@/lib/rfq-copy.js';
import { asId, isOpenRequestStatus, type RfqId } from '@ideeza/domain';

export const dynamic = 'force-dynamic';

const day = (value: Date | null): string =>
  value === null ? '—' : value.toISOString().slice(0, 10);

const money = (minor: bigint | null, currency: string): string =>
  minor === null ? '—' : `${currency} ${(Number(minor) / 100).toFixed(2)}`;

/**
 * A request as it was sent: what went out, to whom, and where each recipient
 * has got to.
 *
 * Nothing here is editable. The requirements were locked when the request was
 * sent, which is what makes the quotes comparable.
 */
const RequestPage = async ({
  params,
  searchParams,
}: {
  readonly params: Promise<{ readonly rfqId: string }>;
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}) => {
  const { rfqId } = await params;
  const actor = await requireBuyer(`/manufacturing/rfq/${rfqId}`);
  const [request, boardSpec] = await Promise.all([
    getRequest(actor.userId, asId<RfqId>(rfqId)),
    getBoardSpec(actor.userId, asId<RfqId>(rfqId)),
  ]);

  if (request === null) notFound();

  const query = await searchParams;
  const justSent = query['sent'] === '1';

  const quotes = await listQuotes(actor.userId, asId<RfqId>(rfqId));
  const accepted = quotes.find((quote) => quote.status === 'accepted');
  const cheapest = quotes
    .filter((quote) => quote.status === 'submitted' || quote.status === 'revised')
    .reduce<(typeof quotes)[number] | null>(
      (best, quote) =>
        best === null || quote.totalPriceMinor < best.totalPriceMinor ? quote : best,
      null,
    );

  // Who else could take this request, for "send another quote".
  const others = await listManufacturers({
    requestedServices: request.requestedServices,
    quantity: request.quantity,
    leadTimeDays: request.leadTimeDays,
  });
  const alreadySent = new Set(request.recipients.map((recipient) => recipient.manufacturerId));
  const available = others
    .filter((manufacturer) => !alreadySent.has(manufacturer.id))
    .map((manufacturer) => ({
      id: manufacturer.id,
      displayName: manufacturer.displayName,
      city: manufacturer.city,
      countryCode: manufacturer.countryCode,
      blocked: manufacturer.fit?.verdict === 'cannot',
      blockedReason:
        manufacturer.fit?.belowMinimumOrderQuantity === true
          ? 'Minimum order quantity is above this request'
          : `Does not publish ${(manufacturer.fit?.missingServices ?? [])
              .map((service) => SERVICE_COPY[service].label)
              .join(', ')}`,
    }));

  return (
    <RequestShell
      request={request}
      activeTab="all"
      counts={{
        all: request.recipientCount,
        quotes: quotes.length,
        accepted: accepted === undefined ? 0 : 1,
      }}
    >
      <div className="flex flex-col gap-6">
        {justSent && (
          <Alert
            tone="success"
            title={`Sent to ${request.recipientCount} ${request.recipientCount === 1 ? 'manufacturer' : 'manufacturers'}`}
          >
            Each one answers with its own quote, or declines. Accepting a quote later
            opens an order awaiting payment; the order is confirmed once the payment is
            secured.
          </Alert>
        )}

        {accepted !== undefined && (
          <Alert tone="success" title={`${accepted.manufacturerName}'s quote is accepted`}>
            The request is closed and the order opened awaiting payment.{' '}
            {accepted.orderId !== null && (
              <Link
                href={`/manufacturing/orders/${accepted.orderId}`}
                className="font-semibold underline"
              >
                Go to the order
              </Link>
            )}
          </Alert>
        )}

        {accepted === undefined && quotes.length > 0 && (
          <Alert
            tone="info"
            title={`${quotes.length} ${quotes.length === 1 ? 'quote has' : 'quotes have'} arrived`}
            actions={
              <Link
                href={`/manufacturing/rfq/${request.rfqId}/quotes`}
                className={buttonAppearance({ variant: 'secondary', size: 'sm' })}
              >
                Read the quotes
              </Link>
            }
          >
            {cheapest === null
              ? 'Open the quotes to read their terms.'
              : `The lowest is ${cheapest.currency} ${major(cheapest.totalPriceMinor)} from ${cheapest.manufacturerName}, ${cheapest.leadTimeDays} days.`}
          </Alert>
        )}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
          <div className="flex flex-col gap-6">
            <RequestRecipients
              rfqId={request.rfqId}
              open={isOpenRequestStatus(request.status)}
              recipients={request.recipients.map((recipient) => ({
                manufacturerId: recipient.manufacturerId,
                manufacturerName: recipient.manufacturerName,
                city: recipient.city,
                countryCode: recipient.countryCode,
                rating: recipient.rating,
                status: recipient.status,
                viewedAt: recipient.viewedAt === null ? null : day(recipient.viewedAt),
                quotedAt: recipient.quotedAt === null ? null : day(recipient.quotedAt),
                declinedAt: recipient.declinedAt === null ? null : day(recipient.declinedAt),
                declineReason: recipient.declineReason,
              }))}
              available={available}
            />
          </div>

          <div className="flex flex-col gap-6">
            <Card>
              <CardHeader title="What was sent" />
              <DefinitionList
                className="mt-4"
                items={[
                  { label: 'Sent', value: day(request.submittedAt) },
                  { label: 'Quoting', value: SERVICE_LIST(request.requestedServices) },
                  { label: 'Quantity', value: String(request.quantity) },
                  {
                    label: 'Volume tiers',
                    value:
                      request.volumeTiers.length === 0 ? '—' : request.volumeTiers.join(', '),
                  },
                  {
                    label: 'Target price per unit',
                    value: money(request.targetPriceMinor, request.currency),
                  },
                  { label: 'Needed by', value: day(request.neededBy) },
                  { label: 'Quotes needed by', value: day(request.responseDeadline) },
                  { label: 'BOM lines sent', value: String(request.itemCount) },
                  { label: 'Files sent', value: String(request.fileCount) },
                ]}
              />
            </Card>

            <Card>
              <CardHeader
                title="Locked requirements"
                description="Frozen when the request was sent, so every quote answers the same question."
              />
              <DefinitionList
                className="mt-4"
                items={[
                  ...request.requirementRows,
                  { label: 'Locked at', value: day(request.requirementsLockedAt) },
                ]}
              />
              {boardSpec !== null && boardSpec.hasBoard && (
                <div className="mt-5 border-t border-border-subtle pt-4">
                  <p className="text-sm font-semibold text-text-primary">
                    Board specification
                  </p>
                  <Text tone="muted" size="xs" className="mt-0.5">
                    Sent with the request. Every quote answers this exact document.
                  </Text>
                  <DefinitionList
                    className="mt-3"
                    columns={2}
                    items={boardSpecRows(boardSpec).map((row) => ({
                      label: row.label,
                      value: row.value,
                    }))}
                  />
                </div>
              )}

              {request.notes !== null && (
                <Text tone="muted" size="xs" className="mt-3">
                  Notes: {request.notes}
                </Text>
              )}
            </Card>

            <Card>
              <CardHeader title="Delivering to" />
              <Text size="sm" className="mt-3">
                {request.deliveryAddress.line1}
                {request.deliveryAddress.line2 === null
                  ? ''
                  : `, ${request.deliveryAddress.line2}`}
                <br />
                {request.deliveryAddress.city}
                {request.deliveryAddress.region === null
                  ? ''
                  : `, ${request.deliveryAddress.region}`}{' '}
                {request.deliveryAddress.postalCode ?? ''}
                <br />
                {request.deliveryAddress.countryCode}
              </Text>
            </Card>
          </div>
        </div>
      </div>
    </RequestShell>
  );
};

export default RequestPage;
