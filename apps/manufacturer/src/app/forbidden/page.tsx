import Link from 'next/link';
import { Button, Card, Heading, Text } from '@ideeza/ui';
import { signOutAction } from '../auth/actions.js';

export const dynamic = 'force-dynamic';

/**
 * Reached when a signed-in account cannot use this surface: a buyer or
 * operations account, or a manufacturer member who does not yet belong to a
 * shop. All three are refused here rather than shown an empty panel.
 */
const ForbiddenPage = () => (
  <main className="flex min-h-dvh items-center justify-center bg-canvas px-4">
    <Card className="max-w-lg text-center">
      <Heading level={1} className="text-xl">
        This account cannot use the manufacturer panel
      </Heading>
      <Text tone="muted" className="mt-2">
        The panel serves manufacturer accounts that belong to a shop. Buyer and
        IDEEZA operations accounts have their own applications, and a member with
        no shop has nothing to act for — IDEEZA adds the membership.
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
