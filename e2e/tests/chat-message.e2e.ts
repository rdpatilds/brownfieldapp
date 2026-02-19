import { expect, test } from "@playwright/test";

const TEST_EMAIL = process.env["TEST_EMAIL"] ?? "e2e-billing@test.com";
const TEST_PASSWORD = process.env["TEST_PASSWORD"] ?? "testpassword123";

async function loginAndGoToChat(page: import("@playwright/test").Page) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(TEST_EMAIL);
  await page.getByLabel("Password").fill(TEST_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });

  // Navigate to chat (root page)
  await page.goto("/");
  await expect(page.getByPlaceholder("Type a message...")).toBeVisible({ timeout: 10_000 });
}

test.describe("Chat Message", () => {
  test.beforeEach(async ({ page }) => {
    await loginAndGoToChat(page);
  });

  test("chat page loads with empty state", async ({ page }) => {
    // Verify empty state
    await expect(page.getByText("How can I help you today?")).toBeVisible();
    await expect(page.getByText("Start a conversation by typing a message below")).toBeVisible();
  });

  test("can type and send a message", async ({ page }) => {
    const chatInput = page.getByPlaceholder("Type a message...");
    await chatInput.fill("Hello, what is 2+2?");

    // Send button should be enabled
    const sendButton = page.locator('[aria-label="Send message"]');
    await expect(sendButton).toBeEnabled();

    // Send the message
    await sendButton.click();

    // User message should appear (primary background = user message)
    await expect(page.locator(".bg-primary.text-primary-foreground").first()).toBeVisible({
      timeout: 5_000,
    });

    // Wait for AI response (muted background = AI message)
    await expect(page.locator(".bg-muted.text-foreground").first()).toBeVisible({
      timeout: 30_000,
    });
  });

  test("send message via Enter key", async ({ page }) => {
    const chatInput = page.getByPlaceholder("Type a message...");
    await chatInput.fill("Say hello in one word.");
    await chatInput.press("Enter");

    // User message should appear
    await expect(page.locator(".bg-primary.text-primary-foreground").first()).toBeVisible({
      timeout: 5_000,
    });
  });

  test("new chat button creates a fresh conversation", async ({ page }) => {
    // Click new chat button
    await page.getByRole("button", { name: "New Chat" }).click();

    // Empty state should be visible
    await expect(page.getByText("How can I help you today?")).toBeVisible({ timeout: 5_000 });
  });

  test("token balance is displayed in header", async ({ page }) => {
    const tokenBadge = page.locator('[aria-label="Token balance"]');
    await expect(tokenBadge).toBeVisible();

    // Should contain a number
    const text = await tokenBadge.textContent();
    expect(text).toMatch(/\d+/);
  });
});
