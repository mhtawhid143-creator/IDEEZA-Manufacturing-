import { PlaceholderPage } from '@/components/placeholder-page.js';

export const dynamic = 'force-dynamic';

const Page = async ({ params }: { readonly params: Promise<{ readonly draftId: string }> }) => {
  const { draftId } = await params;
  return (
    <PlaceholderPage
      path={`/manufacturing/draft/${draftId}`}
      title="Package and requirements"
      crumbs={[{ label: 'Manufacturing', href: '/manufacturing' }, { label: 'Draft' }]}
      plannedIn="the package and requirements task"
    />
  );
};

export default Page;
