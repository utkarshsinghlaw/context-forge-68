import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MeetingsPanel } from "./meetings-panel";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// Mock the TanStack Router
const mockNavigate = vi.fn();
vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => mockNavigate,
  Link: ({ children, to }: any) => <a href={to}>{children}</a>,
}));

// Mock Supabase
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          order: vi.fn().mockResolvedValue({
            data: [
              {
                id: "meeting-123",
                title: "Test Meeting",
                created_at: new Date().toISOString(),
                summary: "This is a test summary",
              },
            ],
            error: null,
          }),
        })),
      })),
      insert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn().mockResolvedValue({
            data: { id: "new-meeting-456" },
            error: null,
          }),
        })),
      })),
    })),
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: "user-1" } },
      }),
    },
  },
}));

const queryClient = new QueryClient();

describe("MeetingsPanel", () => {
  it("renders meetings from the database", async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <MeetingsPanel workspaceId="workspace-1" />
      </QueryClientProvider>
    );

    // Wait for the mock query to resolve and display the title
    await waitFor(() => {
      expect(screen.getByText("Test Meeting")).toBeInTheDocument();
    });
    
    // Summary should also be rendered
    expect(screen.getByText("This is a test summary")).toBeInTheDocument();
  });

  it("handles creating a new meeting", async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <MeetingsPanel workspaceId="workspace-1" />
      </QueryClientProvider>
    );

    // Click the New Meeting button
    const createBtn = screen.getByRole("button", { name: /new meeting/i });
    fireEvent.click(createBtn);

    // Should call the navigate mock with the new meeting ID
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith({
        to: "/w/$workspaceId/meetings/$meetingId",
        params: { workspaceId: "workspace-1", meetingId: "new-meeting-456" },
      });
    });
  });
});
