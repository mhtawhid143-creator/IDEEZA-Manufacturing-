import Link from 'next/link';
import { Button, Card, Heading, Text } from '@ideeza/ui';

/**
 * Shown for a path that has no rule in the shared route table.
 *
 * Routing fails closed on purpose: a page added without deciding who may see it
 * is refused rather than served.
 */
const UnavailablePage = () => (
  <main className="flex min-h-dvh items-center justify-center bg-canvas px-4">
    <Card className="max-w-lg text-center">
      <Heading level={1} className="text-xl">
        This page is not available
      </Heading>
      <Text tone="muted" className="mt-2">
        The address does not match any route on the buyer surface.
      </Text>
      <Link href="/manufacturing" className="mt-6 inline-flex">
        <Button>Back to manufacturing</Button>
      </Link>
    </Card>
  </main>
);

export default UnavailablePage;
