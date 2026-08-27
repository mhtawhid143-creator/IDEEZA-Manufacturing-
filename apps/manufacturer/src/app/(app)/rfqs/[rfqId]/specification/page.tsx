import { notFound } from 'next/navigation';
import { Alert, Card, CardHeader, Text } from '@ideeza/ui';
import { OPEN_ANSWER, asId, type DocumentRow, type RfqId } from '@ideeza/domain';
import { RequestShell } from '@/components/request/request-shell.js';
import { getClientProfile } from '@/data/clients.js';
import { getRoutedRequest } from '@/data/rfqs.js';
import { requireManufacturer } from '@/lib/auth.js';

export const dynamic = 'force-dynamic';

/**
 * The label/value grid the design uses for a specification.
 *
 * Two pairs across on a wide screen, one on a phone. A row the buyer left open
 * is shown as open rather than blank, because a blank cell reads as "nothing
 * required" and this one means "your call".
 */
const SpecGrid = ({ rows }: { readonly rows: readonly DocumentRow[] }) => (
  <dl className="mt-4 grid grid-cols-1 overflow-hidden rounded-lg border border-line md:grid-cols-2">
    {rows.map((row, index) => (
      <div
        key={row.label}
        className={`grid grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] gap-3 border-b border-line px-3 py-2.5 md:[&:nth-last-child(-n+2)]:border-b-0 ${
          index % 2 === 0 ? 'md:border-r' : ''
        }`}
      >
        <dt className="text-sm text-muted">{row.label}</dt>
        <dd
          className={
            row.value === OPEN_ANSWER
              ? 'text-sm italic text-muted'
              : 'text-sm font-medium text-heading'
          }
        >
          {row.value}
        </dd>
      </div>
    ))}
  </dl>
);

/**
 * Production Specification: the boundary the quote is priced against.
 *
 * Every row here is read by `@ideeza/domain`, the same function the buyer's own
 * screens call. That is deliberate: if a dispute ever turns on what was
 * specified, there is one document and one wording of it, not one per panel.
 */
const SpecificationPage = async ({
  params,
}: {
  readonly params: Promise<{ readonly rfqId: string }>;
}) => {
  const { rfqId } = await params;
  const actor = await requireManufacturer(`/rfqs/${rfqId}/specification`);
  const request = await getRoutedRequest(actor.manufacturerId, asId<RfqId>(rfqId));
  if (request === null) notFound();
  const client = await getClientProfile(request.buyerId, actor.manufacturerId);

  return (
    <RequestShell request={request} client={client} activeTab="specification">
      <Card>
        <CardHeader
          title="Production requirement"
          description="What the buyer specified for the whole request."
        />
        <SpecGrid rows={request.requirementRows} />
      </Card>

      {request.hasBoard && (
        <Card>
          <CardHeader
            title={`${request.productName} — board specification`}
            description={
              request.boardSpecRows.length === 0
                ? 'The buyer left the whole board specification to the manufacturer.'
                : 'The fabrication detail, exactly as the buyer filled it in.'
            }
          />
          {request.boardSpecRows.length === 0 ? (
            <Alert
              tone="info"
              className="mt-4"
              title="No board specification was written"
            >
              Nothing about stack-up, finish or testing was specified. Quote it the
              way your line normally builds it, and say in the quote what you
              assumed.
            </Alert>
          ) : (
            <SpecGrid rows={request.boardSpecRows} />
          )}
        </Card>
      )}

      <Card tone="brand">
        <CardHeader title={`What “${OPEN_ANSWER}” means here`} />
        <Text size="sm" className="mt-2 block">
          A row left open is a decision the buyer handed to you. Price it your way,
          and state the choice in the quote so what you build is what they accepted.
        </Text>
      </Card>
    </RequestShell>
  );
};

export default SpecificationPage;
