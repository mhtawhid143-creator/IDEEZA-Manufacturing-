import { PlaceholderPage } from '@/components/placeholder-page.js';

export const dynamic = 'force-dynamic';

const Page = async ({ params }: { readonly params: Promise<{ readonly rfqId: string }> }) => {
  const { rfqId } = await params;
  return (
    <PlaceholderPage
      path={`/manufacturing/rfq/${rfqId}/substitutions`}
      title="Replacement parts"
      crumbs={[{ label: 'Manufacturing', href: '/manufacturing' }, { label: 'Quote requests', href: '/manufacturing/rfq' }, { label: 'Replacement parts' }]}
      plannedIn="the substitution review task"
    />
  );
};

export default Page;
