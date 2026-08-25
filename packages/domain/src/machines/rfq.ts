import {
  RFQ_RECIPIENT_STATUSES,
  RFQ_STATUSES,
  type RfqRecipientStatus,
  type RfqStatus,
} from '../status/index.js';
import type { StateMachine } from './state-machine.js';

export const rfqMachine: StateMachine<RfqStatus, undefined> = {
  name: 'Rfq',
  initial: 'draft',
  states: RFQ_STATUSES,
  transitions: {
    draft: ['submitted', 'withdrawn'],
    submitted: ['closed', 'withdrawn'],
    closed: [],
    withdrawn: [],
  },
  terminal: ['closed', 'withdrawn'],
};

/**
 * Declining is only ever a recipient-level outcome, and it is valid precisely
 * because no order exists while a request is still being quoted.
 */
export const rfqRecipientMachine: StateMachine<RfqRecipientStatus, undefined> = {
  name: 'RfqRecipient',
  initial: 'routed',
  states: RFQ_RECIPIENT_STATUSES,
  transitions: {
    routed: ['viewed', 'declined', 'expired'],
    viewed: ['quoted', 'declined', 'expired'],
    quoted: ['expired'],
    declined: [],
    expired: [],
  },
  terminal: ['declined', 'expired'],
};
