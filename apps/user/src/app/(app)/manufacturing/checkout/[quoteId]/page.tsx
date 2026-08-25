import { PlaceholderPage } from '@/components/placeholder-page.js';

export const dynamic = 'force-dynamic';

const Page = async ({ params }: { readonly params: Promise<{ readonly quoteId: string }> }) => {
  const { quoteId } = await params;
  return (
    <PlaceholderPage
      path={`/manufacturing/checkout/${quoteId}`}
      title="Secured checkout"
      crumbs={[{ label: 'Manufacturing', href: '/manufacturing' }, { label: 'Checkout' }]}
      plannedIn="the secured checkout task"
    />
  );
};

export default Page;
