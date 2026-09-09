import Link from 'next/link';
import { Badge, Card, Text, buttonAppearance } from '@ideeza/ui';
import { counted } from '@ideeza/domain';
import type { ClientProfile } from '@/data/clients.js';
import { linkIfBuilt } from '@/lib/navigation.js';

export interface ClientPanelProps {
  readonly client: ClientProfile | null;
  readonly buyerName: string;
  /** Who drew it, when that is someone other than the buyer. */
  readonly creatorName: string;
  readonly shipsTo: string;
}

const day = (value: Date): string => value.toISOString().slice(0, 10);

/**
 * How reliable this buyer has been, in a phrase and a tone (UIUX-145).
 *
 * Not a star rating: nothing on this platform rates a buyer, and a score
 * assembled out of order counts would look like a judgement somebody had made.
 * This is the record, said plainly — and a buyer with nothing to judge yet reads
 * as "New client" rather than as a blank, so its absence is visibly deliberate.
 */
const reliability = (
  client: ClientProfile,
): { readonly word: string; readonly tone: 'success' | 'warning' | 'neutral' } => {
  if (client.requestsQuoted === 0) return { word: 'New client', tone: 'neutral' };
  const rate = client.requestsAccepted / client.requestsQuoted;
  if (client.requestsAccepted === 0) {
    return { word: 'Has not accepted a quote yet', tone: 'warning' };
  }
  return {
    word: `Accepts ${Math.round(rate * 100)}% of quotes`,
    tone: rate >= 0.5 ? 'success' : 'warning',
  };
};

/**
 * Who the buyer is, on every screen that shows one of their requests.
 *
 * The design's version carries a job title, a skill list and a project count. A
 * buyer account has none of those, and "skills" belong to a shop. What a shop
 * needs before pricing is whether this buyer follows through, so this is their
 * record on the platform instead.
 */
export const ClientPanel = ({
  client,
  buyerName,
  creatorName,
  shipsTo,
}: ClientPanelProps) => {
  const messagesHref = linkIfBuilt('/messages');

  return (
    <Card className="flex flex-col gap-3">
      <Text size="sm" className="font-semibold text-text-primary">
        About the client
      </Text>
      <div className="flex items-center gap-3">
        <span
          aria-hidden
          className="h-10 w-10 shrink-0 rounded-full bg-gradient-to-br from-bg-brand-subtle to-bg-info-subtle"
        />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-text-primary">{buyerName}</p>
          {/*
            Beside the name, because it is the first thing a shop weighs before
            spending an afternoon on a price (UIUX-145).
          */}
          {client !== null && (
            <div className="mt-0.5">
              <Badge tone={reliability(client).tone}>{reliability(client).word}</Badge>
            </div>
          )}
          <Text tone="muted" size="xs" className="mt-0.5 block">
            {creatorName === buyerName ? 'Owns the design' : `Design by ${creatorName}`}
          </Text>
        </div>
      </div>

      {messagesHref === undefined ? (
        <span
          className={buttonAppearance({
            variant: 'secondary',
            className: 'pointer-events-none w-full justify-center opacity-muted',
          })}
          aria-disabled="true"
          title="Messaging arrives with the messaging stage."
        >
          Message {buyerName}
        </span>
      ) : (
        <Link
          href={messagesHref}
          className={buttonAppearance({
            variant: 'secondary',
            className: 'w-full justify-center',
          })}
        >
          Message {buyerName}
        </Link>
      )}

      <div className="flex flex-col gap-2 border-t border-border-subtle pt-3">
        <div>
          <Text size="sm" className="font-semibold text-text-primary">
            Ships to
          </Text>
          <Text tone="muted" size="xs">
            {shipsTo}
          </Text>
        </div>
        {client !== null && (
          <>
            <div>
              <Text size="sm" className="font-semibold text-text-primary">
                Requests sent on IDEEZA
              </Text>
              <Text tone="muted" size="xs">
                {client.requestsSent} · {client.ordersCompleted} completed
                {client.ordersWithThisShop === 0
                  ? ''
                  : ` · ${client.ordersWithThisShop} with your shop`}
              </Text>
            </div>
            <div>
              <Text size="sm" className="font-semibold text-text-primary">
                Follows through
              </Text>
              <Text tone="muted" size="xs">
                {client.requestsQuoted === 0
                  ? 'No quote has reached them yet, so there is nothing to judge.'
                  : `${client.requestsAccepted} of ${counted(
                      client.requestsQuoted,
                      'quoted request',
                    )} accepted${
                      client.requestsAccepted === 0
                        ? ''
                        : ` · ${
                            client.acceptedAndPaid >= client.requestsAccepted
                              ? 'paid for every one'
                              : `${client.acceptedAndPaid} paid for`
                          }`
                    }`}
              </Text>
            </div>
            <div>
              <Text size="sm" className="font-semibold text-text-primary">
                Asks for
              </Text>
              <Text tone="muted" size="xs">
                {client.worksOn.length === 0
                  ? 'This is their first request'
                  : client.worksOn.join(', ')}
              </Text>
            </div>
            <div>
              <Text size="sm" className="font-semibold text-text-primary">
                Member since
              </Text>
              <Text tone="muted" size="xs">
                {day(client.memberSince)}
              </Text>
            </div>
          </>
        )}
      </div>
    </Card>
  );
};
