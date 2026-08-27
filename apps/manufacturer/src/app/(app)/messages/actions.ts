'use server';

import { markThreadRead, sendMessage } from '@/data/messaging.js';
import { requireManufacturer } from '@/lib/auth.js';

export interface MessageState {
  readonly sent: boolean;
  readonly error?: string;
}

/** Sends a message into a conversation this member takes part in. */
export const sendMessageAction = async (
  threadId: string,
  body: string,
): Promise<MessageState> => {
  const actor = await requireManufacturer(`/messages/${threadId}`);
  try {
    const result = await sendMessage(actor.userId, threadId, body);
    return result.ok ? { sent: true } : { sent: false, error: result.message };
  } catch (error) {
    if (error instanceof Error) return { sent: false, error: error.message };
    throw error;
  }
};

/** Marks a conversation read, so the unread count means something. */
export const markReadAction = async (threadId: string): Promise<void> => {
  const actor = await requireManufacturer(`/messages/${threadId}`);
  await markThreadRead(actor.userId, threadId);
};
