import { notFound } from 'next/navigation';
import { asId, type RfqId } from '@ideeza/domain';
import { RequestBrief } from '@/components/request/request-brief.js';
import { RequestShell } from '@/components/request/request-shell.js';
import { getClientProfile } from '@/data/clients.js';
import { getRoutedRequest, markRequestViewed } from '@/data/rfqs.js';
import { requireManufacturer } from '@/lib/auth.js';

export const dynamic = 'force-dynamic';

/**
 * Brief: what is being asked for, and whether it is worth quoting.
 *
 * Opening this is what tells the buyer their request is being looked at, so the
 * routing record is marked viewed here and nowhere else — the buyer's activity
 * screen reads it, and "opened" has to mean a person actually opened it.
 *
 * The brief itself is drawn by `RequestBrief`, which the quote's own RFQ
 * overview tab also uses: there used to be two hand-written copies and they had
 * drifted apart (UIUX-192).
 */
const BriefPage = async ({
  params,
}: {
  readonly params: Promise<{ readonly rfqId: string }>;
}) => {
  const { rfqId } = await params;
  const actor = await requireManufacturer(`/rfqs/${rfqId}`);
  const id = asId<RfqId>(rfqId);

  const request = await getRoutedRequest(actor.manufacturerId, id);
  if (request === null) notFound();

  await markRequestViewed(actor.manufacturerId, id);
  const client = await getClientProfile(request.buyerId, actor.manufacturerId);

  return (
    <RequestShell request={request} client={client} activeTab="brief">
      <RequestBrief request={request} heading="The buyer’s request" />
    </RequestShell>
  );
};

export default BriefPage;
