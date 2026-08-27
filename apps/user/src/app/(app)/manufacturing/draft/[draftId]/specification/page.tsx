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
import { BoardSpecForm } from '@/components/board-spec-form.js';
import { Crumbs } from '@/components/crumbs.js';
import { boardSpecRows, getBoardSpec } from '@/data/board-spec.js';
import { requireBuyer } from '@/lib/auth.js';
import { asId, type RfqId } from '@ideeza/domain';

export const dynamic = 'force-dynamic';

const text = (value: string | number | null): string =>
  value === null ? '' : String(value);

/**
 * The detailed specification of a draft.
 *
 * The design has this as one very long form of a fabrication house's own order
 * options. Here it is the request's production boundary: the same sections and
 * the same chip layout, with values any manufacturer can read and quote, and
 * with an open answer on every row. It is editable while the request is a draft
 * and read-only afterwards, because it is what the quotes were priced against.
 */
const SpecificationPage = async ({
  params,
}: {
  readonly params: Promise<{ readonly draftId: string }>;
}) => {
  const { draftId } = await params;
  const actor = await requireBuyer(`/manufacturing/draft/${draftId}/specification`);
  const view = await getBoardSpec(actor.userId, asId<RfqId>(draftId));
  if (view === null) notFound();

  const spec = view.spec;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Board specification"
        description={`${view.productName} · ${view.quantity} units`}
        breadcrumbs={
          <Crumbs
            items={[
              { label: 'Manufacturing', href: '/manufacturing' },
              { label: 'Draft', href: `/manufacturing/draft/${draftId}` },
              { label: 'Specification' },
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

      {!view.hasBoard ? (
        <Card>
          <CardHeader
            title="There is no board in this package"
            description="A board specification describes gerbers. This request carries printed parts, whose process and material are set on the draft itself."
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
            what your design actually needs and leave the rest open — each extra
            constraint narrows who can build it, and an open row is answered in the quote.
          </Alert>

          <BoardSpecForm
            draftId={draftId}
            assembling={view.assembly !== 'none'}
            bothSides={view.assemblySides === 'double_side'}
            readOnly={!view.editable}
            boardFiles={view.boardFiles}
            values={{
              baseMaterial: text(spec.baseMaterial),
              layerCount: text(spec.layerCount),
              thicknessMm: spec.thicknessMm === null ? '' : spec.thicknessMm.toFixed(1),
              boardColor: text(spec.boardColor),
              silkscreenColor: text(spec.silkscreenColor),
              surfaceFinish: text(spec.surfaceFinish),
              outerCopperOz: text(spec.outerCopperOz),
              innerCopperOz: text(spec.innerCopperOz),
              viaCovering: text(spec.viaCovering),
              minViaHoleMm: text(spec.minViaHoleMm),
              outlineToleranceMm: text(spec.outlineToleranceMm),
              deliveryFormat: text(spec.deliveryFormat),
              distinctDesigns: text(spec.distinctDesigns),
              electricalTest: text(spec.electricalTest),
              goldFingers: spec.goldFingers,
              castellatedHoles: spec.castellatedHoles,
              edgePlating: spec.edgePlating,
              blindOrBuriedVias: spec.blindOrBuriedVias,
              ulMarking: text(spec.ulMarking),
              markOnBoard: text(spec.markOnBoard),
              workmanshipClass: text(spec.workmanshipClass),
              packaging: text(spec.packaging),
              assembledFace: text(spec.assembledFace),
              partsSuppliedBy: text(spec.partsSuppliedBy),
              toolingHolesAddedBy: text(spec.toolingHolesAddedBy),
              conformalCoating: spec.conformalCoating,
              functionalTest: spec.functionalTest,
              stencilRequired: spec.stencilRequired,
              remarks: text(spec.remarks),
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
              items={boardSpecRows(view).map((row) => ({
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

export default SpecificationPage;
