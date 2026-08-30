'use client';

import { ErrorState } from '@ideeza/ui';

/** Route level error boundary, rendered with the design system error state. */
const ErrorBoundary = ({ reset }: { readonly error: Error; readonly reset: () => void }) => (
  <main className="flex min-h-dvh items-center justify-center bg-bg-page px-4">
    <div className="w-full max-w-lg">
      <ErrorState onRetry={reset} />
    </div>
  </main>
);

export default ErrorBoundary;
