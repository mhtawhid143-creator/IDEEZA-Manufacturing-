/**
 * The guided tours: what each one shows, and where each stop stands.
 *
 * Editorial content, like `tutorials.ts` — nobody in a shop writes it, no
 * status turns on it, and no query needs scoping to an actor — so it lives as a
 * typed module rather than a table. Only how far somebody has walked is stored
 * (`TourProgress`), and that belongs to the person.
 *
 * The difference between this and the tutorial is worth keeping: the tutorial is
 * something to read, and a tour is being shown around. Every stop below stands
 * on a real screen and lights up a real control. So a stop names a `target` that
 * exists in the panel, and when it does not — an empty inbox has no first row —
 * the stop says what would be there instead of pointing at nothing.
 */
import type { IconName } from '@ideeza/ui';

export interface TourStop {
  readonly id: string;
  /** The coachmark's heading: an instruction, or the fact being taught. */
  readonly title: string;
  readonly body: string;
  /**
   * Where the stop stands.
   *
   * Left out on purpose for a stop that happens wherever the walker already is:
   * a tour that asks somebody to open one of their own orders cannot know its
   * id, and teaching them to open it is better than teleporting them into one.
   */
  readonly path?: string;
  /** A selector for the control to light up. Absent means "the whole screen". */
  readonly target?: string;
  /** Which side of the target the coachmark prefers, when there is room. */
  readonly place?: 'top' | 'right' | 'bottom' | 'left';
  /**
   * What to say when the target is not on this screen.
   *
   * Every stop that points at data a shop may not have yet carries one, because
   * "nothing to show" is a state a tour walks through more often than any other.
   */
  readonly whenMissing?: string;
}

export interface Tour {
  readonly id: string;
  readonly title: string;
  /** One line, in the second person: what you can do once you have walked it. */
  readonly promise: string;
  readonly icon: IconName;
  readonly minutes: number;
  readonly stops: readonly TourStop[];
}

export const TOURS: readonly Tour[] = Object.freeze<readonly Tour[]>([
  {
    id: 'shop-setup',
    title: 'Set your shop up',
    promise: 'Fill in the profile a buyer reads before deciding to send you work.',
    icon: 'shop',
    minutes: 6,
    stops: [
      {
        id: 'profile',
        title: 'This page is what a buyer sees',
        body: 'Everything on your profile is public to buyers browsing for a shop. It is the whole of what most of them will know about you when they decide whether to send you a request.',
        path: '/profile',
        target: '[data-tour="profile-head"]',
        place: 'bottom',
      },
      {
        id: 'tabs',
        title: 'Seven tabs, and buyers read them in this order',
        body: 'About, then what you can make, then the machines behind it. A profile that stops after About tells a buyer nothing they can match a job against.',
        path: '/profile',
        target: '[data-tour="profile-tabs"]',
        place: 'bottom',
      },
      {
        id: 'capability',
        title: 'Say what you can actually make',
        body: 'Open this tab. A capability sheet is one kind of work with its real limits on it — layer count, finish, tolerance — and it is what the platform matches a request against. An empty sheet means requests go to somebody else.',
        path: '/profile',
        target: '#tab-capabilities',
        place: 'bottom',
        whenMissing:
          'The Capabilities tab is on the profile screen — this stop is about what goes in it.',
      },
      {
        id: 'machines',
        title: 'The machines behind the claim',
        body: 'Open this one next. A machine card carries the processes it runs, the tolerance it holds and how long it takes — and buyers with a tight tolerance filter on exactly that.',
        path: '/profile',
        target: '#tab-machines',
        place: 'bottom',
        whenMissing:
          'Machine & process is the third tab on the profile screen.',
      },
      {
        id: 'certifications',
        title: 'Certifications buyers are told to ask for',
        body: 'This tab holds both: the services you sell, and the certificates behind them. A certificate you add sits as pending until IDEEZA has seen the document — and medical or automotive buyers will not read past it without one.',
        path: '/profile',
        target: '#tab-services',
        place: 'bottom',
        whenMissing:
          'Service & certification is the sixth tab on the profile screen.',
      },
      {
        id: 'company',
        title: 'The details that go on an invoice',
        body: 'Your registered name, address and tax number live in Settings rather than on the public profile, because they belong on the paperwork and not in a search result.',
        path: '/settings?pane=company',
        target: '[data-tour="settings-pane"] h2',
        place: 'top',
      },
    ],
  },
  {
    id: 'first-quote',
    title: 'Answer your first request',
    promise: 'Read a request, price it, and follow the quote until it becomes an order.',
    icon: 'feed',
    minutes: 7,
    stops: [
      {
        id: 'inbox',
        title: 'Requests arrive here',
        body: 'A buyer sends a product to be manufactured and the platform routes it to the shops that can make it. You see a request because your capabilities matched it — never because you searched for it.',
        path: '/rfqs',
        target: '[data-tour="nav-rfqs"]',
        place: 'right',
      },
      {
        id: 'row',
        title: 'What a row tells you before you open it',
        body: 'The quantity, the process, when the buyer needs it and how long you have to answer. Enough to decide whether it is worth your afternoon.',
        path: '/rfqs',
        target: '[data-tour="rfq-list"] tbody tr:first-child',
        place: 'top',
        whenMissing:
          'Your inbox has no requests in it right now. When one arrives it lands in this list, with the quantity and the deadline on the row.',
      },
      {
        id: 'open',
        title: 'Open one and price it',
        body: 'Inside a request you get the specification, the bill of materials and the files. Your quote is a price, a lead time, and how long you will hold them to it.',
        path: '/rfqs',
        target: '[data-tour="rfq-list"] tbody tr:first-child a',
        place: 'right',
        whenMissing:
          'With no request to open: a quote is a price, a lead time, and the date the price expires. You can also offer a part you already stock in place of one the buyer specified.',
      },
      {
        id: 'quotes',
        title: 'Every quote you send is tracked here',
        body: 'Sent, then seen, then accepted or declined. A quote nobody has answered by its expiry date lapses on its own — you do not have to chase it.',
        path: '/quotes',
        target: '[data-tour="nav-quotes"]',
        place: 'right',
      },
      {
        id: 'confidential',
        title: 'What the other shops can see: nothing',
        body: 'Quotes are confidential. No shop is shown another shop’s price, and neither the count of who else was asked nor their numbers reach you.',
        path: '/quotes',
        target: '[data-tour="quote-list"] tbody tr:first-child',
        place: 'top',
        whenMissing:
          'You have not sent a quote yet. When you do, it appears in this list, and only you and the buyer ever see its price.',
      },
      {
        id: 'accepted',
        title: 'Accepted is not yet an order',
        body: 'The buyer accepts your quote, and the platform then secures their payment. Only once the money is held does an order exist and production begin — so an order in your list is always an order that is paid for.',
        path: '/orders',
        target: '[data-tour="nav-orders"]',
        place: 'right',
      },
    ],
  },
  {
    id: 'production',
    title: 'Run the job',
    promise: 'Move an order through production and hand it over so the money releases.',
    icon: 'factory',
    minutes: 6,
    stops: [
      {
        id: 'list',
        title: 'Your orders, and what is due',
        body: 'Every order here has its payment already secured. This list is the shop floor’s work queue.',
        path: '/orders',
        target: '[data-tour="order-list"] tbody tr:first-child',
        place: 'top',
        whenMissing:
          'No orders yet. They arrive on their own once a buyer accepts one of your quotes and pays for it.',
      },
      {
        id: 'status',
        title: 'The status is the buyer’s only view of you',
        body: 'It is not a label you type. It moves when you do something real — accept the job, start production, hand it to the courier — and the buyer sees each move as it happens.',
        path: '/orders',
        target: '[data-tour="order-list"] [data-tour="order-status"]',
        place: 'right',
        whenMissing:
          'Each order carries a status: in production, ready, shipped, delivered. It changes when you do the work, never by being edited.',
      },
      {
        id: 'open-one',
        title: 'Open one of your orders now',
        body: 'The rest of this tour happens inside an order. Press this menu and choose “View order details” — the tour will wait here for you.',
        path: '/orders',
        target: '[data-tour="order-list"] tbody tr:first-child button[aria-label^="Actions"]',
        place: 'left',
        whenMissing:
          'With no order to open: an order page holds the specification, the files, the production stages and the money.',
      },
      {
        id: 'stages',
        title: 'Production stages are how progress gets reported',
        body: 'Move a stage on as it finishes. The buyer is not sent a message for each one — they watch this, which is why an accurate stage is worth more than an update in a chat.',
        target: '[data-tour="production-stages"]',
        place: 'top',
        whenMissing:
          'Open one of your orders to see this. Inside, the production stages are the list you move as the work finishes, and the buyer follows it live.',
      },
      {
        id: 'delivery',
        title: 'The buyer confirms, and only then does the money move',
        body: 'You mark it shipped; the buyer confirms delivery. That confirmation — or the review window running out — is what releases the payment from escrow into your balance.',
        target: '[data-tour="order-money"]',
        place: 'top',
        whenMissing:
          'Inside an order, the money panel shows what is held and what has been released. Delivery confirmed by the buyer is what moves it.',
      },
    ],
  },
  {
    id: 'money',
    title: 'Get paid',
    promise: 'Read your balance honestly, and take money out of it.',
    icon: 'payouts',
    minutes: 5,
    stops: [
      {
        id: 'payouts',
        title: 'Held and available are different money',
        body: 'Held is a buyer’s payment sitting in escrow against an order that is not finished. Available is yours. The two are never added together, because only one of them can be withdrawn.',
        path: '/payouts',
        target: '[data-tour="payout-balance"]',
        place: 'bottom',
        whenMissing:
          'This page separates what is held in escrow from what is available to withdraw. Nothing is held until you have an order in progress.',
      },
      {
        id: 'release',
        title: 'What actually releases a payment',
        body: 'Delivery confirmed, the review window expiring, an inspection accepted, an agreed partial refund, or a resolved dispute. Nothing else, and never a request from you.',
        path: '/payouts',
        target: '[data-tour="payout-list"] tbody tr:first-child',
        place: 'top',
        whenMissing:
          'Each payout row names the order it came from and the trigger that released it, so a balance can always be traced back to a job.',
      },
      {
        id: 'account',
        title: 'Where it goes when you withdraw',
        body: 'Add the bank account or wallet once, here. IDEEZA keeps the last four digits of the number and nothing else of it.',
        path: '/settings?pane=paid',
        target: '[data-tour="settings-pane"] h2',
        place: 'top',
      },
      {
        id: 'withdraw',
        title: 'Withdrawing is a request, not a transfer',
        body: 'You ask, and IDEEZA pays it out. Until it is paid the request sits as pending, and the amount stays in your balance rather than vanishing from it.',
        path: '/payouts',
        target: '[data-tour="payout-withdraw"]',
        place: 'left',
        whenMissing:
          'The withdraw control appears once you have an available balance. Until then there is nothing to ask for.',
      },
      {
        id: 'activity',
        title: 'Everything that happened, in order',
        body: 'Every move on your account is written down as it happens and cannot be edited afterwards — not by you, and equally not by us. If a number ever looks wrong, this is where the answer is.',
        path: '/settings?pane=activity',
        target: '[data-tour="settings-pane"] h2',
        place: 'top',
      },
    ],
  },
  {
    id: 'trouble',
    title: 'When a buyer is unhappy',
    promise: 'Answer a refund claim, and know what a dispute does to your money.',
    icon: 'alert',
    minutes: 5,
    stops: [
      {
        id: 'notice',
        title: 'You are told on the dashboard, not by email alone',
        body: 'A refund claim or an open case shows here the moment it is raised, because it holds your payout — and a held payout is worth interrupting you for.',
        path: '/dashboard',
        target: '[data-tour="dashboard-notice"]',
        place: 'bottom',
        whenMissing:
          'Nothing is open against you at the moment. If a buyer raises a claim, a notice appears at the top of this dashboard with a link straight to the case.',
      },
      {
        id: 'claim',
        title: 'A claim arrives on the order it belongs to',
        body: 'Not in a separate inbox. It sits on the order as a banner carrying the amount, the buyer’s reason, and the date you have to answer by.',
        path: '/orders',
        target: '[data-tour="order-list"] tbody tr:first-child',
        place: 'top',
        whenMissing:
          'A claim appears as a banner on the order it concerns, with the amount asked for, the buyer’s reason, and your deadline to answer.',
      },
      {
        id: 'answer',
        title: 'Two answers, and both are final',
        body: 'Give the refund — in full, or an amount you name — and it is settled. Or challenge it, which opens a dispute for IDEEZA to decide. Saying nothing is the one answer that helps you least.',
        path: '/orders',
        target: '[data-tour="order-list"] tbody tr:first-child',
        place: 'top',
        whenMissing:
          'Answering a claim means either giving a refund, whole or partial, or challenging it with your account of what happened. A challenge becomes a dispute.',
      },
      {
        id: 'case',
        title: 'A dispute is decided on what is written down',
        body: 'Both sides put statements and files on the case; IDEEZA reads them and decides. Your inspection records and photographs are worth more here than any argument.',
        path: '/orders',
        target: '[data-tour="order-list"] tbody tr:first-child',
        place: 'top',
        whenMissing:
          'Inside a case, each side adds statements and attachments. IDEEZA decides on that record, and the decision is what moves the money.',
      },
      {
        id: 'report',
        title: 'If the problem is us, say so here',
        body: 'A buyer behaving badly, a screen that will not work, a number that looks wrong. This goes to IDEEZA rather than to the buyer, and it is no part of any dispute.',
        path: '/dashboard',
        target: '[data-tour="nav-report"]',
        place: 'right',
      },
    ],
  },
]);

export const findTour = (tourId: string): Tour | undefined =>
  TOURS.find((tour) => tour.id === tourId);

/**
 * The address of one stop.
 *
 * A tour's position lives in the query string, so this is the whole of how a
 * tour is entered, resumed or linked to — the index and the runner both build
 * their addresses here rather than each writing the same string twice.
 *
 * `whereTheyAre` stands in for a stop that declares no path of its own: those
 * happen wherever the walker already is.
 */
export const stopHref = (tour: Tour, index: number, whereTheyAre = '/dashboard'): string => {
  const [path, query] = (tour.stops[index]?.path ?? whereTheyAre).split('?');
  const search = new URLSearchParams(query ?? '');
  search.set('tour', tour.id);
  search.set('stop', String(index));
  return `${path ?? whereTheyAre}?${search.toString()}`;
};

/** Every stop in every tour, for the index's own summary line. */
export const TOTAL_STOPS = TOURS.reduce((sum, tour) => sum + tour.stops.length, 0);
