import { PlaceholderPage } from '@/components/placeholder-page.js';

export const dynamic = 'force-dynamic';

const Page = async ({ params }: { readonly params: Promise<{ readonly orderId: string }> }) => {
  const { orderId } = await params;
  return (
    <PlaceholderPage
      path={`/manufacturing/orders/${orderId}`}
      title="Order"
      crumbs={[{ label: 'Manufacturing', href: '/manufacturing' }, { label: 'Orders', href: '/manufacturing/orders' }, { label: 'Order' }]}
      plannedIn="the order and production tracking task"
    />
  );
};

export default Page;
