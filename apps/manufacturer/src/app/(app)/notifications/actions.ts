'use server';

import { markNotificationsRead } from '@/data/notifications.js';
import { requireManufacturer } from '@/lib/auth.js';

export interface ReadState {
  readonly error?: string;
  readonly marked?: number;
}

/** Marks one notification read, or all of them when no id is given. */
export const markReadAction = async (notificationId?: string): Promise<ReadState> => {
  const actor = await requireManufacturer('/notifications');
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
