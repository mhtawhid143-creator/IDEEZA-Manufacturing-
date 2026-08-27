import Link from 'next/link';
import { Button, Card, Heading, Text } from '@ideeza/ui';

/**
 * Shown for a path that has no rule in the shared route table.
 *
 * Adding a page without deciding who may see it lands here rather than
 * rendering, which is what makes the route table the single answer to "who can
 * read this".
 */
const UnavailablePage = () => (
  <main className="flex min-h-dvh items-center justify-center bg-canvas px-4">
    <Card className="max-w-lg text-center">
      <Heading level={1} className="text-xl">
        This route is not part of the manufacturer panel
      </Heading>
      <Text tone="muted" className="mt-2">
        Every page here is listed in the shared route table with the capability it
        needs. A path that is not in it is refused instead of guessed at.
      </Text>
      <Link href="/dashboard" className="mt-6 inline-flex">
        <Button>Back to the dashboard</Button>
      </Link>
    </Card>
  </main>
);

export default UnavailablePage;
