import { notFound } from 'next/navigation';
import { Alert, Card, CardHeader, EmptyState, Tag, Text } from '@ideeza/ui';
import {
  asId,
  counted,
  PRODUCTION_FILE_LABEL,
  PRODUCTION_FILE_PURPOSE,
  productionFileRoleOf,
  requiredProductionFiles,
  type RfqId,
} from '@ideeza/domain';
import { RequestShell } from '@/components/request/request-shell.js';
import { getClientProfile } from '@/data/clients.js';
import { getRoutedRequest, markSectionViewed, type RequestFile } from '@/data/rfqs.js';
import { requireManufacturer } from '@/lib/auth.js';

export const dynamic = 'force-dynamic';

const size = (bytes: number): string =>
  bytes >= 1_048_576
    ? `${(bytes / 1_048_576).toFixed(1)} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`;

/**
 * Production Files: what came with the request, against what it needs.
 *
 * The list alone could only say what arrived. What a shop actually asks on
 * opening this tab is whether everything needed to make the thing is here — and
 * a missing drill file discovered at the bench has already been quoted for
 * (UIUX-147, UIUX-148). So the files are sorted into what the work needs and
 * has, what it needs and lacks, and what came besides.
 *
 * The design puts a download button and a layout viewer on every row. Neither
 * exists in this build — the platform records a file's name, revision, size and
 * content hash, not its bytes — so the row carries the hash instead, which is
 * the thing a shop checks a file against once it does have it. A button that
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
  // Opening this is what lets the quote form be sent (UIUX-193).
  await markSectionViewed(actor.manufacturerId, asId<RfqId>(rfqId), 'files');
  const client = await getClientProfile(request.buyerId, actor.manufacturerId);

  // What each file appears to be for. A guess from its name, and said to be
  // one: the platform holds names rather than contents.
  const roleOf = (file: RequestFile) => productionFileRoleOf(file.name);
  const required = requiredProductionFiles(request.work);
  const arrived = new Set(request.files.map((file) => roleOf(file)));

  const missing = required.filter((entry) => !arrived.has(entry.role));
  const absent = missing.filter((entry) => entry.requirement === 'always');
  const unstated = missing.filter((entry) => entry.requirement === 'if_specified');
  const extra = request.files.filter(
    (file) => !required.some((entry) => entry.role === roleOf(file)),
  );

  return (
    <RequestShell request={request} client={client} activeTab="files">
      <Card padded={false}>
        <div className="px-4 py-4 md:px-6">
          <CardHeader
            title={request.productName}
            description={`${counted(request.files.length, 'file')} attached · ${counted(
              required.length,
              'file',
            )} this kind of work needs`}
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
          <ul aria-label="Production files" className="border-t border-border-subtle">
            {request.files.map((file) => (
              <li
                key={file.id}
                className="flex flex-wrap items-center justify-between gap-3 border-b border-border-subtle px-4 py-3 last:border-b-0 md:px-6"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span
                    aria-hidden
                    className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-bg-surface-raised text-xs font-semibold text-text-tertiary"
                  >
                    {file.name.split('.').pop()?.slice(0, 4).toUpperCase() ?? 'FILE'}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-text-primary">
                      {file.name}
                    </p>
                    <Text tone="muted" size="xs">
                      {size(file.byteSize)} · rev {file.revision} ·{' '}
                      {PRODUCTION_FILE_PURPOSE[roleOf(file)]}
                    </Text>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {/* What it is for, read from its name (UIUX-147, UIUX-148). */}
                  <Tag tone={roleOf(file) === 'schematic' ? 'neutral' : 'brand'}>
                    {PRODUCTION_FILE_LABEL[roleOf(file)]}
                  </Tag>
                  <code className="rounded bg-bg-surface-raised px-2 py-1 text-2xs text-text-tertiary">
                    {file.contentHash.slice(0, 12)}…
                  </code>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/*
        What this kind of work needs and has not got. Split by whether the file
        is one the work cannot be made without or one the buyer may simply have
        had no opinion about — a tab that calls both "missing" teaches a shop to
        ignore it (UIUX-147, UIUX-148).
      */}
      {absent.length > 0 && (
        <Alert
          tone="danger"
          title={`${counted(absent.length, 'file')} this work needs did not arrive`}
        >
          <span className="mt-1 block font-medium text-text-primary">
            {absent.map((entry) => PRODUCTION_FILE_LABEL[entry.role]).join(' · ')}
          </span>
          <span className="mt-1 block">
            Ask for them before you quote. A price for a board with no drill file is a
            price for something nobody has described — and declining with &ldquo;files
            incomplete&rdquo; is a fair answer if they do not come.
          </span>
        </Alert>
      )}

      {unstated.length > 0 && (
        <Card>
          <CardHeader
            title="Left to you"
            description="The buyer said nothing about these, so the choice is the shop’s. Say what you assumed in your quote."
          />
          <ul aria-label="Left to the shop" className="mt-3 flex flex-col gap-2">
            {unstated.map((entry) => (
              <li key={entry.role}>
                <p className="text-sm font-medium text-text-primary">
                  {PRODUCTION_FILE_LABEL[entry.role]}
                </p>
                <Text tone="muted" size="xs">
                  {PRODUCTION_FILE_PURPOSE[entry.role]}
                </Text>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {extra.length > 0 && (
        <Card>
          <CardHeader
            title="Attached as well"
            description="Not part of what this kind of work needs, and not counted against it."
          />
          <ul aria-label="Attached as well" className="mt-3 flex flex-col gap-2">
            {extra.map((file) => (
              <li key={file.id}>
                <p className="text-sm font-medium text-text-primary">{file.name}</p>
                <Text tone="muted" size="xs">
                  {PRODUCTION_FILE_PURPOSE[roleOf(file)]}
                  {roleOf(file) === 'schematic'
                    ? ' The platform does not ask a buyer for one, because it is a circuit design rather than a manufacturing input; this arrived anyway.'
                    : ''}
                </Text>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Alert tone="info" title="File contents are not served in this environment">
        The platform records each file&rsquo;s name, revision, size and content hash;
        the bytes live in the design tool the package came from. The hash is what
        you verify against once you have the file, and it is the same hash the
        buyer sees. What each file is <em>for</em> is read from its name, so check
        it by eye — a name is all this build holds.
      </Alert>
    </RequestShell>
  );
};

export default FilesPage;
