import { notFound } from 'next/navigation';
import { Alert, Card, CardHeader, EmptyState, Icon, Tag, Text } from '@ideeza/ui';
import {
  asId,
  counted,
  PRODUCTION_FILE_FAMILY,
  PRODUCTION_FILE_LABEL,
  PRODUCTION_FILE_PURPOSE,
  QUOTE_COST_FAMILY_LABEL,
  productionFileRoleOf,
  requiredProductionFiles,
  type ProductionFileRole,
  type RfqId,
} from '@ideeza/domain';
import type { IconName } from '@ideeza/ui';
import { RequestShell } from '@/components/request/request-shell.js';
import { getClientProfile } from '@/data/clients.js';
import { getRoutedRequest, markSectionViewed, type RequestFile } from '@/data/rfqs.js';
import { requireManufacturer } from '@/lib/auth.js';

export const dynamic = 'force-dynamic';

/**
 * A glyph for what the file is for, not for what format it happens to be in
 * (UIUX-150).
 *
 * The review asked for colour-coded icons per format — red PDF, purple ZIP. Two
 * departures, both deliberate. **Colour is not used**: in this portal colour
 * means state and urgency, and this tab's own danger alert sits a few pixels
 * below the list, so a red icon on a healthy row would compete with it. And the
 * glyph follows the file's *role* rather than its extension, because two ZIPs
 * on one request are a Gerber set and a 3D model, which is the distinction a
 * shop is actually scanning for. The extension is still printed beside it.
 */
const ROLE_ICON: Readonly<Record<ProductionFileRole, IconName>> = {
  gerber: 'layers',
  drill: 'grid',
  fabrication_drawing: 'file',
  pick_and_place: 'board',
  assembly_drawing: 'file',
  panelisation: 'layers',
  model_3d: 'cube',
  print_specification: 'list',
  orientation_notes: 'compass',
  finish_specification: 'settings',
  bom: 'parts',
  schematic: 'board',
  other: 'file',
};

const FAMILY_LABEL: Readonly<Record<'board' | 'printed' | 'either', string>> = {
  board: QUOTE_COST_FAMILY_LABEL.board,
  printed: QUOTE_COST_FAMILY_LABEL.printed,
  either: 'Either kind of work',
};

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

  /*
    Grouped by the kind of work rather than stacked flat (UIUX-150).

    The review's complaint was that identical sections repeat down the page and
    stop scaling. This portal's request is one package rather than several named
    components, so the repetition it saw is not here — but the same scaling
    problem arrives with file count, and the answer is the one already used for
    the quote's costs and the shop-floor checks: group by the work, and name the
    group only when the request holds more than one kind of it.
  */
  const grouped = (['board', 'printed', 'either'] as const)
    .map((family) => ({
      family,
      files: request.files.filter((file) => PRODUCTION_FILE_FAMILY[roleOf(file)] === family),
    }))
    .filter((group) => group.files.length > 0);

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
          <div className="border-t border-border-subtle">
            {grouped.map((group) => (
              <section key={group.family}>
                {grouped.length > 1 && (
                  <p className="bg-bg-page px-4 py-2 text-xs font-semibold uppercase tracking-caps text-text-tertiary md:px-6">
                    {FAMILY_LABEL[group.family]}
                  </p>
                )}
                <ul
                  aria-label={`${FAMILY_LABEL[group.family]} files`}
                  className="border-t border-border-subtle"
                >
                  {group.files.map((file) => (
                    <li
                      key={file.id}
                      className="flex flex-wrap items-center justify-between gap-3 border-b border-border-subtle px-4 py-3 last:border-b-0 md:px-6"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <span
                          aria-hidden
                          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-bg-surface-raised text-icon-secondary"
                        >
                          <Icon name={ROLE_ICON[roleOf(file)]} size={18} />
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-text-primary">
                            {file.name}
                          </p>
                          <Text tone="muted" size="xs">
                            {file.name.split('.').pop()?.toUpperCase() ?? 'FILE'} ·{' '}
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
              </section>
            ))}
          </div>
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

      <Alert tone="info" title="No file opens in the browser here, and none pretends to">
        The platform records each file&rsquo;s name, revision, size and content hash;
        the bytes live in the design tool the package came from. So there is no
        preview and no download on a row — a Gerber viewer, a 3D viewer and a PDF
        preview all need the file itself, and a control that opened nothing would
        be worse than this sentence (UIUX-149). The hash is what you verify a file
        against once you do have it, and it is the same hash the buyer sees. What
        each file is <em>for</em> is read from its name, so check it by eye.
      </Alert>
    </RequestShell>
  );
};

export default FilesPage;
