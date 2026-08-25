import { Card, CardHeader, Heading, StatusChip, Text } from '@ideeza/ui';
import { HubSection } from '@/components/hub-section.js';

export const dynamic = 'force-dynamic';

const JOURNEY: readonly {
  readonly step: string;
  readonly note: string;
  readonly corrected?: boolean;
}[] = [
  { step: 'Product and package', note: 'Choose what to build: PCB, 3D module or the full product.' },
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
const ManufacturingPage = () => (
  <HubSection
    path={'/manufacturing'}
    activeId="draft"
    panelTitle="Drafts ready to send to manufacture"
    plannedIn="the package and requirements task"
  >
    <Card>
      <CardHeader
        title="How this journey works"
        description="The route architecture follows the approved business model, which differs from the design file in one important place."
      />
      <ol className="mt-4 flex flex-col gap-3">
        {JOURNEY.map((item, index) => (
          <li key={item.step} className="flex gap-3">
            <span
              className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-weak text-xs font-semibold text-brand"
              aria-hidden
            >
              {index + 1}
            </span>
            <div className="min-w-0">
              <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-heading">
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
      <Heading level={4}>What is built in this task</Heading>
      <Text className="mt-2">
        The design system, this shell, the navigation, the protected routes and
        the responsive behaviour. The request, quote, checkout, order and issue
        features arrive in the tasks that follow, each behind the same guard.
      </Text>
    </Card>
  </HubSection>
);

export default ManufacturingPage;
