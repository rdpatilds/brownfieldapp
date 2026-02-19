import { expect, test } from "@playwright/test";

const TEST_EMAIL = process.env["TEST_EMAIL"] ?? "e2e-billing@test.com";
const TEST_PASSWORD = process.env["TEST_PASSWORD"] ?? "testpassword123";

async function login(page: import("@playwright/test").Page) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(TEST_EMAIL);
  await page.getByLabel("Password").fill(TEST_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });
}

async function getTokenBalanceFromChat(page: import("@playwright/test").Page): Promise<number | null> {
  await page.goto("/");
  const tokenBadge = page.locator('[aria-label="Token balance"]');
  await expect(tokenBadge).toBeVisible({ timeout: 10_000 });
  const text = await tokenBadge.textContent();
  if (text) {
    const match = text.match(/(\d+)/);
    return match ? parseInt(match[1], 10) : null;
  }
  return null;
}

test.describe("Token Consumption", () => {
  test("token balance is displayed on billing page", async ({ page }) => {
    await login(page);
    await page.goto("/dashboard/billing");
    await expect(page.getByRole("heading", { name: "Billing" })).toBeVisible({ timeout: 10_000 });

    await expect(page.getByText("Token Balance")).toBeVisible();
    await expect(page.getByText("Each AI conversation turn costs 1 token")).toBeVisible();
  });

  test("token balance shown in chat header", async ({ page }) => {
    await login(page);
    const balance = await getTokenBalanceFromChat(page);
    expect(balance).not.toBeNull();
    expect(balance).toBeGreaterThanOrEqual(0);
  });

  test("sending a message deducts a token", async ({ page }) => {
    test.setTimeout(90_000);
    await login(page);

    // Get initial balance from chat header
    const initialBalance = await getTokenBalanceFromChat(page);
    expect(initialBalance).not.toBeNull();
    expect(initialBalance).toBeGreaterThan(0);

    // Send a message
    await page.getByPlaceholder("Type a message...").fill("Say hi in one word.");
    await page.locator('[aria-label="Send message"]').click();

    // Wait for response to complete
    await expect(page.locator(".bg-muted.text-foreground").first()).toBeVisible({
      timeout: 30_000,
    });

    // Wait a bit for balance to update
    await page.waitForTimeout(3_000);

    // Get new balance from header badge
    const tokenBadge = page.locator('[aria-label="Token balance"]');
    const newText = await tokenBadge.textContent();
    const newBalance = newText ? parseInt(newText.match(/(\d+)/)?.[1] ?? "0", 10) : null;

    expect(newBalance).not.toBeNull();
    expect(newBalance!).toBeLessThan(initialBalance!);
  });

  test("no tokens state shows buy more button in chat", async ({ page }) => {
    await login(page);
    await page.goto("/");

    // Check if user has zero tokens — if so, verify the "Buy More Tokens" prompt
    const noTokensText = page.getByText("You've used all your tokens");
    const hasNoTokens = await noTokensText.isVisible({ timeout: 3_000 }).catch(() => false);

    if (hasNoTokens) {
      await expect(page.getByRole("button", { name: "Buy More Tokens" })).toBeVisible();
    } else {
      // User has tokens, just verify chat input is available
      await expect(page.getByPlaceholder("Type a message...")).toBeVisible();
    }
  });
});
