import { PlaceholderPage } from '@/components/placeholder-page.js';

export const dynamic = 'force-dynamic';

const Page = async ({ params }: { readonly params: Promise<{ readonly rfqId: string; readonly quoteId: string }> }) => {
  const { rfqId, quoteId } = await params;
  return (
    <PlaceholderPage
      path={`/manufacturing/rfq/${rfqId}/quotes/${quoteId}`}
      title="Quote details"
      crumbs={[{ label: 'Manufacturing', href: '/manufacturing' }, { label: 'Quote requests', href: '/manufacturing/rfq' }, { label: 'Quote' }]}
      plannedIn="the quote task"
    />
  );
};

export default Page;
