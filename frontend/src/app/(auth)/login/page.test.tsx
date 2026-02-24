import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Hoist mock variables
const { mockUseActionState, mockLogin } = vi.hoisted(() => ({
  mockUseActionState: vi.fn(),
  mockLogin: vi.fn(() => Promise.resolve({})),
}));

// Mock the actions module
vi.mock("./actions", () => ({
  login: mockLogin,
}));

// Mock useActionState
vi.mock("react", async () => {
  const actual = await vi.importActual("react");
  return {
    ...actual,
    useActionState: mockUseActionState,
  };
});

// Import after mocking (vi.mock is auto-hoisted)
import LoginPage from "./page";

describe("LoginPage", () => {
  beforeEach(() => {
    mockUseActionState.mockImplementation((action: unknown, initialState: { error?: string }) => [
      initialState,
      action,
      false,
    ]);
  });

  it("renders login form with email and password fields", () => {
    render(<LoginPage />);

    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /sign in/i })).toBeInTheDocument();
  });

  it("renders login title and description", () => {
    render(<LoginPage />);

    expect(screen.getByText("Login")).toBeInTheDocument();
    expect(screen.getByText(/enter your email below/i)).toBeInTheDocument();
  });

  it("renders link to register page", () => {
    render(<LoginPage />);

    const registerLink = screen.getByRole("link", { name: /register/i });
    expect(registerLink).toBeInTheDocument();
    expect(registerLink).toHaveAttribute("href", "/register");
  });

  it("shows error message when state has error", () => {
    mockUseActionState.mockReturnValue([{ error: "Invalid credentials" }, vi.fn(), false]);

    render(<LoginPage />);

    expect(screen.getByText("Invalid credentials")).toBeInTheDocument();
  });
});
