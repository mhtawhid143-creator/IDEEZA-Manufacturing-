import { HubSection } from '@/components/hub-section.js';

export const dynamic = 'force-dynamic';

const Page = () => (
  <HubSection
    path={'/manufacturing/rfq'}
    activeId="requests"
    panelTitle="Quote requests you have sent"
    plannedIn="the request task"
  />
);

export default Page;
