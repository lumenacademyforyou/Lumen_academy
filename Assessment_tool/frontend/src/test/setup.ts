import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// Runs after every test so one component's leftover DOM never leaks into the
// next test's assertions (React Testing Library doesn't do this
// automatically outside of a test-framework-specific plugin).
afterEach(() => {
  cleanup();
});
