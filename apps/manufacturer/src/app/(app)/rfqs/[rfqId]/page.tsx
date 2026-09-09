import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Card, CardHeader, DefinitionList, Tag, Text } from '@ideeza/ui';
import {
  asId,
  briefRows,
  counted,
  requestReference,
  type RfqId,
} from '@ideeza/domain';
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
              {/*
                The kind of work, in the portal's one name for it (UIUX-144).
                This tag said "3D" while the field below it said "3D module" and
                the inbox said something else again.
              */}
              {request.hasBoard && <Tag tone="brand">PCB</Tag>}
              {request.hasPrintedPart && <Tag tone="brand">3D printing</Tag>}
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
            // The reference either side can quote, not the internal row id
            // (UIUX-138). The dashboard and the case records already read it
            // from the same helper.
            { label: 'RFQ ID', value: requestReference(request.rfqId) },
            { label: 'Product', value: request.productName },
            { label: 'Manufacturing type', value: request.kindLabel },
            {
              label: 'To be quoted',
              value:
                request.serviceLabels.length === 0
                  ? 'Not stated'
                  : request.serviceLabels.join(', '),
            },
            { label: 'Quantity', value: counted(request.quantity, 'unit') },
            {
              label: 'Also price for',
              value:
                request.volumeTiers.length === 0
                  ? 'This volume only'
                  : request.volumeTiers.map((tier) => counted(tier, 'unit')).join(', '),
            },
            // A bill of materials is a fact about assembly work. A print-only
            // request has none, and a row reading "0" invites the shop to
            // wonder what it is missing (UIUX-142).
            ...(request.bomLines.length === 0
              ? []
              : [
                  {
                    label: 'BOM lines',
                    value: counted(request.bomLines.length, 'line'),
                  },
                ]),
            {
              label: 'Attached files',
              value:
                request.files.length === 0 ? (
                  'None attached'
                ) : (
                  // The count is the way to the files (UIUX-139). It was static
                  // text beside a tab the shop had to notice for itself.
                  <Link
                    href={`/rfqs/${request.rfqId}/files`}
                    className="font-medium text-text-link underline decoration-border-strong underline-offset-2 hover:text-text-brand focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus"
                  >
                    {counted(request.files.length, 'file')}
                  </Link>
                ),
            },
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
