import { PlaceholderPage } from '@/components/placeholder-page.js';

export const dynamic = 'force-dynamic';

const Page = () => (
  <PlaceholderPage
    path={'/manufacturing/rfq/new'}
    title="New quote request"
    crumbs={[{ label: 'Manufacturing', href: '/manufacturing' }, { label: 'Quote requests', href: '/manufacturing/rfq' }, { label: 'New' }]}
    plannedIn="the request builder task"
  />
);

export default Page;
