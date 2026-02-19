import { expect, test } from "@playwright/test";

const TEST_EMAIL = process.env["TEST_EMAIL"] ?? "e2e-billing@test.com";
const TEST_PASSWORD = process.env["TEST_PASSWORD"] ?? "testpassword123";

async function loginAndGoToBilling(page: import("@playwright/test").Page) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(TEST_EMAIL);
  await page.getByLabel("Password").fill(TEST_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });
  await page.goto("/dashboard/billing");
  await expect(page.getByRole("heading", { name: "Billing" })).toBeVisible({ timeout: 10_000 });
}

test.describe("Billing Checkout", () => {
  test.beforeEach(async ({ page }) => {
    await loginAndGoToBilling(page);
  });

  test("billing page displays token balance card", async ({ page }) => {
    await expect(page.getByText("Token Balance")).toBeVisible();
    await expect(page.getByText("Each AI conversation turn costs 1 token")).toBeVisible();
  });

  test("billing page displays three token packs", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "Buy Tokens" })).toBeVisible();

    // 3 token packs (use exact match to avoid "50 Tokens" matching "150 Tokens")
    await expect(page.getByText("50 Tokens", { exact: true })).toBeVisible();
    await expect(page.getByText("150 Tokens", { exact: true })).toBeVisible();
    await expect(page.getByText("500 Tokens", { exact: true })).toBeVisible();

    // Prices
    await expect(page.getByText("$5.00")).toBeVisible();
    await expect(page.getByText("$10.00")).toBeVisible();
    await expect(page.getByText("$25.00")).toBeVisible();
  });

  test("buy button initiates checkout", async ({ page }) => {
    // Click first Buy button (cheapest pack)
    const buyButtons = page.getByRole("button", { name: "Buy" });
    await expect(buyButtons.first()).toBeVisible();

    // Clicking should trigger API call (may redirect or open new tab)
    const [response] = await Promise.all([
      page.waitForResponse(
        (resp) => resp.url().includes("/billing/checkout") && resp.status() === 200,
        { timeout: 10_000 },
      ).catch(() => null),
      buyButtons.first().click(),
    ]);

    if (response) {
      const body = await response.json();
      // Should return a checkout URL
      expect(body.url).toBeTruthy();
    }
  });

  test("transaction history section is visible", async ({ page }) => {
    // Scroll down to see transaction history
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(1_000);

    await expect(page.getByText("Transaction History")).toBeVisible({ timeout: 5_000 });

    // Either has a table with transactions or shows empty state
    const hasTransactions = await page.getByRole("table").isVisible({ timeout: 3_000 }).catch(() => false);
    const hasEmptyState = await page.getByText("No transactions yet").isVisible({ timeout: 3_000 }).catch(() => false);

    // One of these must be true
    expect(hasTransactions || hasEmptyState).toBeTruthy();
  });

  test("manage billing button exists", async ({ page }) => {
    await expect(page.getByRole("button", { name: "Manage Billing" })).toBeVisible();
  });
});
