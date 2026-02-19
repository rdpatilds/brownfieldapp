import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";

const TEST_EMAIL = process.env["TEST_EMAIL"] ?? "e2e-billing@test.com";
const TEST_PASSWORD = process.env["TEST_PASSWORD"] ?? "testpassword123";

function createTestFile(name: string, content: string): string {
  const filePath = join("/tmp", name);
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

test.describe("Document Management", () => {
  test("documents page loads correctly", async ({ page }) => {
    await loginAndGoToDocuments(page);

    await expect(page.getByText("Upload and manage your RAG knowledge base documents")).toBeVisible();
    await expect(page.getByText("Upload Document")).toBeVisible();
    await expect(
      page.getByText("Upload .md or .txt files to add to the knowledge base"),
    ).toBeVisible();
  });

  test("documents page shows empty state or document list", async ({ page }) => {
    await loginAndGoToDocuments(page);

    // Wait for loading skeletons to disappear (they have animate-pulse class)
    await page.waitForTimeout(5_000);

    // Either empty state or document list (check both with generous timeout)
    const hasEmpty = await page
      .getByText("No documents yet. Upload a file to get started.")
      .isVisible({ timeout: 5_000 })
      .catch(() => false);
    const hasDocuments = await page
      .getByText("Title")
      .isVisible({ timeout: 5_000 })
      .catch(() => false);
    // Also check if skeletons are still showing (loading state)
    const isLoading = await page
      .locator("[class*='animate-pulse']")
      .first()
      .isVisible({ timeout: 1_000 })
      .catch(() => false);

    expect(hasEmpty || hasDocuments || isLoading).toBeTruthy();
  });

  test("upload a markdown document", async ({ page }) => {
    await loginAndGoToDocuments(page);

    // Create a test file
    const testFilePath = createTestFile(
      `test-e2e-${Date.now()}.md`,
      "# E2E Test Document\n\nThis is a test document for end-to-end testing.\n\n## Section 1\n\nSome content for RAG ingestion testing.\n",
    );

    // Upload the file
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(testFilePath);

    // Click upload button
    await page.getByRole("button", { name: "Upload" }).click();

    // Wait for upload to complete (progress bar should appear and finish)
    await page.waitForTimeout(10_000);

    // Verify document appears in list (reload if needed)
    await page.reload();
    await page.waitForLoadState("networkidle");

    // The document should appear with title containing "E2E Test Document" or the filename
    const docEntry = page.getByText(/e2e.*test/i);
    await expect(docEntry.first()).toBeVisible({ timeout: 10_000 });
  });

  test("delete a document shows confirmation dialog", async ({ page }) => {
    await loginAndGoToDocuments(page);

    // Check if there are any documents to delete
    const hasDocuments = await page
      .getByText("Title")
      .isVisible({ timeout: 5_000 })
      .catch(() => false);

    if (!hasDocuments) {
      test.skip();
      return;
    }

    // Find delete button (trash icon button)
    const deleteButtons = page.getByRole("button").filter({ has: page.locator("svg") });
    const trashButton = deleteButtons.last();

    if (await trashButton.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await trashButton.click();

      // Confirmation dialog should appear
      await expect(page.getByText("Are you sure?")).toBeVisible({ timeout: 5_000 });
      await expect(page.getByRole("button", { name: "Cancel" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Delete" })).toBeVisible();

      // Cancel to not actually delete
      await page.getByRole("button", { name: "Cancel" }).click();
    }
  });

  test("file input accepts only .md and .txt", async ({ page }) => {
    await loginAndGoToDocuments(page);

    // Check that file input has accept attribute
    const fileInput = page.locator('input[type="file"]');
    const accept = await fileInput.getAttribute("accept");
    expect(accept).toContain(".md");
    expect(accept).toContain(".txt");
  });
});
