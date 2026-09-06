import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  Alert,
  Card,
  CardHeader,
  DefinitionList,
  PageHeader,
  StatusChip,
  Tag,
  Text,
  buttonAppearance,
} from '@ideeza/ui';
import { Crumbs } from '@/components/crumbs.js';
import { PrintSpecForm } from '@/components/print-spec-form.js';
import { getPrintSpec, printSpecRows } from '@/data/print-spec.js';
import { requireBuyer } from '@/lib/auth.js';
import { asId, usesInfill, type RfqId } from '@ideeza/domain';

export const dynamic = 'force-dynamic';

const text = (value: string | number | null): string =>
  value === null ? '' : String(value);

/** The materials whose Shore hardness is a number anybody quotes on. */
const FLEXIBLE = ['tpu', 'tpe', 'flexible', 'rubber', 'elastomer'];

/**
 * The detailed 3D printing specification of a draft.
 *
 * The peer of the board's page, and it exists for the reason UIUX-153 gives: a
 * printed part was carrying five answers on the draft and nothing else, while a
 * board had a document of its own. A printer prices on the layer height, the
 * walls, the size, the supports and the finishing, and none of that had anywhere
 * to be written down.
 */
const PrintSpecificationPage = async ({
  params,
}: {
  readonly params: Promise<{ readonly draftId: string }>;
}) => {
  const { draftId } = await params;
  const actor = await requireBuyer(
    `/manufacturing/draft/${draftId}/print-specification`,
  );
  const view = await getPrintSpec(actor.userId, asId<RfqId>(draftId));
  if (view === null) notFound();

  const spec = view.spec;
  const material = (spec.material ?? '').toLowerCase();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="3D printing specification"
        description={`${view.productName} · ${view.quantity} units`}
        breadcrumbs={
          <Crumbs
            items={[
              { label: 'Manufacturing', href: '/manufacturing' },
              { label: 'Draft', href: `/manufacturing/draft/${draftId}` },
              { label: '3D printing specification' },
            ]}
          />
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <StatusChip status={view.status} withDot />
            <Tag tone="brand">{view.specifiedCount} details set</Tag>
          </div>
        }
      />

      {!view.hasPrintedPart ? (
        <Card>
          <CardHeader
            title="There is nothing printed in this package"
            description="A print specification describes model files. This request carries boards, whose fabrication detail lives on the board specification."
          />
          <div className="mt-4">
            <Link
              href={`/manufacturing/draft/${draftId}`}
              className={buttonAppearance({ variant: 'secondary' })}
            >
              Back to the draft
            </Link>
          </div>
        </Card>
      ) : (
        <>
          <Alert tone="info" title="What this document is for">
            Every manufacturer you send this request to quotes against exactly this. Set
            what your part actually needs and leave the rest open — each extra
            constraint narrows who can make it, and an open row is answered in the quote.
          </Alert>

          <PrintSpecForm
            draftId={draftId}
            readOnly={!view.editable}
            modelFiles={view.modelFiles}
            flexible={FLEXIBLE.some((word) => material.includes(word))}
            fills={spec.technology === null || usesInfill(spec.technology)}
            values={{
              layerHeightMm: text(spec.layerHeightMm),
              infillPattern: text(spec.infillPattern),
              wallThicknessMm: text(spec.wallThicknessMm),
              dimensionXMm: text(spec.dimensionXMm),
              dimensionYMm: text(spec.dimensionYMm),
              dimensionZMm: text(spec.dimensionZMm),
              toleranceMm: text(spec.toleranceMm),
              supportStructure: text(spec.supportStructure),
              orientationRequirement: text(spec.orientationRequirement),
              durometer: text(spec.durometer),
              postProcessing: text(spec.postProcessing),
              certification: text(spec.certification),
            }}
          />

          <Card>
            <CardHeader
              title="As a manufacturer will read it"
              description="The same document, with every open row spelled out."
            />
            <DefinitionList
              className="mt-4"
              columns={2}
              items={printSpecRows(view).map((row) => ({
                label: row.label,
                value: row.value,
              }))}
            />
            <Text tone="muted" size="xs" className="mt-3">
              This is what travels with the request, is frozen when a quote is accepted,
              and is the document a dispute would be decided on.
            </Text>
          </Card>
        </>
      )}
    </div>
  );
};

export default PrintSpecificationPage;
