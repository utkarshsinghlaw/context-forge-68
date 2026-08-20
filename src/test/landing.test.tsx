import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Route } from '../routes/index';

// Best Practice: Mock external boundaries (like routing) when testing components in isolation
vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => (config: any) => config.component,
  Link: ({ children, to, ...props }: any) => <a href={to} {...props}>{children}</a>,
}));

describe('Landing Page E2E flows', () => {
  it('renders the main E2E elements and calls to action', () => {
    // 1. Render the component in JSDOM (simulates browser)
    // We cast to any because we mocked createFileRoute to directly return the component for easy testing
    const Landing = Route as any;
    render(<Landing />);

    // 2. Best Practice: Query elements by ARIA roles (Test how users experience the app, not implementation details)
    const heading = screen.getByRole('heading', { 
      name: /the operating system for knowledge work/i 
    });
    expect(heading).toBeInTheDocument();

    // 3. Verify interactive elements exist
    const getStartedLinks = screen.getAllByRole('link', { name: /get started/i });
    expect(getStartedLinks.length).toBeGreaterThan(0);
    expect(getStartedLinks[0]).toHaveAttribute('href', '/auth');

    // 4. Test that primary CTAs are available to the user
    const openWorkspaceLink = screen.getByRole('link', { name: /open your workspace/i });
    expect(openWorkspaceLink).toBeInTheDocument();
  });
});
