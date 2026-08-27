import { z } from 'zod';
import { idSchema } from './common.js';

/**
 * A message in a context-bound thread.
 *
 * Threads are never free-standing: one belongs to a request, a quote, an order
 * or a dispute, so a message always has something it is about. Sending is the
 * only write a buyer has here — nothing is edited or deleted, because the thread
 * is part of the order record.
 */
export const sendMessageSchema = z.object({
  threadId: idSchema,
  body: z.string().trim().min(1).max(4000),
});
export type SendMessageInput = z.infer<typeof sendMessageSchema>;

export const markNotificationsSchema = z.object({
  /** Empty means every unread notification the reader has. */
  notificationIds: z.array(idSchema).max(200).default([]),
});
export type MarkNotificationsInput = z.infer<typeof markNotificationsSchema>;
