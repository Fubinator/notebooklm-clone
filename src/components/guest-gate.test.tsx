import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { GuestGate } from "./guest-gate";

const mocks = vi.hoisted(() => ({
  refresh: vi.fn(),
  signInAnonymously: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mocks.refresh }),
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: { signInAnonymously: mocks.signInAnonymously },
  }),
}));

describe("Guest entry", () => {
  beforeEach(() => vi.clearAllMocks());

  it("creates a Guest and refreshes into the private workspace", async () => {
    mocks.signInAnonymously.mockResolvedValue({ error: null });

    render(<GuestGate />);

    expect(screen.getByText("Preparing your desk")).toBeInTheDocument();
    await waitFor(() => expect(mocks.signInAnonymously).toHaveBeenCalledOnce());
    expect(mocks.refresh).toHaveBeenCalledOnce();
  });

  it("offers a retry when Guest creation is rate limited", async () => {
    mocks.signInAnonymously.mockResolvedValue({
      error: { status: 429 },
    });

    render(<GuestGate />);

    expect(
      await screen.findByText(
        "Guest access is busy. Wait a moment and try again.",
      ),
    ).toBeInTheDocument();
    expect(mocks.refresh).not.toHaveBeenCalled();
  });
});
