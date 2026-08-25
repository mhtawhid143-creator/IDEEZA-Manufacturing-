import { HubSection } from '@/components/hub-section.js';

export const dynamic = 'force-dynamic';

const Page = () => (
  <HubSection
    path={'/manufacturing/orders'}
    activeId="active"
    panelTitle="Orders in production"
    plannedIn="the order and production tracking task"
  />
);

export default Page;
