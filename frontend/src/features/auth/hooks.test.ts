import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock user data
const mockUser = {
  id: "user-123",
  email: "test@example.com",
  app_metadata: {},
  user_metadata: {},
  aud: "authenticated",
  created_at: "2024-01-01T00:00:00.000Z",
};

// Hoist mock variables so they're available in vi.mock factories
const { mockUnsubscribe, mockGetUser, mockOnAuthStateChange } = vi.hoisted(() => ({
  mockUnsubscribe: vi.fn(),
  mockGetUser: vi.fn(),
  mockOnAuthStateChange: vi.fn(),
}));

const mockSubscription = { unsubscribe: mockUnsubscribe };

// Mock auth state change callback holder
let authStateChangeCallback:
  | ((event: string, session: { user: typeof mockUser } | null) => void)
  | null = null;

// Mock module
vi.mock("@/core/supabase/client", () => ({
  createClient: () => ({
    auth: {
      getUser: mockGetUser,
      onAuthStateChange: mockOnAuthStateChange,
    },
  }),
}));

// Import after mocking (vi.mock is auto-hoisted)
import { useUser } from "./hooks";

describe("useUser", () => {
  beforeEach(() => {
    mockGetUser.mockClear();
    mockOnAuthStateChange.mockClear();
    mockUnsubscribe.mockClear();
    authStateChangeCallback = null;

    // Reset to default implementation
    mockGetUser.mockImplementation(() =>
      Promise.resolve({ data: { user: mockUser }, error: null }),
    );
    mockOnAuthStateChange.mockImplementation((callback: typeof authStateChangeCallback) => {
      authStateChangeCallback = callback;
      return { data: { subscription: mockSubscription } };
    });
  });

  afterEach(() => {
    authStateChangeCallback = null;
  });

  it("returns loading state initially", () => {
    const { result } = renderHook(() => useUser());

    expect(result.current.isLoading).toBe(true);
    expect(result.current.user).toBeNull();
    expect(result.current.isAuthenticated).toBe(false);
  });

  it("returns user after loading", async () => {
    const { result } = renderHook(() => useUser());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.user).toEqual(mockUser);
    expect(result.current.isAuthenticated).toBe(true);
  });

  it("returns undefined user when not authenticated", async () => {
    mockGetUser.mockImplementationOnce(
      () => Promise.resolve({ data: { user: null }, error: null }) as never,
    );

    const { result } = renderHook(() => useUser());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.user).toBeUndefined();
    expect(result.current.isAuthenticated).toBe(false);
  });

  it("subscribes to auth state changes", async () => {
    const { result } = renderHook(() => useUser());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(mockOnAuthStateChange).toHaveBeenCalled();
  });

  it("updates user on auth state change (sign in)", async () => {
    mockGetUser.mockImplementationOnce(
      () => Promise.resolve({ data: { user: null }, error: null }) as never,
    );

    const { result } = renderHook(() => useUser());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.user).toBeUndefined();

    // Simulate sign in via auth state change
    act(() => {
      if (authStateChangeCallback) {
        authStateChangeCallback("SIGNED_IN", { user: mockUser });
      }
    });

    expect(result.current.user).toEqual(mockUser);
    expect(result.current.isAuthenticated).toBe(true);
  });

  it("updates user on auth state change (sign out)", async () => {
    const { result } = renderHook(() => useUser());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.user).toEqual(mockUser);

    // Simulate sign out via auth state change
    act(() => {
      if (authStateChangeCallback) {
        authStateChangeCallback("SIGNED_OUT", null);
      }
    });

    expect(result.current.user).toBeUndefined();
    expect(result.current.isAuthenticated).toBe(false);
  });

  it("unsubscribes on unmount", async () => {
    const { result, unmount } = renderHook(() => useUser());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    unmount();

    expect(mockUnsubscribe).toHaveBeenCalled();
  });
});
