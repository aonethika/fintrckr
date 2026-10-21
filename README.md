# Finsight

An AI financial analysis workspace combining Finsight's statement intelligence with Fintrckr's transactions, budgets and shared expenses. The interface uses flat matte-black surfaces with violet AI accents, mint income indicators, amber spending cues and blue budget details. Larger labels, visible keyboard focus and mobile-friendly controls make daily actions easier to use. AI analysis is the landing page after sign-in.

## Run the interface

```powershell
cd frontend
npm install
npm run dev
```

Open http://localhost:5173. Finsight opens to sign-in or account creation. There is no demo mode or seeded financial data. Each new account starts empty and all changes are saved through the API.

## Persistent local database

```powershell
cd backend
npm install
npm run local
```

This starts the API on port **5050** with a separate MongoDB replica set on **27018**. Accounts, transactions, budgets and the signing key are stored in `.local-data/` at the workspace root and retained across restarts. Keep that directory to retain your records and sessions. The local runner uses WiredTiger on disk, not ephemeral test storage. It binds to loopback and does not change the MongoDB service already running on port 27017 or the existing cloud `.env` settings. No sample users or transactions are created.

Run the frontend in a second terminal using the interface instructions above. To use a configured external database instead, follow the API instructions below.

## Run the API

Use Node.js 22.16+ (tested with Node 25). Install dependencies in `backend`, then configure `backend/.env` using `.env.example` as a reference. Keep existing credentials private. This project uses MongoDB/Mongoose as the unified store. MongoDB Atlas or a local replica set is required because statement imports and shared expense creation use database transactions.

```powershell
cd backend
npm install
$env:PORT = '5050'
npm run dev
```

The frontend development proxy targets port **5050**. The explicit port override avoids conflicts with other apps already using 5000 and with older `.env` files that set `PORT=5000`. For production, configure `VITE_API_URL` before building the frontend and `FRONTEND_URL` on the API. `/api/health` reports readiness after the database connects.

## Combined features

- Overview with actual account balances, monthly income/spending, cash flow and shared balances.
- Personal transactions: create, edit, delete, search, filter by type/account/month, paginate and export CSV. Attach and view receipt images.
- Bank, credit card, cash and investment accounts, opening balances and last four digits.
- Monthly spending plans and independent category targets, with over-budget indicators.
- CSV and supported text PDF statement previews, editable category suggestions, account selection and duplicate import prevention. All transactions in an import commit together.
- Shared groups with email-based membership, group conversation, equal or custom splits, exact-cent allocation, UPI links/QR codes and payment confirmations.
- AI-generated monthly reviews with transaction evidence, suggested next steps, saved reports, stale-report detection and Markdown export.
- A real AI analyst conversation grounded in the signed-in user's transactions, category budgets, previous-month totals and shared balances. Conversation history is private and saved per month.
- Optional AI statement extraction and category suggestions, including confidence scores and a review before import.
- Profile, UPI ID and full workspace JSON export.
- Responsive navigation, keyboard-accessible form dialogs and reduced-motion support.

## Import formats and limits

CSV uses `date,description,amount,type`, with an optional `category` column. Dates must be `YYYY-MM-DD`; amounts must be positive; type is `INCOME` or `EXPENSE`. Quoted commas and escaped quotes are supported.

```csv
date,description,amount,type
2026-10-01,Monthly salary,85000,INCOME
2026-10-02,Swiggy,450,EXPENSE
```

Standard PDF import supports text rows in the format `YYYY-MM-DD description 450.00 DR` (or `CR`, `INCOME`, `EXPENSE`). With AI enabled, the backend can extract transactions from other text-based bank layouts and categorize CSV rows. Scanned/image-only PDFs still require OCR. AI extraction rejects uncertain partial results rather than silently omitting rows.

Files are limited to 5 MB. Standard imports support up to 3,000 transactions; AI CSV categorization supports 400 per upload. AI PDF text is limited to 60,000 characters. All previews are validated before database writes. Category suggestions and confidence scores can be reviewed; changing a suggestion marks it as manual.

## AI provider setup

The original Finsight uses `EXPLABS_API_KEY` with `https://api.experientiallabs.ai/v1` and model `gpt-6-astra`. The merged app supports that same integration. Its server-only configuration is in `backend/config/ai.js`.

To import the original provider key locally without copying any database credentials:

```powershell
cd backend
node configure-ai.js 'C:\Users\avanthika\finsight\backend\.env'
```

This writes only the AI settings to the ignored `.local-data/ai.env` file, using exclusive creation so an existing setup is not overwritten. The original project is unchanged. Alternatively configure `FINSIGHT_AI_API_KEY`, `FINSIGHT_AI_BASE_URL` and `FINSIGHT_AI_MODEL` in backend environment variables. For the official OpenAI API, `OPENAI_API_KEY` and an accessible `FINSIGHT_AI_MODEL` are also supported. Never place provider secrets in `VITE_` environment variables.

The original provider currently returns HTTP 429 with `insufficient_quota` because its account has no available credits. Add credits to that provider account or configure an alternative backend API key to obtain live model responses. Reports and chat show the provider error; there are no canned-answer or sample-report fallbacks. A configured-key indicator does not imply that provider credit or model access is available.

Reviews and chat send server-computed totals, budgets and a limited sample of the authenticated user's transactions to the configured provider. Bank account numbers, user email and UPI ID fields are not sent. Obvious numeric references and payee handles in descriptions are redacted; descriptions may still contain merchant or personal names. AI statement extraction sends extracted statement text. These actions are initiated explicitly in the UI. The model cannot change transactions, execute payments, or access another user's records.

Transactions categorized as `Transfer` affect their account balances but are excluded from income/spending, budget usage and analysis totals, so transfers between your own accounts are not treated as earnings or purchases. Review this category carefully when importing statements.

The chat-completions integration follows the [official OpenAI API reference](https://developers.openai.com/api/reference/resources/chat/subresources/completions/methods/create), using the original provider's compatible endpoint. Model-generated JSON is validated locally, including allowed category names, confidence bounds, and transaction evidence IDs.

## Shared expense accounting

An expense creates one personal share for each participant and one group record tracking reimbursements. A member marks their share paid, then the payer confirms receipt. Confirmation does not subtract the reimbursement from the payer’s own share. Finsight does not process or verify bank payments. The UPI app handles payment; people confirm receipt in Finsight.

## Verification

```powershell
cd frontend
npm run build
npx eslint src/finsight src/main.jsx
cd ../backend
npm test
```

Backend integration tests use an isolated MongoDB replica set through `mongodb-memory-server`; the first run downloads MongoDB. They never connect to the configured application database. `finsight-browser-check.cjs` checks real local signup, empty accounts, saving transactions, logout/login persistence and responsive pages. Start `npm run local` and the frontend first. The browser check creates a uniquely named QA account and removes only that account's records afterward. Update its Playwright path if running on another machine.

`backend/tests/ai.test.js` tests the API client, AI output validation, ownership/privacy, saved reports, stale detection, chat history and quota failure using an isolated HTTP provider stub. `finsight-ai-browser-check.cjs` verifies the actual provider's quota error plus success rendering with browser-only test fixtures; those fixtures are never used by the app or saved as model output. This browser check removes its own QA records after completion.

## Project layout and existing data

The new React workspace is in `frontend/src/finsight`. `frontend/src/main.jsx` loads it. Existing Fintrckr components remain available in the source tree. The new unified API is `backend/routes/workspaceRoutes.js`, alongside the original routes. The original `C:/Users/avanthika/finsight` project is unchanged.

Existing MongoDB users, transactions, groups and budgets are readable by the combined workspace. Historical group ledger entries are not automatically rewritten. The separate Finsight PostgreSQL/Prisma database has not been migrated; moving real records between those databases requires an explicit migration and a backup. This implementation combines the products’ workflows into one MongoDB-backed application.
