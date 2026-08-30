import Link from 'next/link';
import { Button, Card, Heading, Text } from '@ideeza/ui';

const NotFound = () => (
  <main className="flex min-h-dvh items-center justify-center bg-bg-page px-4">
    <Card className="max-w-lg text-center">
      <Heading level={1} className="text-xl">
        Page not found
      </Heading>
      <Text tone="muted" className="mt-2">
        The page you asked for does not exist on the buyer surface.
      </Text>
      <Link href="/manufacturing" className="mt-6 inline-flex">
        <Button>Back to manufacturing</Button>
      </Link>
    </Card>
  </main>
);

export default NotFound;
