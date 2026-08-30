import { Alert, Card, CardHeader, Heading, StatusChip, Text } from '@ideeza/ui';
import { DraftList } from '@/components/draft-list.js';
import { HubSection } from '@/components/hub-section.js';
import { listDrafts } from '@/data/drafts.js';
import { hubCounts } from '@/data/requests.js';
import { requireBuyer } from '@/lib/auth.js';

export const dynamic = 'force-dynamic';

const JOURNEY: readonly {
  readonly step: string;
  readonly note: string;
  readonly corrected?: boolean;
}[] = [
  {
    step: 'Product and package',
    note: 'Choose what goes: the boards, the printed parts, or both. What you tick decides what is being made.',
  },
  {
    step: 'Detailed specification',
    note: 'Board material, layers, finish, tests — as much or as little as your design needs. Anything left open is the manufacturer\u2019s choice.',
  },
  { step: 'Manufacturing requirements', note: 'Material, method, tolerance, assembly, quality check, shipping.' },
  { step: 'Select manufacturers', note: 'One request, routed to one or many manufacturers.' },
  { step: 'Quotes received', note: 'Each manufacturer answers with its own quote, or declines.' },
  { step: 'Compare and accept one', note: 'Price, lead time, shipping, warranty and expiry side by side.' },
  {
    step: 'Awaiting payment',
    note: 'Accepting a quote does not create an order. The order opens unconfirmed.',
    corrected: true,
  },
  {
    step: 'Secured checkout',
    note: 'The platform holds the funds; only then is the order confirmed.',
    corrected: true,
  },
  { step: 'Production stages', note: 'Ten canonical stages, from files under review to completed.' },
  { step: 'Delivery and review window', note: 'Confirm delivery, or raise an issue with evidence.' },
];

/**
 * The manufacturing hub, which is also the Draft tab: a draft is where the
 * journey starts, so the landing route and the first tab are the same page.
 */
const ManufacturingPage = async ({
  searchParams,
}: {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}) => {
  const actor = await requireBuyer('/manufacturing');
  const [drafts, counts] = await Promise.all([
    listDrafts(actor.userId),
    hubCounts(actor.userId),
  ]);
  const query = await searchParams;

  return (
  <HubSection
    path={'/manufacturing'}
    activeId="draft"
    panel={
      <DraftList
        drafts={drafts.map((draft) => ({
          rfqId: draft.rfqId,
          productId: draft.productId,
          productName: draft.productName,
          creatorName: draft.creatorName,
          kind: draft.kind,
          quantity: draft.quantity,
          leadTimeDays: draft.leadTimeDays,
          fileCount: draft.includedFileIds.length,
          bomLineCount: draft.includedBomLineIds.length,
          files: draft.files,
        }))}
      />
    }
    counts={{
      draft: counts.drafts,
      requests: counts.requests,
      active: counts.active,
      history: counts.history,
    }}
  >
    {query['withdrawn'] === '1' && (
      <Alert tone="info" title="Draft withdrawn">
        Nothing was sent, and the product it came from can start a new request.
      </Alert>
    )}
    <Card>
      <CardHeader
        title="How this journey works"
        description="The route architecture follows the approved business model, which differs from the design file in one important place."
      />
      <ol className="mt-4 flex flex-col gap-3">
        {JOURNEY.map((item, index) => (
          <li key={item.step} className="flex gap-3">
            <span
              className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-bg-brand-subtle text-xs font-semibold text-text-brand"
              aria-hidden
            >
              {index + 1}
            </span>
            <div className="min-w-0">
              <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-text-primary">
                {item.step}
                {item.corrected === true && (
                  <StatusChip status="awaiting_payment" label="corrected from the design file" />
                )}
              </p>
              <Text tone="muted" size="xs" className="mt-0.5">
                {item.note}
              </Text>
            </div>
          </li>
        ))}
      </ol>
    </Card>

    <Card tone="brand">
      <Heading level={3}>Where the money sits at each step</Heading>
      <Text className="mt-2">
        Nothing is charged to send a request or to receive quotes. Accepting a
        quote opens an order that is <span className="font-semibold">not</span>{' '}
        confirmed: IDEEZA takes the funds at checkout and holds them. Production
        starts once they are held, and they reach the manufacturer only against a
        documented event — your delivery confirmation, an accepted inspection, or
        a resolved issue. A refund request or a dispute stops that release.
      </Text>
    </Card>
  </HubSection>
  );
};

export default ManufacturingPage;
