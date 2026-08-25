import type {
  DisputeId,
  FileId,
  IsoTimestamp,
  MessageId,
  MessageThreadId,
  NotificationId,
  OrderId,
  QuoteId,
  RfqId,
  UserId,
} from '../ids.js';
import type { MessageContextKind } from '../status/index.js';

/**
 * Every thread is anchored to a business object. Unanchored conversation is not
 * representable, which is what keeps commitments out of loose chat.
 */
export interface MessageThreadContext {
  readonly kind: MessageContextKind;
  readonly rfqId?: RfqId | undefined;
  readonly quoteId?: QuoteId | undefined;
  readonly orderId?: OrderId | undefined;
  readonly disputeId?: DisputeId | undefined;
}

export interface MessageThread {
  readonly id: MessageThreadId;
  readonly context: MessageThreadContext;
  readonly participantIds: readonly UserId[];
  readonly lastMessageAt?: IsoTimestamp | undefined;
  readonly createdAt: IsoTimestamp;
}

/**
 * A message is either human text or a system card that references a structured
 * business action. The card never carries the commitment itself.
 */
export interface Message {
  readonly id: MessageId;
  readonly threadId: MessageThreadId;
  readonly authorId?: UserId | undefined;
  readonly body?: string | undefined;
  readonly attachments: readonly FileId[];
  readonly referencedEventId?: string | undefined;
  readonly sentAt: IsoTimestamp;
}

export interface Notification {
  readonly id: NotificationId;
  readonly recipientId: UserId;
  readonly kind: string;
  readonly title: string;
  readonly body: string;
  readonly deepLink?: string | undefined;
  readonly readAt?: IsoTimestamp | undefined;
  readonly createdAt: IsoTimestamp;
}
