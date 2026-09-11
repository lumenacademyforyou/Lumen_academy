import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

// F1 tooling smoke test — proves the Vitest + RTL + jsdom pipeline actually
// renders JSX and jest-dom matchers are wired up, before any real component
// test depends on it working.
describe('frontend test tooling', () => {
  it('renders JSX and exposes jest-dom matchers', () => {
    render(<div data-testid="probe">hello</div>);
    expect(screen.getByTestId('probe')).toHaveTextContent('hello');
  });
});
