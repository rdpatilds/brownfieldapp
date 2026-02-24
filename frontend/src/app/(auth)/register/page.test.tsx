import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Hoist mock variables
const { mockUseActionState, mockRegister } = vi.hoisted(() => ({
  mockUseActionState: vi.fn(),
  mockRegister: vi.fn(() => Promise.resolve({})),
}));

// Mock the actions module
vi.mock("./actions", () => ({
  register: mockRegister,
}));

// Mock useActionState with default state
vi.mock("react", async () => {
  const actual = await vi.importActual("react");
  return {
    ...actual,
    useActionState: mockUseActionState,
  };
});

// Import after mocking (vi.mock is auto-hoisted)
import RegisterPage from "./page";

describe("RegisterPage", () => {
  beforeEach(() => {
    mockUseActionState.mockImplementation((action: unknown, initialState: { error?: string }) => [
      initialState,
      action,
      false,
    ]);
  });

  it("renders registration form with all fields", () => {
    render(<RegisterPage />);

    expect(screen.getByLabelText(/^email$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/confirm password/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /create account/i })).toBeInTheDocument();
  });

  it("renders registration title and description", () => {
    render(<RegisterPage />);

    expect(screen.getByText("Register")).toBeInTheDocument();
    expect(screen.getByText(/create an account/i)).toBeInTheDocument();
  });

  it("renders link to login page", () => {
    render(<RegisterPage />);

    const loginLink = screen.getByRole("link", { name: /login/i });
    expect(loginLink).toBeInTheDocument();
    expect(loginLink).toHaveAttribute("href", "/login");
  });

  it("shows error message when state has error", () => {
    mockUseActionState.mockReturnValue([{ error: "User already exists" }, vi.fn(), false]);

    render(<RegisterPage />);

    expect(screen.getByText("User already exists")).toBeInTheDocument();
  });

  it("shows success message when email confirmation required", () => {
    mockUseActionState.mockReturnValue([
      { success: true, message: "Check your email for a confirmation link." },
      vi.fn(),
      false,
    ]);

    render(<RegisterPage />);

    expect(screen.getByText("Check your email")).toBeInTheDocument();
    expect(screen.getByText("Check your email for a confirmation link.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /back to login/i })).toBeInTheDocument();
  });

  it("shows loading state when pending", () => {
    mockUseActionState.mockReturnValue([{}, vi.fn(), true]); // isPending = true

    render(<RegisterPage />);

    expect(screen.getByRole("button", { name: /creating account/i })).toBeInTheDocument();
    expect(screen.getByRole("button")).toBeDisabled();
  });
});
