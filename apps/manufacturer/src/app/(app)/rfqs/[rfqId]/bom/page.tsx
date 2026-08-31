import { notFound } from 'next/navigation';
import { Card, CardHeader, EmptyState, Tag, Text, Tooltip } from '@ideeza/ui';
import {
  SUBSTITUTION_POLICY_LABEL,
  asId,
  type CoverageState,
  type RfqId,
} from '@ideeza/domain';
import { MissingParts, type ShortLine } from '@/components/request/missing-parts.js';
import { RequestShell } from '@/components/request/request-shell.js';
import { getClientProfile } from '@/data/clients.js';
import { getRoutedRequest } from '@/data/rfqs.js';
import { matchRequestAgainstInventory } from '@/data/inventory-match.js';
import { requireManufacturer } from '@/lib/auth.js';

export const dynamic = 'force-dynamic';

const major = (minor: number): string =>
  `${minor < 0 ? '-' : ''}${(Math.abs(minor) / 100).toFixed(2)}`;

/**
 * What a substitute does to the price and the date, in words.
 *
 * The buyer reads the same two numbers on the quote, so they are stated here
 * rather than left inside the modal where the shop chose the part.
 */
const impactWords = (
  priceImpactMinor: number,
  leadTimeImpactDays: number,
  currency: string,
): string =>
  `${
    priceImpactMinor === 0
      ? 'no price change on record'
      : `${priceImpactMinor > 0 ? 'adds' : 'saves'} ${currency} ${major(
          Math.abs(priceImpactMinor),
        )}`
  } · ${
    leadTimeImpactDays === 0 ? 'no extra days' : `${leadTimeImpactDays} extra days`
  }`;

const COVERAGE_WORDS: Readonly<Record<CoverageState, string>> = {
  covered: 'In stock',
  short: 'Short',
  missing: 'Not stocked',
};

const COVERAGE_TONE: Readonly<Record<CoverageState, 'success' | 'warning' | 'danger'>> = {
  covered: 'success',
  short: 'warning',
  missing: 'danger',
};

/**
 * BOM / Parts: the lines this request has to be built from, against what the shop
 * actually holds.
 *
 * The design's table has a footprint column and a part-manufacturer column. The
 * record holds neither: a line is a reference, a component name, a manufacturer
 * part number and a quantity. The part number is what identifies a part
 * unambiguously, so it takes the place of both rather than a column of guesses.
 *
 * The stock column is the point of this stage. Matching is by SKU against this
 * shop's own inventory, availability is what is not already promised to another
 * order, and a line the shop cannot cover is one the buyer has to hear about
 * before the quote — not after the order.
 */
const BomPage = async ({
  params,
}: {
  readonly params: Promise<{ readonly rfqId: string }>;
}) => {
  const { rfqId } = await params;
  const actor = await requireManufacturer(`/rfqs/${rfqId}/bom`);
  const id = asId<RfqId>(rfqId);

  const request = await getRoutedRequest(actor.manufacturerId, id);
  if (request === null) notFound();
  const [client, match] = await Promise.all([
    getClientProfile(request.buyerId, actor.manufacturerId),
    matchRequestAgainstInventory(actor.manufacturerId, id),
  ]);

  const totalParts = request.bomLines.reduce(
    (total, line) => total + line.quantityRequired,
    0,
  );

  const byItemId = new Map((match?.lines ?? []).map((line) => [line.rfqItemId, line]));

  const policy = request.requirementRows.find((row) => row.label === 'Substitutions');
  const policySentence =
    policy === undefined
      ? 'The substitution policy is on the specification tab.'
      : `${policy.value}.`;

  const shortLines: readonly ShortLine[] = (match?.shortLines ?? []).map((line) => ({
    rfqItemId: line.rfqItemId,
    reference: line.reference,
    componentName: line.componentName,
    sku: line.sku,
    requiredTotal: line.requiredTotal,
    coverage: line.coverage === 'missing' ? 'missing' : 'short',
    shortfall: line.shortfall,
    candidates: line.candidates.map((candidate) => ({
      inventoryItemId: candidate.inventoryItemId,
      label: `${candidate.partName} · ${candidate.sku}`,
      detail: `${candidate.available} available · ${candidate.currency} ${major(
        candidate.unitCostMinor,
      )} each · ${candidate.leadTimeDays} days${
        candidate.declaredSubstitute ? ' · your declared substitute' : ''
      }`,
    })),
    suggestion:
      line.suggestion === null
        ? null
        : {
            status: line.suggestion.status,
            inventoryItemId: line.suggestion.suggestedInventoryItemId,
            suggestedPartName: line.suggestion.suggestedPartName,
            justification: line.suggestion.justification,
            impact: impactWords(
              line.suggestion.priceImpactMinor,
              line.suggestion.leadTimeImpactDays,
              match?.currency ?? request.currency,
            ),
          },
  }));

  return (
    <RequestShell
      request={request}
      client={client}
      activeTab="bom"
      shortLineCount={shortLines.length}
    >
      <Card padded={false}>
        <div className="px-4 py-4 md:px-6">
          <CardHeader
            title={`${request.productName} parts`}
            description={`${request.bomLines.length} ${
              request.bomLines.length === 1 ? 'line' : 'lines'
            } · ${totalParts} ${totalParts === 1 ? 'part' : 'parts'} per unit · ${
              totalParts * request.quantity
            } for ${request.quantity} units`}
          />
        </div>

        {shortLines.length > 0 && (
          <div className="px-4 pb-4 md:px-6">
            <MissingParts
              rfqId={request.rfqId}
              lines={shortLines}
              substitutionsAllowed={match?.substitutionsAllowed ?? false}
              policyLabel={
                SUBSTITUTION_POLICY_LABEL[match?.substitutionPolicy ?? ''] ??
                'The buyer decides on each substitute.'
              }
              unanswered={match?.unanswered ?? 0}
              quoteSent={request.myQuote !== null}
            />
          </div>
        )}

        {request.bomLines.length === 0 ? (
          <div className="px-4 pb-6 md:px-6">
            <EmptyState
              title="No bill of materials on this request"
              description="Nothing to source: either the buyer supplies the parts or this is fabrication only. If you expected a BOM, ask before quoting."
            />
          </div>
        ) : (
          <div className="w-full overflow-x-auto border-t border-border-subtle">
            <table className="w-full border-collapse text-sm">
              <caption className="sr-only">
                Bill of materials for {request.productName}
              </caption>
              <thead>
                <tr className="border-b border-border-subtle bg-bg-surface-raised">
                  {[
                    'Ref',
                    'Component',
                    'Part number',
                    'SKU',
                    'Qty per unit',
                    'Total',
                    'Your stock',
                  ].map((header) => (
                    <th
                      key={header}
                      scope="col"
                      className="whitespace-nowrap px-3 py-3 text-left text-xs font-semibold uppercase tracking-caps text-text-tertiary"
                    >
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {request.bomLines.map((line) => {
                  const matched = byItemId.get(line.id);
                  const coverage = matched?.coverage ?? 'missing';
                  return (
                    <tr key={line.id} className="border-b border-border-subtle last:border-0">
                      <td className="px-3 py-3 font-medium text-text-primary">
                        {line.reference}
                      </td>
                      <td className="px-3 py-3 text-text-secondary">{line.componentName}</td>
                      <td className="px-3 py-3 text-text-secondary">
                        {line.manufacturerPartNumber ?? (
                          <span className="text-text-tertiary">Not given</span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-text-secondary">
                        {line.sku ?? <span className="text-text-tertiary">Not given</span>}
                      </td>
                      <td className="px-3 py-3 text-text-secondary">{line.quantityRequired} pcs</td>
                      <td className="px-3 py-3 font-medium text-text-primary">
                        {line.quantityRequired * request.quantity} pcs
                      </td>
                      <td className="px-3 py-3">
                        <Tooltip
                          content={
                            matched === undefined
                              ? 'Not matched against your inventory'
                              : coverage === 'covered'
                                ? `${matched.held?.available ?? 0} available, ${matched.requiredTotal} needed`
                                : coverage === 'short'
                                  ? `${matched.held?.available ?? 0} available, short by ${matched.shortfall}`
                                  : line.sku === null
                                    ? 'No SKU on the line, so it cannot be matched to your stock'
                                    : 'This SKU is not in your inventory'
                          }
                        >
                          <Tag tone={COVERAGE_TONE[coverage]}>
                            {matched?.suggestion != null
                              ? 'Substitute suggested'
                              : COVERAGE_WORDS[coverage]}
                          </Tag>
                        </Tooltip>
                        {matched?.suggestion != null && (
                          <Text tone="muted" size="xs" className="mt-1 block">
                            {matched.suggestion.suggestedPartName} ·{' '}
                            {impactWords(
                              matched.suggestion.priceImpactMinor,
                              matched.suggestion.leadTimeImpactDays,
                              match?.currency ?? request.currency,
                            )}
                          </Text>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card>
        <CardHeader title="Sourcing these lines" />
        <Text size="sm" className="mt-2 block">
          {policySentence} Availability is what your inventory holds minus what is
          already reserved for other orders. A substitute is always the
          buyer&rsquo;s decision, never yours: you suggest it, they approve or reject
          it, and an undecided suggestion stops your quote being accepted.
        </Text>
      </Card>
    </RequestShell>
  );
};

export default BomPage;
