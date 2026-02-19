import { expect, test } from "@playwright/test";

const TEST_EMAIL = process.env["TEST_EMAIL"] ?? "e2e-billing@test.com";
const TEST_PASSWORD = process.env["TEST_PASSWORD"] ?? "testpassword123";

test.describe("Auth Flow", () => {
  test("login with valid credentials redirects to dashboard", async ({ page }) => {
    await page.goto("/login");

    // Fill in credentials
    await page.getByLabel("Email").fill(TEST_EMAIL);
    await page.getByLabel("Password").fill(TEST_PASSWORD);

    // Submit
    await page.getByRole("button", { name: "Sign in" }).click();

    // Should redirect to dashboard
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  });

  test("login with invalid credentials shows error", async ({ page }) => {
    await page.goto("/login");

    await page.getByLabel("Email").fill("wrong@example.com");
    await page.getByLabel("Password").fill("WrongPassword123!");

    await page.getByRole("button", { name: "Sign in" }).click();

    // Should show error message
    await expect(page.locator(".bg-destructive\\/10")).toBeVisible({ timeout: 10_000 });
  });

  test("register page renders correctly", async ({ page }) => {
    await page.goto("/register");

    await expect(page.getByText("Register", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Create an account to get started")).toBeVisible();
    await expect(page.getByLabel("Email")).toBeVisible();
    await expect(page.getByLabel("Password", { exact: true })).toBeVisible();
    await expect(page.getByLabel("Confirm Password")).toBeVisible();
    await expect(page.getByRole("button", { name: "Create account" })).toBeVisible();
  });

  test("login page has link to register", async ({ page }) => {
    await page.goto("/login");

    await expect(page.getByRole("link", { name: "Register" })).toBeVisible();
    await page.getByRole("link", { name: "Register" }).click();
    await expect(page).toHaveURL(/\/register/);
  });

  test("register page has link to login", async ({ page }) => {
    await page.goto("/register");

    await expect(page.getByRole("link", { name: "Login" })).toBeVisible();
    await page.getByRole("link", { name: "Login" }).click();
    await expect(page).toHaveURL(/\/login/);
  });

  test("sign out redirects to login", async ({ page }) => {
    // First log in
    await page.goto("/login");
    await page.getByLabel("Email").fill(TEST_EMAIL);
    await page.getByLabel("Password").fill(TEST_PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });

    // Open user menu (button containing user email)
    await page.getByRole("button", { name: new RegExp(TEST_EMAIL.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")) }).click();

    // Click sign out
    await page.locator('[aria-label="Sign out"]').click();

    // Should redirect to login
    await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });
  });
});
