/**
 * Navigation that actually arrives.
 *
 * A client navigation issued straight after a server action is occasionally
 * dropped: the action resolves, the push is made, and the browser stays where it
 * was — which on this platform can mean a buyer has paid, or raised a claim, and
 * sees no sign of it. It has been reproduced on a loaded machine often enough to
 * design for.
 *
 * So the push is made first, because it is the fast, soft navigation that keeps
 * the client state, and a moment later the outcome is checked. If nothing moved
 * at all, the browser is sent the reliable way. The "nothing moved" test is
 * exact — the address must be unchanged from where the push started — so a
 * visitor who has since gone somewhere else is never dragged back.
 */
export interface Pushable {
  readonly push: (href: string) => void;
}

const FALLBACK_DELAY_MS = 1_500;

const addressNow = (): string =>
  `${window.location.pathname}${window.location.search}`;

export const goTo = (router: Pushable, href: string): void => {
  const from = addressNow();
  router.push(href);

  window.setTimeout(() => {
    if (addressNow() === from && from !== href) {
      window.location.assign(href);
    }
  }, FALLBACK_DELAY_MS);
};
