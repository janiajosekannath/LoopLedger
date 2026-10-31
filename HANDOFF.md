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
    - Add/Edit modal with dynamic variant rows (e.g. Brand: Odoo Edition +₹560).
    - **Interactive Price Calculator**: Pick any product and variant, adjust quantity, and observe live calculation proving:
      `Effective Unit Price = Base Sales Price + Variant Extra Price`
      `Example: ₹1,000 (Base) + ₹560 (Odoo Brand) = ₹1,560 Unit Price`
      Displays tax calculation and grand total in INR (₹).
- **Subscription Plans Module (`/api/plans`)**:
  - Full CRUD with billing periods (`daily`, `weekly`, `monthly`, `yearly`), minimum quantity thresholds, and availability windows.
  - Backend validation: `availableTo` must be after `availableFrom`.
  - Policy flags support: `autoClose`, `allowEarlyClose`, `allowPause`, `allowRenew`, and `active`.
  - `availableAsOf` query filter to find active plans at a specific date.
  - `PlansPage.jsx`: Search, billing cycle filters, flag badges (`Auto-Close`, `Pause OK`, `Early Close`, `Renewable`), add/edit modal.
- **Discounts Module (`/api/discounts`)**:
  - Full CRUD (Admin only to write).
  - Types: `fixed` or `percent` (0-100 validated).
  - Scope: `product` or `subscription`.
  - Backend validation: `endDate` must be after `startDate`, and `usageLimit` cannot be lowered below existing `timesUsed`.
  - Dynamic computed status evaluator: `active`, `scheduled`, `expired`, `exhausted`, `inactive`.
  - `DiscountsPage.jsx`: Search, type & scope filters, usage tracking (`timesUsed / usageLimit`), computed status badges, add/edit modal.
- **Discount Eligibility Engine (`services/discountEligibility.js`)**:
  - Evaluates discount eligibility against purchase criteria (subtotal, quantity, product scope, subscription scope, date range, usage limits).
  - `tests/discountEligibility.test.js`: 8 unit tests covering active, inactive, not started (scheduled), expired, exhausted, below minimum quantity, below minimum purchase, and product-scoped matching.
- **Seed Data**:
  - 3 Taxes: `GST 18%`, `GST 5%`, `Exempt 0%`.
  - 5 Products with realistic variants (including `Business Software Suite` with `Odoo Edition` +₹560).
  - 4 Subscription Plans (Startup Daily, Growth Weekly with auto-close without pause, Enterprise Monthly with all flags enabled, Corporate Annual).
  - 5 Discounts: 10% at 10+ seats, ₹500 off above ₹5,000, Expired Festive Offer 2025, Exhausted Early Adopter, Scheduled New Year 2027.
- **Integration Tests**:
  - `backend/tests/catalog.test.js` covering tax, product, plan, and discount rules.
  - **All 41/41 tests passing across 4 suites** (`auth.test.js`, `customer.test.js`, `catalog.test.js`, `discountEligibility.test.js`).
  - Frontend production build succeeds with 0 errors via `npm run build`.

---

### 2. Files Created & Modified in Phase 3
- `backend/src/services/discountEligibility.js` (NEW: status evaluator & eligibility engine)
- `backend/src/controllers/taxController.js` (NEW)
- `backend/src/routes/taxes.js` (NEW)
- `backend/src/controllers/productController.js` (NEW)
- `backend/src/routes/products.js` (NEW)
- `backend/src/controllers/planController.js` (NEW)
- `backend/src/routes/plans.js` (NEW)
- `backend/src/controllers/discountController.js` (NEW)
- `backend/src/routes/discounts.js` (NEW)
- `backend/src/app.js` (MODIFIED: mounted catalog routes)
- `backend/scripts/seed.js` (MODIFIED: seeded complete catalog, plans, taxes, discounts)
- `backend/tests/discountEligibility.test.js` (NEW)
- `backend/tests/catalog.test.js` (NEW)
- `frontend/src/api/catalog.js` (NEW: axios endpoints for taxes, products, plans, discounts)
- `frontend/src/pages/TaxesPage.jsx` (MODIFIED: full CRUD & toggle UI)
- `frontend/src/pages/ProductsPage.jsx` (MODIFIED: products, variants & interactive price calculator)
- `frontend/src/pages/PlansPage.jsx` (MODIFIED: plans, policy flags, availability window)
- `frontend/src/pages/DiscountsPage.jsx` (MODIFIED: discounts, computed status, threshold rules)

---

### 3. API Endpoints Available
| Method | Path | Access | Description |
|---|---|---|---|
| POST | `/api/auth/signup` | Public | Register customer account & profile |
| POST | `/api/auth/login` | Public | Log in and receive JWT token |
| POST | `/api/auth/forgot-password` | Public | Request password reset email |
| POST | `/api/auth/reset-password` | Public | Reset password with token |
| GET | `/api/auth/me` | Authenticated | Retrieve current user profile |
| POST | `/api/admin/staff` | Admin | Create new staff user |
| GET | `/api/admin/staff` | Admin | List staff members with pagination |
| PATCH | `/api/admin/staff/:id/toggle` | Admin | Toggle staff active status |
| GET | `/api/customers` | Admin, Staff | List customers with search & pagination |
| POST | `/api/customers` | Admin, Staff | Create a new customer |
| GET | `/api/customers/:id` | Admin, Staff, Customer (scoped) | Retrieve customer profile |
| PUT | `/api/customers/:id` | Admin, Staff | Update customer profile |
| DELETE | `/api/customers/:id` | Admin, Staff | Delete customer (blocked if subscriptions exist) |
| GET | `/api/customers/:id/subscriptions` | Admin, Staff, Customer (scoped) | List customer's subscriptions |
| GET | `/api/customers/:id/invoices` | Admin, Staff, Customer (scoped) | List customer's invoices |
| GET | `/api/customers/:id/payments` | Admin, Staff, Customer (scoped) | List customer's payments |
| GET | `/api/taxes` | Admin, Staff | List tax rates with filter |
| POST | `/api/taxes` | Admin | Create new tax rate |
| PUT | `/api/taxes/:id` | Admin | Update tax rate |
| PATCH | `/api/taxes/:id/toggle` | Admin | Toggle tax active status |
| DELETE | `/api/taxes/:id` | Admin | Delete tax rate |
| GET | `/api/products` | Admin, Staff | List products with variants & tax populated |
| POST | `/api/products` | Admin | Create product with variants |
| GET | `/api/products/:id` | Admin, Staff | Get product with variants |
| PUT | `/api/products/:id` | Admin | Update product |
| DELETE | `/api/products/:id` | Admin | Archive product |
| POST | `/api/products/:id/variants` | Admin | Add variant to product |
| PUT | `/api/products/:id/variants/:variantId` | Admin | Update product variant |
| DELETE | `/api/products/:id/variants/:variantId` | Admin | Delete product variant |
| GET | `/api/plans` | Admin, Staff | List subscription plans with filters |
| POST | `/api/plans` | Admin | Create subscription plan |
| GET | `/api/plans/:id` | Admin, Staff | Get subscription plan |
| PUT | `/api/plans/:id` | Admin | Update subscription plan |
| PATCH | `/api/plans/:id/toggle` | Admin | Toggle plan active status |
| DELETE | `/api/plans/:id` | Admin | Delete subscription plan |
| GET | `/api/discounts` | Admin, Staff | List discounts with computed status |
| POST | `/api/discounts` | Admin | Create discount rule |
| GET | `/api/discounts/:id` | Admin, Staff | Get discount rule |
| PUT | `/api/discounts/:id` | Admin | Update discount rule |
| PATCH | `/api/discounts/:id/toggle` | Admin | Toggle discount active status |
| DELETE | `/api/discounts/:id` | Admin | Delete or mark inactive discount |
| GET | `/api/health` | Public | Healthcheck endpoint |

---

### 4. Demo Logins
All demo passwords follow the strict policy (`>= 9 chars`, uppercase, lowercase, special char):

- **Super Admin**:
  - Email: `admin@loopledger.dev`
  - Password: `Admin@1234!`
  - Role: `admin` (access to all modules, staff management, settings)
- **Staff 1**:
  - Email: `staff1@loopledger.dev`
  - Password: `Staff@1234!`
  - Name: Priya Sharma
  - Role: `staff`
- **Staff 2**:
  - Email: `staff2@loopledger.dev`
  - Password: `Staff@5678!`
  - Name: Rohit Verma
  - Role: `staff`
- **Customer 1 (Portal)**:
  - Email: `pooja@loopledger.dev`
  - Password: `Customer@1234!`
  - Company: Singh Enterprises
  - Role: `customer` (lands on `/portal`)
- **Customer 2 (Portal)**:
  - Email: `amit@loopledger.dev`
  - Password: `Customer@5678!`
  - Company: Desai Technologies
  - Role: `customer` (lands on `/portal`)

---

### 5. How to Run & Test
#### Prerequisites
- Node.js 18+ (tested on Node 24.17)
- Standalone MongoDB running locally on `localhost:27017` or via Docker: `docker compose up mongo -d`

#### Step-by-Step
1. **Configure Environment**:
   ```bash
   cp .env.example backend/.env
   ```
2. **Run Backend**:
   ```bash
   cd backend
   npm run seed    # Seeds demo admin, staff, 10 customers, products, plans, taxes, discounts
   npm start       # Runs on http://localhost:5000
   ```
3. **Run Tests**:
   ```bash
   cd backend
   npm test        # Runs all 41 Jest tests across 4 suites
   ```
4. **Run Frontend**:
   ```bash
   cd frontend
   npm run dev     # Runs on http://localhost:5173
   ```
5. **Test in Browser**:
   - Sign in as Admin (`admin@loopledger.dev` / `Admin@1234!`).
   - Navigate to **Catalog > Products** -> View Business Software Suite, click **Price Check** -> test base ₹1,000 + Odoo Brand (+₹560) = ₹1,560.
   - Navigate to **Catalog > Plans** -> View Daily, Weekly, Monthly, Yearly plans and their policy badges.
   - Navigate to **Catalog > Taxes** -> View GST 18%, GST 5%, Exempt 0%, test toggle and add.
   - Navigate to **Catalog > Discounts** -> View computed statuses: `active`, `scheduled`, `expired`, `exhausted`.

---

### 6. Known Issues / Sandbox Considerations
- On Windows sandboxed environments with loopback socket restrictions, running in-memory mongo tests (`mongodb-memory-server`) requires network binding permission (`BypassSandbox: true` or running outside restricted sandboxes).
- Ethereal email fallback generates an email preview URL in console when `SMTP_HOST` is omitted in development.

---

### 7. Next Phase (Phase 4) – To be completed by teammate
The next phase is **Phase 4: Pricing Engine, Quotations, Subscriptions**:
- Single pricing engine `services/pricingEngine.js quote({lines, planId, customerId, asOf})`. Unit price = product sales price + variant extra price; enforce plan minQty; eligible product-scoped discounts to lines, then subscription-scoped discounts; tax on discounted amount. Expose `POST /api/pricing/quote`.
- Audit service `services/audit.js` and `GET /api/history/:entityType/:entityId`.
- Quotation templates CRUD.
- Quotations: from template or scratch, QUO number, validUntil = today + validityDays, live totals, draft -> quotation -> confirmed, expired ones cannot be confirmed; `POST /api/quotations/:id/confirm` creates subscription and links both.
- Subscriptions: SUB number, customer, plan, start, expiry, payment terms, lines, billing interval, next billing date; state machine draft -> quotation -> confirmed -> active -> closed plus active <-> paused; activating sets nextBillingDate = startDate and writes MrrChange new; endpoints transition, pause, resume, close (writes MrrChange churn), renew; flags enforced.
- Daily cron `jobs/autoClose.js` closes active subscriptions past expiry when plan has autoClose.
- UI: templates, quotations list & editor with live totals, subscriptions list & details page with lifecycle stepper, action buttons, lines table, audit Timeline.
- Seed: 3 templates, quotations in each status, at least 25 subscriptions spread over 6 months with history and MrrChange.
