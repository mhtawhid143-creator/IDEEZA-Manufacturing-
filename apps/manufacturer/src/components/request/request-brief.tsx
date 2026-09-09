import Link from 'next/link';
import { Card, CardHeader, DefinitionList, Tag, Text, buttonAppearance } from '@ideeza/ui';
import { briefRows, counted, requestReference } from '@ideeza/domain';
import type { RequestDetail } from '@/data/rfqs.js';

const day = (value: Date | null): string =>
  value === null ? '—' : value.toISOString().slice(0, 10);

/** The link treatment for a reference out of a definition row. */
const linkStyle =
  'font-medium text-text-link underline decoration-border-strong underline-offset-2 hover:text-text-brand focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus';

export interface RequestBriefProps {
  readonly request: RequestDetail;
  /**
   * Whose information this is, said in the heading (UIUX-196).
   *
   * The same block appeared on two tabs under the identical title "General
   * information", one holding the shop's own commercial terms and one holding
   * the buyer's ask. Two different field sets under one heading read as the
   * same thing restated, which is exactly what a reviewer reported.
   */
  readonly heading: string;
  /** Volumes the shop actually priced, when this is read beside a quote. */
  readonly pricedVolumes?: readonly number[];
  /** Whether to offer the way onward to the production detail. */
  readonly withOnwardLinks?: boolean;
}

/**
 * The buyer's ask, rendered once (UIUX-192).
 *
 * There were two hand-written copies of this — the request's own Brief tab and
 * the quote's RFQ overview tab — and they had already drifted: one had the
 * quotable reference and a link to the files, the other still printed a bare
 * count. Two renderers of one thing is how that happens, so there is one now
 * and the differences between the two readings are props.
 */
export const RequestBrief = ({
  request,
  heading,
  pricedVolumes,
  withOnwardLinks = false,
}: RequestBriefProps) => (
  <>
    <Card>
      <CardHeader
        title="Production requirement"
        description="Frozen when the request was sent, which is what a quote answers."
        actions={
          <div className="flex flex-wrap gap-2">
            {request.hasBoard && <Tag tone="brand">PCB</Tag>}
            {request.hasPrintedPart && <Tag tone="brand">3D printing</Tag>}
            {!request.hasBoard && !request.hasPrintedPart && (
              <Tag tone="neutral">No production files attached</Tag>
            )}
          </div>
        }
      />
      <DefinitionList
        className="mt-4"
        columns={2}
        items={briefRows(request.requirementRows)}
      />
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
      <CardHeader title={heading} />
      <DefinitionList
        className="mt-4"
        columns={2}
        items={[
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
            label: pricedVolumes === undefined ? 'Also price for' : 'Also priced at',
            value:
              pricedVolumes === undefined
                ? request.volumeTiers.length === 0
                  ? 'This volume only'
                  : request.volumeTiers.map((tier) => counted(tier, 'unit')).join(', ')
                : pricedVolumes.length === 0
                  ? request.volumeTiers.length === 0
                    ? 'This volume only'
                    : `${request.volumeTiers.join(', ')} — you did not price these`
                  : pricedVolumes.map((tier) => counted(tier, 'unit')).join(', '),
          },
          // A bill of materials is a fact about assembly work. A print-only
          // request has none, and a row reading "0" invites the shop to wonder
          // what it is missing (UIUX-142).
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
                // The count is the way to the files (UIUX-139).
                <Link href={`/rfqs/${request.rfqId}/files`} className={linkStyle}>
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

      {withOnwardLinks && (
        <div className="mt-4 flex flex-wrap gap-2 border-t border-border-subtle pt-4">
          <Link
            href={`/rfqs/${request.rfqId}/specification`}
            className={buttonAppearance({ variant: 'secondary', size: 'sm' })}
          >
            Production specification
          </Link>
          <Link
            href={`/rfqs/${request.rfqId}/bom`}
            className={buttonAppearance({ variant: 'secondary', size: 'sm' })}
          >
            BOM / parts
          </Link>
          <Link
            href={`/rfqs/${request.rfqId}/files`}
            className={buttonAppearance({ variant: 'secondary', size: 'sm' })}
          >
            Production files
          </Link>
        </div>
      )}

      <Text tone="muted" size="xs" className="mt-4 block">
        Requirements were frozen{' '}
        {request.requirementsLockedAt === null
          ? 'not yet — the buyer can still change them'
          : `on ${day(request.requirementsLockedAt)}, so what you quote against cannot move under you`}
        .
      </Text>
    </Card>
  </>
);
