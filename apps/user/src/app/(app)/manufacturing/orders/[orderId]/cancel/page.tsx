import { PlaceholderPage } from '@/components/placeholder-page.js';

export const dynamic = 'force-dynamic';

const Page = async ({ params }: { readonly params: Promise<{ readonly orderId: string }> }) => {
  const { orderId } = await params;
  return (
    <PlaceholderPage
      path={`/manufacturing/orders/${orderId}/cancel`}
      title="Request cancellation"
      crumbs={[{ label: 'Manufacturing', href: '/manufacturing' }, { label: 'Orders', href: '/manufacturing/orders' }, { label: 'Cancellation' }]}
      plannedIn="the cancellation task"
    />
  );
};

export default Page;
