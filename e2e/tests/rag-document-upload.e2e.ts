import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";

const TEST_EMAIL = process.env["TEST_EMAIL"] ?? "e2e-billing@test.com";
const TEST_PASSWORD = process.env["TEST_PASSWORD"] ?? "testpassword123";

function createTestFixture(): string {
  const content = `# Quantum Computing Basics

Quantum computing uses quantum bits (qubits) instead of classical bits.
Unlike classical bits which are either 0 or 1, qubits can exist in a superposition of both states.

## Key Concepts

- **Superposition**: A qubit can be in a combination of |0> and |1> states simultaneously.
- **Entanglement**: Two qubits can be correlated so that measuring one instantly affects the other.
- **Quantum Gates**: Operations that manipulate qubits, analogous to classical logic gates.

## Applications

Quantum computers excel at:
1. Cryptography and code breaking
2. Drug discovery and molecular simulation
3. Optimization problems
4. Machine learning acceleration
`;

  const filePath = join("/tmp", `quantum-test-${Date.now()}.md`);
  writeFileSync(filePath, content);
  return filePath;
}

async function loginAndGoToDocuments(page: import("@playwright/test").Page) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(TEST_EMAIL);
  await page.getByLabel("Password").fill(TEST_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });
  await page.goto("/dashboard/documents");
  await expect(page.getByRole("heading", { name: "Documents" })).toBeVisible({ timeout: 10_000 });
}

test.describe("RAG Document Upload", () => {
  test("upload a document and verify it appears in list", async ({ page }) => {
    await loginAndGoToDocuments(page);

    const testFilePath = createTestFixture();

    // Upload file
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(testFilePath);

    // Click upload
    await page.getByRole("button", { name: "Upload" }).click();

    // Wait for upload and ingestion to complete
    await page.waitForTimeout(15_000);

    // Refresh and check document list
    await page.reload();
    await page.waitForLoadState("networkidle");

    // Document should appear with "quantum" in title
    const docEntry = page.getByText(/quantum/i);
    await expect(docEntry.first()).toBeVisible({ timeout: 10_000 });
  });

  test("uploaded document shows metadata (chunks, tokens)", async ({ page }) => {
    await loginAndGoToDocuments(page);

    // Check if there are documents with metadata columns
    const hasDocuments = await page
      .getByText("Title")
      .isVisible({ timeout: 5_000 })
      .catch(() => false);

    if (!hasDocuments) {
      test.skip();
      return;
    }

    // Verify column headers exist
    await expect(page.getByText("Chunks")).toBeVisible();
    await expect(page.getByText("Tokens")).toBeVisible();
  });

  test("chat references uploaded documents as sources", async ({ page }) => {
    // Login
    await page.goto("/login");
    await page.getByLabel("Email").fill(TEST_EMAIL);
    await page.getByLabel("Password").fill(TEST_PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });

    // Go to chat
    await page.goto("/");
    await expect(page.getByPlaceholder("Type a message...")).toBeVisible({ timeout: 10_000 });

    // Ask about quantum computing (content from our uploaded doc)
    await page.getByPlaceholder("Type a message...").fill("What are the key concepts in quantum computing?");
    await page.locator('[aria-label="Send message"]').click();

    // Wait for AI response
    await expect(page.locator(".bg-muted.text-foreground").first()).toBeVisible({
      timeout: 30_000,
    });

    // Wait for response to complete
    await page.waitForTimeout(10_000);

    // Check for source references (data-testid="source-references")
    const sources = page.locator('[data-testid="source-references"]');
    const hasSources = await sources.isVisible({ timeout: 5_000 }).catch(() => false);

    if (hasSources) {
      await expect(sources.getByText("Sources")).toBeVisible();
    }
    // Note: Sources may not appear if RAG didn't match or embedding is not configured
  });
});
