import { notFound } from 'next/navigation';
import { Card, CardHeader, DefinitionList, Tag, Text } from '@ideeza/ui';
import { asId, briefRows, type RfqId } from '@ideeza/domain';
import { RequestShell } from '@/components/request/request-shell.js';
import { getClientProfile } from '@/data/clients.js';
import { getRoutedRequest, markRequestViewed } from '@/data/rfqs.js';
import { requireManufacturer } from '@/lib/auth.js';

export const dynamic = 'force-dynamic';

const day = (value: Date | null): string =>
  value === null ? '—' : value.toISOString().slice(0, 10);

/**
 * Brief: what is being asked for, and whether it is worth quoting.
 *
 * Opening this is what tells the buyer their request is being looked at, so the
 * routing record is marked viewed here and nowhere else — the buyer's activity
 * screen reads it, and "opened" has to mean a person actually opened it.
 *
 * The design carries one requirement card per kind of work. One request holds one
 * written brief in this domain, so there is one card, and the kinds of work it
 * covers are chips on it rather than duplicated text.
 */
const BriefPage = async ({
  params,
}: {
  readonly params: Promise<{ readonly rfqId: string }>;
}) => {
  const { rfqId } = await params;
  const actor = await requireManufacturer(`/rfqs/${rfqId}`);
  const id = asId<RfqId>(rfqId);

  const request = await getRoutedRequest(actor.manufacturerId, id);
  if (request === null) notFound();

  await markRequestViewed(actor.manufacturerId, id);
  const client = await getClientProfile(request.buyerId, actor.manufacturerId);

  const brief = briefRows(request.requirementRows);

  return (
    <RequestShell request={request} client={client} activeTab="brief">
      <Card>
        <CardHeader
          title="Production requirement"
          actions={
            <div className="flex flex-wrap gap-2">
              {request.hasBoard && <Tag tone="brand">PCB</Tag>}
              {request.hasPrintedPart && <Tag tone="brand">3D</Tag>}
              {!request.hasBoard && !request.hasPrintedPart && (
                <Tag tone="neutral">No production files attached</Tag>
              )}
            </div>
          }
        />
        <DefinitionList className="mt-4" columns={2} items={brief} />
        {request.notes !== null && request.notes !== '' && (
          <div className="mt-4 border-t border-border-subtle pt-4">
            <Text tone="muted" size="xs" className="block">
              From the buyer
            </Text>
            <Text size="sm" className="mt-1 block whitespace-pre-line">
              {request.notes}
            </Text>
          </div>
        )}
      </Card>

      <Card>
        <CardHeader title="General information" />
        <DefinitionList
          className="mt-4"
          columns={2}
          items={[
            { label: 'RFQ ID', value: request.rfqId },
            { label: 'Product', value: request.productName },
            { label: 'Manufacturing type', value: request.kindLabel },
            {
              label: 'To be quoted',
              value:
                request.serviceLabels.length === 0
                  ? 'Not stated'
                  : request.serviceLabels.join(', '),
            },
            { label: 'Quantity', value: `${request.quantity} units` },
            {
              label: 'Also price for',
              value:
                request.volumeTiers.length === 0
                  ? 'This volume only'
                  : request.volumeTiers.map((tier) => `${tier} units`).join(', '),
            },
            { label: 'BOM lines', value: String(request.bomLines.length) },
            { label: 'Attached files', value: String(request.files.length) },
            { label: 'Received', value: day(request.receivedAt) },
            { label: 'Reply by', value: day(request.respondBy) },
            { label: 'Wanted by', value: day(request.neededBy) },
            {
              label: 'Ship to',
              value: `${request.shipTo.city}${
                request.shipTo.region === null ? '' : `, ${request.shipTo.region}`
              }, ${request.shipTo.countryCode}`,
            },
          ]}
        />
        <Text tone="muted" size="xs" className="mt-4 block">
          Requirements were frozen{' '}
          {request.requirementsLockedAt === null
            ? 'not yet — the buyer can still change them'
            : `on ${day(request.requirementsLockedAt)}, so what you quote against cannot move under you`}
          .
        </Text>
      </Card>
    </RequestShell>
  );
};

export default BriefPage;
