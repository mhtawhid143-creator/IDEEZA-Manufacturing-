'use server';

import { markNotificationsRead } from '@/data/notifications.js';
import { markThreadRead, sendMessage } from '@/data/messaging.js';
import { sendMessageSchema } from '@ideeza/types';
import { requireBuyer } from '@/lib/auth.js';

export interface ReadState {
  readonly error?: string;
  readonly marked?: number;
}

/** Marks one notification read, or all of them when no id is given. */
export const markReadAction = async (
  notificationId?: string,
): Promise<ReadState> => {
  const actor = await requireBuyer('/notifications');
  try {
    const marked = await markNotificationsRead(
      actor.userId,
      notificationId === undefined ? [] : [notificationId],
    );
    return { marked };
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Nothing was marked.' };
  }
};

export interface SendState {
  readonly error?: string;
  readonly messageId?: string;
}

/** Sends a message into a thread the buyer takes part in. */
export const sendMessageAction = async (input: {
  readonly threadId: string;
  readonly body: string;
}): Promise<SendState> => {
  const actor = await requireBuyer('/messages');

  const parsed = sendMessageSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'That message is not valid.' };
  }

  try {
    const messageId = await sendMessage(actor.userId, parsed.data);
    return { messageId };
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'That message was not sent.' };
  }
};

/** Clears a thread's unread badge once the buyer has it open. */
export const markThreadReadAction = async (threadId: string): Promise<void> => {
  const actor = await requireBuyer('/messages');
  await markThreadRead(actor.userId, threadId);
};
