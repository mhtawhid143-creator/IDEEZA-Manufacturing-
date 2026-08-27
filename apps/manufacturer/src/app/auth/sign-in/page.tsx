import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Card, Heading, Tag, Text, buttonAppearance } from '@ideeza/ui';
import { directSignInAccounts, directSignInEnabled } from '@/lib/direct-sign-in.js';
import { SignInForm } from './sign-in-form.js';

export const dynamic = 'force-dynamic';

const SignInPage = async ({
  searchParams,
}: {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}) => {
  const params = await searchParams;
  const rawNext = params['next'];
  const next = typeof rawNext === 'string' && rawNext.startsWith('/') ? rawNext : '/dashboard';
  const pick = params['pick'] === '1';

  // Review mode: there is nothing to type. Arriving here goes straight into the
  // panel as the seeded shop owner; `?pick=1` — which is where signing out
  // lands — shows the accounts instead, so the second shop is one click away.
  const review = directSignInEnabled();
  const accounts = review ? await directSignInAccounts() : [];
  if (review && !pick && accounts.length > 0) {
    redirect(`/auth/enter?next=${encodeURIComponent(next)}`);
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-canvas px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center gap-2">
          <span
            className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-brand text-sm font-bold text-on-brand"
            aria-hidden
          >
            ID
          </span>
          <span className="text-lg font-bold tracking-wide text-heading">IDEEZA</span>
          <span className="ml-1 rounded-full bg-brand-weak px-2 py-0.5 text-xs font-semibold text-brand">
            Manufacturer
          </span>
        </div>

        <Card>
          <Heading level={1} className="text-xl">
            {review ? 'Pick a shop' : 'Sign in'}
          </Heading>
          <Text tone="muted" className="mt-1">
            {review
              ? 'This panel is in review mode: no password, one click into the shop you want to look at.'
              : 'Read the requests routed to your shop, quote them, and run the orders you win.'}
          </Text>

          {review ? (
            <ul aria-label="Shop accounts" className="mt-6 flex flex-col gap-2">
              {accounts.length === 0 ? (
                <li>
                  <Text tone="muted" size="sm">
                    No shop members are seeded in this database, so there is nothing
                    to enter as.
                  </Text>
                </li>
              ) : (
                accounts.map((account) => (
                  <li key={account.email}>
                    <Link
                      href={`/auth/enter?as=${encodeURIComponent(account.email)}&next=${encodeURIComponent(next)}`}
                      className="flex items-center justify-between gap-3 rounded-lg border border-line px-4 py-3 transition-colors hover:bg-raised focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold text-heading">
                          {account.shopName}
                        </span>
                        <Text tone="muted" size="xs">
                          {account.memberName} · {account.email}
                        </Text>
                      </span>
                      {account.owner && <Tag tone="brand">Owner</Tag>}
                    </Link>
                  </li>
                ))
              )}
            </ul>
          ) : (
            <div className="mt-6">
              <SignInForm next={next} />
            </div>
          )}
        </Card>

        <Text tone="muted" size="xs" className="mt-4 text-center">
          {review ? (
            <>
              Review mode is on because <code>REVIEW_DIRECT_SIGN_IN</code> is set for
              this process. It only enters accounts that already exist in this
              database, and the session it makes is an ordinary one — every guard
              still applies. Unset it and the password form comes back.
            </>
          ) : (
            <>
              Manufacturer accounts are provisioned by IDEEZA, and a member has to
              belong to a shop before this panel has anything to show. The component
              gallery is readable without an account at{' '}
              <Link href="/design-system" className="font-medium text-brand hover:underline">
                /design-system
              </Link>
              .
            </>
          )}
        </Text>

        {review && (
          <Text tone="muted" size="xs" className="mt-2 block text-center">
            <Link
              href="/design-system"
              className={buttonAppearance({ variant: 'ghost', size: 'sm' })}
            >
              Component gallery
            </Link>
          </Text>
        )}
      </div>
    </main>
  );
};

export default SignInPage;
