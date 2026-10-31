# LoopLedger Handoff Document

## Project Overview
**Brightloop Subscription Management System (LoopLedger)**
Tagline: *Subscription billing you can prove is correct*
Currency: INR (₹)

---

## Phase 1: Foundation, Models, Auth — COMPLETED

### 1. Done in Phase 1
- **Repository Architecture & Docker**:
  - `docker-compose.yml` defining `mongo` (standalone, no replica set requirement), `backend`, and `frontend`.
  - `.env.example` with all configuration parameters (`PORT`, `MONGO_URI`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `CLIENT_URL`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM`).
  - `.gitignore` preventing secrets, `.env`, logs, and node_modules from being committed.
- **Backend Core**:
  - Express app with `helmet`, `cors` bound to `CLIENT_URL`, central `errorHandler`, `asyncHandler` wrapper.
  - Rate limiting on `/api/auth` (20 req / 15 min) and `/api` general (500 req / 15 min).
  - Sequence generation utility `utils/sequence.js` with atomic `Counter` collection for formatted doc IDs (`SUB-000001`, `QUO-000001`, `INV-000001`, `PAY-000001`).
  - Currency rounding utility `utils/money.js` with `round2`.
  - Email notification system in `config/mailer.js` supporting SMTP with automatic Ethereal test account fallback for local dev.
- **Data Models (all 14 models defined with schemas, indexes, and validations)**:
  - `User`, `Customer`, `Product`, `ProductVariant`, `SubscriptionPlan`, `Tax`, `Discount`, `QuotationTemplate`, `Quotation`, `Subscription`, `Invoice`, `Payment`, `BillingPeriod`, `BillingRun`, `StatusHistory`, `ReminderLog`, `MrrChange`, `Counter`.
- **Authentication & Admin API**:
  - Strict password validation: >= 9 characters, >= 1 uppercase, >= 1 lowercase, >= 1 special character.
  - Public signup, login, password reset with single-use tokens.
  - Staff management endpoints for admin.
- **Frontend Core**:
  - Vite + React 18 + Tailwind CSS + React Router v6 + TanStack Query + Axios.
  - Shared UI components: `DataTable`, `Pagination`, `Modal`, `ConfirmDialog`, `StatusBadge`, `StatCard`, `PageHeader`, `EmptyState`, `Spinner`, `FormField`, `SearchInput`, `Toast`, `Timeline`.

---

## Phase 2: UI Shell, Shared Components, Customers, Staff — COMPLETED

### 1. Done in Phase 2
- **Backend Customers Module**:
  - Full CRUD API at `/api/customers` with Zod validation.
  - Regex search across name, email, company, and phone.
  - Pagination metadata.
  - Deletion blocked if active subscriptions or invoices exist.
  - Sub-resources: `/api/customers/:id/subscriptions`, `/invoices`, `/payments`.
  - Strict customer-role access isolation via JWT `customerId`.
- **Frontend Customers Module**:
  - `CustomersPage.jsx`: DataTable with search, filters, pagination, add/edit modal, delete confirmation.
  - `CustomerDetailPage.jsx`: Full customer profile, quick metric cards, Subscriptions tab, Invoices tab, Payments tab.
- **Staff Management**:
  - `StaffPage.jsx`: Admin-only view with member list, role badges, activation toggles, and modal with live security checklist.
- **Dashboard Shell**:
  - `DashboardPage.jsx`: Six SaaS metric cards and live recent customer list.
- **Seed Script Enhanced**:
  - 1 Admin, 2 Staff, and 10 realistic Indian customer accounts seeded idempotently.
- **Test Suite**:
  - 24/24 tests passing across auth and customer integration suites.

---

## Phase 3: Catalog, Plans, Taxes, Discounts — COMPLETED

### 1. Done in Phase 3
- **Role-Based Access Control**:
  - Taxes, Products, Plans, and Discounts: Staff can read (GET), Admin has exclusive write access (POST, PUT, PATCH, DELETE), Customers have no access (403).
- **Taxes Module (`/api/taxes`)**:
  - Full CRUD with active status toggle (`PATCH /api/taxes/:id/toggle`).
  - Validation ensures tax percentage is between 0 and 100.
  - `TaxesPage.jsx`: Interactive table, active status toggle, add/edit modal, delete confirmation.
- **Products & Variants Module (`/api/products`)**:
  - Full CRUD for products (name, type, sales price, cost price, notes, default tax rule, archived).
  - Product variants management: attribute, value, and extra price with compound unique index on `(product, attribute, value)`.
  - `ProductsPage.jsx`:
    - Search by name, filter by product type, pagination.
    - Add/Edit modal with dynamic variant rows.
    - **Interactive Price Calculator**: Pick any product and variant, adjust quantity, and observe live calculation proving:
      `Effective Unit Price = Base Sales Price + Variant Extra Price`
      `Example: ₹1,000 (Base) + ₹560 (Odoo Brand) = ₹1,560 Unit Price`
- **Subscription Plans Module (`/api/plans`)**:
  - Full CRUD with billing periods (`daily`, `weekly`, `monthly`, `yearly`), minimum quantity thresholds, and availability windows.
  - Backend validation: `availableTo` must be after `availableFrom`.
  - Policy flags support: `autoClose`, `allowEarlyClose`, `allowPause`, `allowRenew`, and `active`.
  - `availableAsOf` query filter to find active plans at a specific date.
  - `PlansPage.jsx`: Search, billing cycle filters, flag badges (`Auto-Close`, `Pause OK`, `Early Close`, `Renewable`), add/edit modal.
- **Discounts Module (`/api/discounts`)**:
  - Full CRUD (Admin only to write).
  - Types: `fixed` or `percent` (0-100 validated). Scope: `product` or `subscription`.
  - Dynamic computed status evaluator: `active`, `scheduled`, `expired`, `exhausted`, `inactive`.
  - `DiscountsPage.jsx`: Search, type & scope filters, usage tracking (`timesUsed / usageLimit`), computed status badges, add/edit modal.
- **Discount Eligibility Engine (`services/discountEligibility.js`)**:
  - Evaluates discount eligibility against purchase criteria.
  - 8 unit tests covering active, inactive, scheduled, expired, exhausted, below minQty, below minPurchase, product-scoped matching.

---

## Phase 4: Pricing Engine, Quotations, Subscriptions, Payments, Auto-Close — COMPLETED

### 1. Done in Phase 4
- **Central Pricing Engine (`backend/src/services/pricingEngine.js`)**:
  - Calculates accurate quotations, invoices, and subscriptions via `quote({ lines, planId, customerId, subscriptionId, asOf })`.
  - Effective unit price rule: `unitPrice = product.salesPrice + variant.extraPrice`.
  - Enforces `plan.minQty` requirements across lines.
  - Applies eligible product-scoped discounts line-by-line first.
  - Applies eligible subscription-scoped discounts to remaining subtotal.
  - Calculates tax on discounted amount and rounds all values to 2 decimals using `round2`.
  - Never increments discount `timesUsed` (deferred to actual invoice finalization).
  - Exposed via `POST /api/pricing/quote`.
- **Audit Service (`backend/src/services/audit.js`)**:
  - Logs entity status changes into the `StatusHistory` collection (`recordStatusChange`).
  - Exposed via `GET /api/history/:entityType/:entityId`.
- **MRR Normalization & Change Tracking (`backend/src/services/mrr.js`)**:
  - Normalizes MRR across intervals: `daily * 30`, `weekly * 52 / 12`, `monthly * 1`, `yearly / 12`.
  - Records MRR movements (`new`, `expansion`, `contraction`, `churn`) in `MrrChange` collection with delta calculations.
- **Quotation Templates Module (`/api/quotation-templates`)**:
  - Full CRUD for reusable templates with validity days, linked plan, and line items (product, variant, quantity).
  - `QuotationTemplatesPage.jsx`: Template cards/table, dynamic line items manager modal.
- **Quotations Module (`/api/quotations`)**:
  - Full lifecycle: `draft` -> `quotation` (sent) -> `confirmed` / `expired` / `cancelled`.
  - Automatic `QUO-000001` sequence numbering.
  - `validUntil` defaults to `now + validityDays`.
  - Prevents confirming expired quotations.
  - Direct conversion to subscription: `POST /api/quotations/:id/confirm` automatically creates a linked `SUB-xxxxxx` without data re-entry.
  - `QuotationsPage.jsx`: Filter by status/customer, live quote price preview before submission.
  - `QuotationDetailPage.jsx`: Full line-by-line breakdown, action buttons, live conversion, and audit history timeline.
- **Subscriptions Module (`/api/subscriptions`)**:
  - Full lifecycle: `draft` -> `quotation` -> `confirmed` -> `active` -> `closed` plus bidirectional `active` <-> `paused`.
  - Automatic `SUB-000001` sequence numbering.
  - Plan policy enforcement:
    - `allowPause`: 400 Bad Request if pause attempted when plan disables it.
    - `allowEarlyClose`: 400 Bad Request if closing before expiry date when plan disables it.
    - `allowRenew`: 400 Bad Request if renewal attempted when plan disables it.
  - Transition actions:
    - **Activate**: Sets `nextBillingDate = startDate`, sets status to `active`, records `new` MRR change.
    - **Pause / Resume**: Enforces `allowPause`, updates status and audit log.
    - **Close**: Enforces `allowEarlyClose`, marks status `closed`, records `churn` MRR change.
    - **Renew**: Extends expiry date based on plan interval.
  - `SubscriptionsPage.jsx`: Filter by status, plan, customer, with MRR badges and date columns.
  - `SubscriptionDetailPage.jsx`: Visual lifecycle stepper, policy enforcement badges, quick actions, lines table, and audit Timeline.
- **Payments Module (`/api/payments`)**:
  - Recording payments against invoices (`POST /api/payments`) with `PAY-000001` sequencing.
  - Automatically updates invoice `amountPaid`, recomputes `balance`, and marks invoice `paid` or `partially_paid`.
  - `PaymentsPage.jsx`: Interactive settlement form and payments ledger.
- **Customer Portal**:
  - `PortalSubscriptions.jsx` and `PortalSubscriptionDetail.jsx`: Customer-scoped subscription viewer with status badges, line items, and payment terms.
- **Auto-Close Subscriptions Cron Job (`backend/src/jobs/autoClose.js`)**:
  - Daily automated check (`0 0 * * *`) that closes active subscriptions whose `expiryDate` has passed and whose `plan.autoClose` is true.
  - Records status transition in `StatusHistory` and records `churn` MRR change.
- **Seed Data Enhanced**:
  - 3 Quotation templates.
  - 12 Quotations across diverse statuses (`draft`, `quotation`, `confirmed`, `expired`).
  - 28 Realistic subscriptions spread over the past 6 months with diverse plans and full historical MRR changes.
  - Sample invoice `INV-DEMO-001` with recorded partial payment.
- **Testing & Verification**:
  - Added test suites: `pricingEngine.test.js`, `quotation.test.js`, `subscription.test.js`, `payment.test.js`.
  - **All 55 tests pass across all 8 test suites** (`npm test`).
  - Frontend production build verified with 0 errors (`npm run build`).

---

### 2. Files Created & Modified in Phase 4
- `backend/src/services/pricingEngine.js` (NEW: pricing engine with discounts, taxes, minQty)
- `backend/src/services/audit.js` (NEW: audit logging to StatusHistory)
- `backend/src/services/mrr.js` (NEW: MRR normalization & MrrChange logging)
- `backend/src/jobs/autoClose.js` (NEW: cron job for auto-closing expired subscriptions)
- `backend/src/controllers/pricingController.js` (NEW: pricing calculation endpoint)
- `backend/src/routes/pricing.js` (NEW)
- `backend/src/controllers/historyController.js` (NEW: entity history endpoint)
- `backend/src/routes/history.js` (NEW)
- `backend/src/controllers/templateController.js` (NEW: quotation templates CRUD)
- `backend/src/routes/quotationTemplates.js` (NEW)
- `backend/src/controllers/quotationController.js` (NEW: quotation CRUD & confirmation to SUB)
- `backend/src/routes/quotations.js` (NEW)
- `backend/src/controllers/subscriptionController.js` (NEW: subscription lifecycle & policy checks)
- `backend/src/routes/subscriptions.js` (NEW)
- `backend/src/controllers/paymentController.js` (NEW: payment recording & invoice balance update)
- `backend/src/routes/payments.js` (NEW)
- `backend/src/app.js` (MODIFIED: mounted Phase 4 routes)
- `backend/src/server.js` (MODIFIED: scheduled daily auto-close cron)
- `backend/scripts/seed.js` (MODIFIED: seeded templates, quotations, 28 subscriptions, invoice, payment)
- `backend/tests/pricingEngine.test.js` (NEW: 7 unit tests)
- `backend/tests/quotation.test.js` (NEW: 3 lifecycle integration tests)
- `backend/tests/subscription.test.js` (NEW: 3 lifecycle & policy integration tests)
- `backend/tests/payment.test.js` (NEW: 1 payment balance settlement test)
- `frontend/src/api/pricing.js` (NEW)
- `frontend/src/api/history.js` (NEW)
- `frontend/src/api/quotationTemplates.js` (NEW)
- `frontend/src/api/quotations.js` (NEW)
- `frontend/src/api/subscriptions.js` (NEW)
- `frontend/src/api/payments.js` (NEW)
- `frontend/src/api/catalog.js` (MODIFIED: added `catalogApi` export)
- `frontend/src/pages/QuotationTemplatesPage.jsx` (MODIFIED: templates table + editor)
- `frontend/src/pages/QuotationsPage.jsx` (MODIFIED: quotations table + filter + live preview)
- `frontend/src/pages/QuotationDetailPage.jsx` (MODIFIED: quote details + confirm button + audit)
- `frontend/src/pages/SubscriptionsPage.jsx` (MODIFIED: subscriptions table + MRR + filters)
- `frontend/src/pages/SubscriptionDetailPage.jsx` (MODIFIED: lifecycle stepper + policy badges + action buttons + audit)
- `frontend/src/pages/PaymentsPage.jsx` (MODIFIED: payments table + settlement modal)
- `frontend/src/pages/portal/PortalSubscriptions.jsx` (MODIFIED: customer view)
- `frontend/src/pages/portal/PortalSubscriptionDetail.jsx` (MODIFIED: customer details view)

---

### 3. API Endpoints Available
| Method | Path | Access | Description |
|---|---|---|---|
| POST | `/api/pricing/quote` | Admin, Staff | Calculate pricing, discounts, and taxes for lines |
| GET | `/api/history/:entityType/:entityId` | Authenticated | Retrieve entity audit status history |
| GET | `/api/quotation-templates` | Admin, Staff | List quotation templates |
| POST | `/api/quotation-templates` | Admin | Create quotation template |
| GET | `/api/quotation-templates/:id` | Admin, Staff | Get quotation template |
| PUT | `/api/quotation-templates/:id` | Admin | Update quotation template |
| DELETE | `/api/quotation-templates/:id` | Admin | Delete quotation template |
| GET | `/api/quotations` | Admin, Staff, Customer (scoped) | List quotations with search & filters |
| POST | `/api/quotations` | Admin, Staff | Create quotation |
| GET | `/api/quotations/:id` | Admin, Staff, Customer (scoped) | Get quotation detail |
| PUT | `/api/quotations/:id` | Admin, Staff | Update draft quotation |
| PATCH | `/api/quotations/:id/send` | Admin, Staff | Mark quotation sent |
| POST | `/api/quotations/:id/confirm` | Admin, Staff | Confirm quotation & generate linked subscription |
| PATCH | `/api/quotations/:id/cancel` | Admin, Staff | Cancel quotation |
| GET | `/api/subscriptions` | Admin, Staff, Customer (scoped) | List subscriptions with search & filters |
| POST | `/api/subscriptions` | Admin, Staff | Create new subscription in draft status |
| GET | `/api/subscriptions/:id` | Admin, Staff, Customer (scoped) | Get subscription detail |
| PUT | `/api/subscriptions/:id` | Admin, Staff | Update subscription |
| POST | `/api/subscriptions/:id/activate` | Admin, Staff | Activate subscription (starts billing, logs MRR) |
| POST | `/api/subscriptions/:id/pause` | Admin, Staff | Pause subscription (enforces `allowPause`) |
| POST | `/api/subscriptions/:id/resume` | Admin, Staff | Resume paused subscription |
| POST | `/api/subscriptions/:id/close` | Admin, Staff | Close subscription (enforces `allowEarlyClose`, logs churn) |
| POST | `/api/subscriptions/:id/renew` | Admin, Staff | Renew subscription (enforces `allowRenew`) |
| GET | `/api/payments` | Admin, Staff, Customer (scoped) | List payments |
| POST | `/api/payments` | Admin, Staff | Record payment against invoice |

---

### 4. Demo Logins
All demo passwords follow the strict policy (`>= 9 chars`, uppercase, lowercase, special char):

- **Super Admin**: `admin@loopledger.dev` / `Admin@1234!` (role: `admin`)
- **Staff 1**: `staff1@loopledger.dev` / `Staff@1234!` (name: Priya Sharma, role: `staff`)
- **Staff 2**: `staff2@loopledger.dev` / `Staff@5678!` (name: Rohit Verma, role: `staff`)
- **Customer 1**: `pooja@loopledger.dev` / `Customer@1234!` (company: Singh Enterprises)
- **Customer 2**: `amit@loopledger.dev` / `Customer@5678!` (company: Desai Technologies)

---

### 5. How to Run & Test
```bash
# 1. Seed demo database with all templates, quotes, subscriptions, and MRR history:
cd backend
npm run seed

# 2. Run backend test suite (55 passing tests across 8 suites):
npm test

# 3. Start backend:
npm start

# 4. In a separate terminal, start frontend:
cd frontend
npm run dev
```

---

### 6. Roadmap to Completion (Phases 5 – 9)
1. **Phase 5: Billing Engine, Time Machine, Invoices – COMPLETED**:
   - `services/billingPeriods.js` (unbilled periods catch-up).
   - `services/billingEngine.js` with `BillingPeriod` unique index claim guard to guarantee zero double billing.
   - `POST /api/billing/run` (dryRun, asOf).
   - Invoice PDF generation (`PDFKit`) via `GET /api/invoices/:id/pdf`.
   - Time Machine page (`TimeMachinePage.jsx`) and Invoice management UI (`InvoicesPage.jsx`, `InvoiceDetailPage.jsx`).
2. **Phase 6: Payments, Reminders, Collections, Customer Portal**:
   - Payment webhooks/mock gateway, refund handling.
   - Dunning & reminder jobs (`jobs/paymentReminders.js`) with `ReminderLog`.
   - Customer Portal invoice download and payment flows.
3. **Phase 7: Reports, MRR Waterfall, Dashboard, Advanced UI**:
   - MRR Waterfall analytics (`GET /api/reports/mrr-waterfall`).
   - Revenue, Churn, ARPU, LTV reports with Recharts.
   - Interactive Dashboard charts.
4. **Phase 8: Scale & Seed (10k subscriptions benchmark), Stress Testing**:
   - High-volume seed script (`npm run seed:bulk`) generating 10,000 subscriptions.
   - Index verification and query performance profiling (< 200ms target).
5. **Phase 9: Documentation, Packaging, Final QA**:
   - Docker-compose end-to-end testing, clean Readme, end-to-end verification.
