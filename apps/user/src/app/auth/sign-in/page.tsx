import Link from 'next/link';
import { Card, Heading, Text } from '@ideeza/ui';
import { SignInForm } from './sign-in-form.js';

export const dynamic = 'force-dynamic';

const SignInPage = async ({
  searchParams,
}: {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}) => {
  const params = await searchParams;
  const rawNext = params['next'];
  const next = typeof rawNext === 'string' && rawNext.startsWith('/') ? rawNext : '/manufacturing';

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
        </div>

        <Card>
          <Heading level={1} className="text-xl">
            Sign in
          </Heading>
          <Text tone="muted" className="mt-1">
            Send a product to manufacture, compare quotes and track your order.
          </Text>
          <div className="mt-6">
            <SignInForm next={next} />
          </div>
        </Card>

        <Text tone="muted" size="xs" className="mt-4 text-center">
          Accounts are provisioned by IDEEZA. The component gallery is readable
          without an account at{' '}
          <Link href="/design-system" className="font-medium text-brand hover:underline">
            /design-system
          </Link>
          .
        </Text>
      </div>
    </main>
  );
};

export default SignInPage;
