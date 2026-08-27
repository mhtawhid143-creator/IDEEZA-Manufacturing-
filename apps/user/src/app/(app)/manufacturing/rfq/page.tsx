import { HubSection } from '@/components/hub-section.js';
import { RequestList } from '@/components/request-list.js';
import { hubCounts, listSubmittedRequests } from '@/data/requests.js';
import { requireBuyer } from '@/lib/auth.js';

export const dynamic = 'force-dynamic';

const Page = async () => {
  const actor = await requireBuyer('/manufacturing/rfq');
  const [requests, counts] = await Promise.all([
    listSubmittedRequests(actor.userId),
    hubCounts(actor.userId),
  ]);

  return (
    <HubSection
      path={'/manufacturing/rfq'}
      activeId="requests"
      panel={<RequestList requests={requests} />}
      counts={{
        draft: counts.drafts,
        requests: counts.requests,
        active: counts.active,
        history: counts.history,
      }}
    />
  );
};

export default Page;
