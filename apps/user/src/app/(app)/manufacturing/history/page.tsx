import { HubSection } from '@/components/hub-section.js';

export const dynamic = 'force-dynamic';

const Page = () => (
  <HubSection
    path={'/manufacturing/history'}
    activeId="history"
    panelTitle="Completed and closed orders"
    plannedIn="the order history task"
  />
);

export default Page;
