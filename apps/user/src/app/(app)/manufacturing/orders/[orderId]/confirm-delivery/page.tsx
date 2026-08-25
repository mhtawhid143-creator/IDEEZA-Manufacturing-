import { PlaceholderPage } from '@/components/placeholder-page.js';

export const dynamic = 'force-dynamic';

const Page = async ({ params }: { readonly params: Promise<{ readonly orderId: string }> }) => {
  const { orderId } = await params;
  return (
    <PlaceholderPage
      path={`/manufacturing/orders/${orderId}/confirm-delivery`}
      title="Confirm delivery"
      crumbs={[{ label: 'Manufacturing', href: '/manufacturing' }, { label: 'Orders', href: '/manufacturing/orders' }, { label: 'Confirm delivery' }]}
      plannedIn="the delivery and review window task"
    />
  );
};

export default Page;
