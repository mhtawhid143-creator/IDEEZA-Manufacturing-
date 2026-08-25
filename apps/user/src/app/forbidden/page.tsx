import Link from 'next/link';
import { Button, Card, Heading, Text } from '@ideeza/ui';
import { signOutAction } from '../auth/actions.js';

export const dynamic = 'force-dynamic';

/**
 * Reached when a signed-in account is not a buyer. The manufacturer and
 * operations surfaces are separate applications, so there is nothing to show
 * here beyond the explanation and a way out.
 */
const ForbiddenPage = () => (
  <main className="flex min-h-dvh items-center justify-center bg-canvas px-4">
    <Card className="max-w-lg text-center">
      <Heading level={1} className="text-xl">
        This account cannot use the buyer app
      </Heading>
      <Text tone="muted" className="mt-2">
        The buyer app serves buyer accounts. Manufacturer and IDEEZA operations
        accounts have their own applications.
      </Text>
      <form action={signOutAction} className="mt-6 flex justify-center gap-2">
        <Button type="submit" variant="secondary">
          Sign out
        </Button>
        <Link href="/design-system">
          <Button variant="ghost">View the design system</Button>
        </Link>
      </form>
    </Card>
  </main>
);

export default ForbiddenPage;
