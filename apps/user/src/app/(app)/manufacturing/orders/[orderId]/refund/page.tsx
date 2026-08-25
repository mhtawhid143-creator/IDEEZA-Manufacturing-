import { PlaceholderPage } from '@/components/placeholder-page.js';

export const dynamic = 'force-dynamic';

const Page = async ({ params }: { readonly params: Promise<{ readonly orderId: string }> }) => {
  const { orderId } = await params;
  return (
    <PlaceholderPage
      path={`/manufacturing/orders/${orderId}/refund`}
      title="Request a refund"
      crumbs={[{ label: 'Manufacturing', href: '/manufacturing' }, { label: 'Orders', href: '/manufacturing/orders' }, { label: 'Refund' }]}
      plannedIn="the refund task"
    />
  );
};

export default Page;
