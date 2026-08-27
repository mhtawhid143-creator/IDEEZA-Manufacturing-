import { notFound } from 'next/navigation';
import { Alert, Card, CardHeader, EmptyState, Tag, Text } from '@ideeza/ui';
import { asId, type RfqId } from '@ideeza/domain';
import { RequestShell } from '@/components/request/request-shell.js';
import { getClientProfile } from '@/data/clients.js';
import { getRoutedRequest, type RequestFile } from '@/data/rfqs.js';
import { requireManufacturer } from '@/lib/auth.js';

export const dynamic = 'force-dynamic';

const KIND_LABEL: Readonly<Record<RequestFile['kind'], string>> = {
  pcb: 'Board data',
  model_3d: '3D model',
  document: 'Document',
};

const size = (bytes: number): string =>
  bytes >= 1_048_576
    ? `${(bytes / 1_048_576).toFixed(1)} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`;

/**
 * Production Files: what came with the request.
 *
 * The design puts a download button and a layout viewer on every row. Neither
 * exists in this build — the platform records a file's name, revision, size and
 * content hash, not its bytes — so the row carries the hash instead, which is the
 * thing a shop checks a file against once it does have it. A button that
 * downloaded nothing would be worse than saying so.
 */
const FilesPage = async ({
  params,
}: {
  readonly params: Promise<{ readonly rfqId: string }>;
}) => {
  const { rfqId } = await params;
  const actor = await requireManufacturer(`/rfqs/${rfqId}/files`);
  const request = await getRoutedRequest(actor.manufacturerId, asId<RfqId>(rfqId));
  if (request === null) notFound();
  const client = await getClientProfile(request.buyerId, actor.manufacturerId);

  const counts = {
    pcb: request.files.filter((file) => file.kind === 'pcb').length,
    model_3d: request.files.filter((file) => file.kind === 'model_3d').length,
    document: request.files.filter((file) => file.kind === 'document').length,
  };

  return (
    <RequestShell request={request} client={client} activeTab="files">
      <Card padded={false}>
        <div className="px-4 py-4 md:px-6">
          <CardHeader
            title={request.productName}
            description={`${counts.pcb} board ${counts.pcb === 1 ? 'file' : 'files'} · ${counts.model_3d} 3D ${counts.model_3d === 1 ? 'model' : 'models'} · ${counts.document} ${counts.document === 1 ? 'document' : 'documents'}`}
          />
        </div>

        {request.files.length === 0 ? (
          <div className="px-4 pb-6 md:px-6">
            <EmptyState
              title="No production files on this request"
              description="Nothing was attached to the package. Without files there is nothing to price, so declining with “files incomplete” is a fair answer."
            />
          </div>
        ) : (
          <ul aria-label="Production files" className="border-t border-line">
            {request.files.map((file) => (
              <li
                key={file.id}
                className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3 last:border-b-0 md:px-6"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span
                    aria-hidden
                    className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-raised text-xs font-semibold text-muted"
                  >
                    {file.name.split('.').pop()?.slice(0, 4).toUpperCase() ?? 'FILE'}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-heading">
                      {file.name}
                    </p>
                    <Text tone="muted" size="xs">
                      {KIND_LABEL[file.kind]} · {size(file.byteSize)} · rev{' '}
                      {file.revision}
                    </Text>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Tag tone="neutral">{KIND_LABEL[file.kind]}</Tag>
                  <code className="rounded bg-raised px-2 py-1 text-[11px] text-muted">
                    {file.contentHash.slice(0, 12)}…
                  </code>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Alert tone="info" title="File contents are not served in this environment">
        The platform records each file&rsquo;s name, revision, size and content hash;
        the bytes live in the design tool the package came from. The hash is what
        you verify against once you have the file, and it is the same hash the
        buyer sees.
      </Alert>
    </RequestShell>
  );
};

export default FilesPage;
