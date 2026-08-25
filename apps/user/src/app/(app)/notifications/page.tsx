import { PlaceholderPage } from '@/components/placeholder-page.js';

export const dynamic = 'force-dynamic';

const Page = () => (
  <PlaceholderPage
    path={'/notifications'}
    title="Notifications"
    crumbs={[{ label: 'Notifications' }]}
    plannedIn="the notification task"
  />
);

export default Page;
