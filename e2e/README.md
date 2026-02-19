# E2E Tests

End-to-end tests using [Playwright](https://playwright.dev/) in headed mode.

## Prerequisites

- Backend running on http://localhost:4000
- Frontend running on http://localhost:3000
- Test user account created in Supabase
- Valid `.env` in both `backend/` and `frontend/`

## Setup

```bash
cd e2e
npm install
npx playwright install chromium
```

## Running Tests

```bash
# Run all tests in headed mode (browser visible)
npx playwright test --headed

# Run a specific test suite
npx playwright test tests/auth-flow.e2e.ts --headed

# Run in headless mode (CI)
npx playwright test

# Run with Playwright UI
npx playwright test --ui
```

## Test Credentials

Tests use credentials from environment variables or fallback defaults:

```bash
TEST_EMAIL=e2e-billing@test.com
TEST_PASSWORD=testpassword123
```

Override with: `TEST_EMAIL=user@example.com TEST_PASSWORD=pass npx playwright test --headed`

## Test Suites

| Test Suite | Tests | Description |
|------------|-------|-------------|
| `auth-flow.e2e.ts` | 6 | Login, register, logout, invalid login, page navigation |
| `chat-message.e2e.ts` | 5 | Send message, streamed response, Enter key, new chat, token badge |
| `billing-checkout.e2e.ts` | 5 | Token balance, pack display, checkout, transaction history, manage billing |
| `token-consumption.e2e.ts` | 4 | Balance display, chat header badge, token deduction, zero-token state |
| `document-management.e2e.ts` | 5 | Page load, empty/list state, upload, delete dialog, file type validation |
| `rag-document-upload.e2e.ts` | 3 | Upload with RAG ingestion, metadata display, chat with source citations |

**Total: 28 tests (26 pass, 2 conditional skips)**

## Recommended Execution Order

1. **auth-flow** - Verifies login/register/logout works
2. **billing-checkout** - Ensures billing page and token packs render
3. **token-consumption** - Verifies token balance and deduction
4. **document-management** - Upload/delete documents, file validation
5. **rag-document-upload** - Upload with RAG ingestion, chat with citations
6. **chat-message** - Send messages, verify streaming and UI

## Configuration

The `playwright.config.ts` is configured to:
- Reuse existing servers on ports 3000/4000 (or start them if not running)
- Run tests sequentially (1 worker) for deterministic state
- Capture screenshots on failure
- Use Chromium in headed mode by default

## Notes

- Some tests are conditionally skipped based on existing data state (e.g., delete test skips if no documents exist)
- RAG source citations depend on embedding configuration and document content matching
- The Chargebee checkout test verifies the API response but does not complete payment (requires test mode)
