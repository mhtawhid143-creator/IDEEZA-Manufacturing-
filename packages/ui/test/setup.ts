import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// The suite runs without vitest globals, so the automatic unmount has to be
// wired up explicitly; otherwise one test's DOM leaks into the next.
afterEach(() => {
  cleanup();
});
