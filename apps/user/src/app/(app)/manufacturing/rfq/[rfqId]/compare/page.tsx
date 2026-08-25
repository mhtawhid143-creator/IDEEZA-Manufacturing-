import { PlaceholderPage } from '@/components/placeholder-page.js';

export const dynamic = 'force-dynamic';

const Page = async ({ params }: { readonly params: Promise<{ readonly rfqId: string }> }) => {
  const { rfqId } = await params;
  return (
    <PlaceholderPage
      path={`/manufacturing/rfq/${rfqId}/compare`}
      title="Compare quotes"
      crumbs={[{ label: 'Manufacturing', href: '/manufacturing' }, { label: 'Quote requests', href: '/manufacturing/rfq' }, { label: 'Compare' }]}
      plannedIn="the quote comparison task"
    />
  );
};

export default Page;
