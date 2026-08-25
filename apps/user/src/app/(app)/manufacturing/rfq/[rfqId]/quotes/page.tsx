import { PlaceholderPage } from '@/components/placeholder-page.js';

export const dynamic = 'force-dynamic';

const Page = async ({ params }: { readonly params: Promise<{ readonly rfqId: string }> }) => {
  const { rfqId } = await params;
  return (
    <PlaceholderPage
      path={`/manufacturing/rfq/${rfqId}/quotes`}
      title="Quotes received"
      crumbs={[{ label: 'Manufacturing', href: '/manufacturing' }, { label: 'Quote requests', href: '/manufacturing/rfq' }, { label: 'Quotes' }]}
      plannedIn="the quote task"
    />
  );
};

export default Page;
