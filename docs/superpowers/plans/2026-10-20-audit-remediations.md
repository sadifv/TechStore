# Audit Remediations Implementation Plan

> **For agentic workers:** Execute this plan inline with `superpowers:executing-plans`; preserve a test-first cycle for each behavior change.

**Goal:** Resolve the eight prioritized findings from the project review without changing the current WhatsApp checkout flow.

**Architecture:** Persist uploaded product image bytes in the existing MongoDB deployment rather than relying on Render's ephemeral filesystem or requiring a paid disk. Validate AI input at the API boundary, aggregate reservation totals by product, and move email campaigns to a persisted background queue that resumes safely. Align checkout copy, Netlify response headers, SMTP production behavior, README, and privacy/cookie disclosures with what the code actually does.

**Tech Stack:** Express 5, Mongoose/MongoDB, React 19, Vite, Node's test runner, Netlify static headers, Render Blueprint.

**Spec:** Eight prioritized findings in the prior project review, dated 2026-10-20.

## Global Constraints

- Keep WhatsApp as the order contact and payment coordination flow.
- Keep uploaded file validation for JPEG, PNG, WEBP, and GIF and the 5 MB size limit.
- Keep existing API response compatibility except the campaign endpoint, which will return HTTP 202 with a queued campaign.
- Do not add a paid hosting resource or a new cloud provider.
- Development may simulate SMTP; production must never report a simulated email as delivered.

## Review Focus

- Uploaded images must survive service restarts because their bytes are stored in MongoDB.
- Invalid AI messages (non-string, blank, oversized) must return 400 before database/provider calls.
- Product availability must equal stock minus active, unexpired reservations, with one batch aggregate per catalog request.
- Campaign work must be persisted before returning 202, record per-recipient results, resume pending work after restart, and avoid automatic retries for ambiguous `sending` recipients.
- Guest checkout still needs its contact email in the order record, but must no longer promise an email receipt.

## Files and Responsibilities

- `backend/models/ProductImage.js`, `backend/services/productImageStorage.js`, `backend/controllers/productImageController.js`, `backend/middleware/uploadMiddleware.js`, `backend/server.js`: durable image storage and serving, with the current upload validation.
- `backend/controllers/aiController.js`, `backend/models/Reservation.js`, `backend/controllers/productController.js`: API validation and batched reservation totals.
- `backend/models/Campaign.js`, `backend/services/campaignQueue.js`, `backend/controllers/marketingController.js`, `backend/server.js`, `frontend/src/components/admin/UserMarketingPages.jsx`: persisted campaign processing and queued UI feedback.
- `backend/config/mailer.js`, `backend/server.js`, `render.yaml`, `backend/.env.example`: prevent false production SMTP success and document/configure required settings.
- `frontend/src/components/Cart.jsx`, `frontend/public/_headers`, `README.md`, `frontend/src/components/account/LegalPage.jsx`: WhatsApp checkout wording, Netlify headers, and accurate provider/privacy information.
- `backend/tests/*`, `frontend/src/*.test.js`: regression coverage for the affected contracts.

## Tasks

### Task 1: Durable uploads and deployment security

- [x] Add tests for image signature validation and image serving from Mongo-backed storage.
- [x] Replace local-only upload persistence with a MongoDB-backed image collection; keep only generated opaque IDs in public image URLs.
- [x] Add a route for validated image IDs, preserve MIME type, and set safe cache/security response headers.
- [x] Add version-controlled Netlify `_headers` rules for CSP and baseline response headers.
- [x] Verify deployment manifest does not introduce a paid Render disk.

### Task 2: API correctness and catalog performance

- [x] Add failing cases for malformed and overlong TechBot messages.
- [x] Add a batch reservation aggregation method and tests for grouping product IDs and expired reservations.
- [x] Update catalog response calculations to use the batch result and retain zero-reservation behavior.

### Task 3: Persisted background campaign processing and truthful email behavior

- [x] Add tests for queueing a campaign and returning before individual delivery, as well as worker progress and ambiguous interrupted sends.
- [x] Persist recipient unsubscribe tokens and states before the background worker sends.
- [x] Process queued work asynchronously, persist each result, resume queued work on startup, and mark interrupted `sending` recipients failed rather than retrying them.
- [x] Keep local SMTP simulation; make missing production SMTP a clear error, add required variables to the Render Blueprint and `.env.example`, and remove simulated-success responses from the production flow.
- [x] Change checkout copy to identify guest email as contact information, not a receipt address; retain the email in the WhatsApp order record.

### Task 4: Align documentation and final verification

- [x] Correct README's AI provider to Gemini and update privacy/cookie wording for current Gemini chat history, sessions, and the absence of an in-code analytics integration.
- [x] Run backend tests, frontend tests, frontend lint/build, dependency audits if dependencies changed, then inspect the final diff and repository status.

## Decisions

- Ruling: persist uploaded images in the already-used MongoDB service instead of declaring a Render disk — avoids introducing a paid service plan and prevents ephemeral local storage loss; cost if wrong: database storage grows with uploaded image volume.
- Ruling: do not require a payment receipt email in WhatsApp checkout, but keep guest email as a required contact field because the order schema and administrator workflow use it — cost if wrong: guests who do not have email still cannot complete checkout.
- Ruling: missing SMTP makes email-dependent requests fail clearly with 503 while the storefront and WhatsApp checkout stay online — cost if wrong: email campaigns and password recovery remain unavailable until SMTP credentials are supplied.
