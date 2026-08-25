import { PlaceholderPage } from '@/components/placeholder-page.js';

export const dynamic = 'force-dynamic';

const Page = () => (
  <PlaceholderPage
    path={'/messages'}
    title="Messages"
    crumbs={[{ label: 'Messages' }]}
    plannedIn="the messaging task"
  />
);

export default Page;
