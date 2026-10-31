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
  - `User`: email (lowercase, unique), passwordHash (hidden), role (`admin`, `staff`, `customer`), customer ref, isActive, resetTokenHash, resetExpires.
  - `Customer`: name, email, phone, company, address, registeredAt, user ref. Text indexed.
  - `Product` & `ProductVariant`: product types, salesPrice, costPrice, notes, tax ref, variant compound unique index.
  - `SubscriptionPlan`: billingPeriod (`daily`, `weekly`, `monthly`, `yearly`), minQty, availableFrom/To, flags (`autoClose`, `allowEarlyClose`, `allowPause`, `allowRenew`, `active`).
  - `Tax`: name, percent (0-100), description, active.
  - `Discount`: fixed/percent, minPurchase, minQty, dates, usageLimit, timesUsed, scope (`product`, `subscription`).
  - `QuotationTemplate` & `Quotation`: draft -> quotation -> confirmed lifecycle, quote lines, pricing breakdown.
  - `Subscription`: statuses, lifecycle fields, nextBillingDate, compound indexes.
  - `Invoice`: line items, status (`draft`, `confirmed`, `paid`, `cancelled`), balance, applied discounts, issue/due dates.
  - `Payment`: methods, amount, paidOn, recordedBy.
  - `BillingPeriod` & `BillingRun`: unique compound index `(subscription, periodStart)` preventing double-billing.
  - `StatusHistory`, `ReminderLog`, `MrrChange`, `Counter`.
- **Authentication & Admin API**:
  - Strict password validation: >= 9 characters, >= 1 uppercase, >= 1 lowercase, >= 1 special character.
  - `POST /api/auth/signup`: creates customer-role User and automatically links Customer record.
  - `POST /api/auth/login`: validates credentials, issues JWT containing `{ userId, role, customerId }`.
  - `POST /api/auth/forgot-password`: single-use token, 30-min expiry, sends email or logs Ethereal link, never leaks email existence.
  - `POST /api/auth/reset-password`: single-use consumption of token, password update.
  - `GET /api/auth/me`: retrieves authenticated user profile and linked customer data.
  - `POST /api/admin/staff`: admin-only endpoint to create staff members.
  - `GET /api/admin/staff`: admin-only paginated staff list with search.
  - `PATCH /api/admin/staff/:id/toggle`: admin-only staff activation toggle.
  - `GET /api/health`: healthcheck endpoint.
- **Frontend Core**:
  - Vite + React 18 + Tailwind CSS + React Router v6 + TanStack Query + Axios.
  - Design tokens: Indigo accent, slate sidebar, clean white/gray cards.
  - Core components: `DataTable`, `Pagination`, `Modal`, `ConfirmDialog`, `StatusBadge`, `StatCard`, `PageHeader`, `EmptyState`, `Spinner`, `FormField`, `SearchInput`, `Toast`, `Timeline`.
  - Layouts: `AdminLayout` (responsive with collapsible dark sidebar) and `PortalLayout` (customer scoped).
  - Auth Pages: `LoginPage`, `SignupPage` (live password criteria checklist), `ForgotPasswordPage`, `ResetPasswordPage`, `NotFoundPage`.

---

## Phase 2: UI Shell, Shared Components, Customers, Staff — COMPLETED

### 1. Done in Phase 2
- **Backend Customers Module**:
  - Full CRUD API at `/api/customers` with Zod validation and central error handling.
  - Search across name, email, company, and phone with regex case-insensitive matching.
  - Pagination with configurable `limit` (capped at 100) and `page`, returning standard `{ success, data, meta: { page, limit, total, totalPages } }`.
  - Deletion business protection: deletes are strictly blocked (400 Bad Request) if linked subscriptions or invoices exist.
  - Sub-resource endpoints:
    - `GET /api/customers/:id/subscriptions` (with populated plans)
    - `GET /api/customers/:id/invoices` (with populated subscription number)
    - `GET /api/customers/:id/payments` (with populated invoice number and balance)
  - Customer security isolation: customers can only view their own profile and sub-resources via their JWT `customerId`; accessing other customer IDs returns 403 Forbidden.
- **Frontend Customers Module (`CustomersPage.jsx` & `CustomerDetailPage.jsx`)**:
  - `CustomersPage`:
    - Responsive DataTable with name initial avatars, email, company, phone, location (City, State), and registration dates.
    - Live SearchInput and Pagination controls.
    - Add and Edit Customer modal with full billing address fields and validation.
    - Delete customer flow with `ConfirmDialog` and error toasts if customer has active records.
    - Row-click navigation directly to detail view.
  - `CustomerDetailPage`:
    - Complete customer profile header with portal account status badge and full address display.
    - Real-time stat summary cards: Total Subscriptions, Total Invoiced count, and Total Revenue Collected (₹).
    - Three interactive tabs:
      1. **Subscriptions**: list showing subscription number, plan, cycle, status badge, start/next billing dates, amount in ₹.
      2. **Invoices**: list showing invoice number, issue date, due date, status badge (including overdue detection), total, balance due in ₹.
      3. **Payments**: list showing payment number, linked invoice, method, amount paid in ₹, paid date, and notes.
    - Inline Edit Customer profile modal.
- **Staff Management (`StaffPage.jsx`)**:
  - Admin-only access protected by `RoleRoute`.
  - List of staff members with name, email, role, status badges, and registration dates.
  - Search bar and pagination.
  - "Add Staff Member" modal with strict password criteria validation checklist.
  - One-click Activate / Deactivate toggle button hitting `PATCH /api/admin/staff/:id/toggle`.
- **Dashboard Shell (`DashboardPage.jsx`)**:
  - Six standard SaaS metric cards: Active Subscriptions, MRR (₹), ARR (₹), Total Revenue Collected (₹), Outstanding Payments (₹), and Overdue Invoices.
  - Recent Customers live feed loaded dynamically from `/api/customers?limit=5`.
  - Quick action buttons to navigate directly to Customer, Quotation, and Subscription flows.
- **Seed Script Enhanced (`backend/scripts/seed.js`)**:
  - Idempotent execution verified.
  - Seeded 10 realistic Indian customer accounts across diverse states (Maharashtra, Karnataka, Haryana, Telangana, Tamil Nadu, Gujarat, Delhi, Rajasthan) with corporate entities (TechVista, Nexa Group, SoftCraft, InfraEdge, DataBridge, CloudPlex, BuildFast, FinEdge, Singh Enterprises, Desai Technologies).
  - 2 customer accounts configured with portal access.
- **Test Suite Expanded (`backend/tests/customer.test.js`)**:
  - Comprehensive integration tests for customers API:
    - Unauthenticated request rejected (401).
    - Customer role blocked from listing all customers (403).
    - Admin and staff can list and search customers.
    - Pagination metadata verified.
    - Valid customer creation and duplicate email rejection (409).
    - Customer updates.
    - Customer deletion blocked when subscriptions exist (400).
    - Customer deletion succeeds when no dependencies exist (200).
    - Customer role can access own sub-resources but is blocked (403) from accessing another customer's data.
  - **All 24/24 Jest tests passing across both suites (`auth.test.js` & `customer.test.js`)**.
  - Frontend production build succeeds with 0 errors via `npm run build`.

---

### 2. Files Created & Modified in Phase 2
- `backend/src/controllers/customerController.js` (NEW)
- `backend/src/routes/customers.js` (NEW)
- `backend/src/app.js` (MODIFIED: mounted `/api/customers`)
- `backend/tests/customer.test.js` (NEW)
- `backend/scripts/seed.js` (MODIFIED: enhanced Indian customer locations and idempotency)
- `frontend/src/api/customers.js` (NEW)
- `frontend/src/api/staff.js` (NEW)
- `frontend/src/pages/CustomersPage.jsx` (MODIFIED: full CRUD UI with search, modals, pagination)
- `frontend/src/pages/CustomerDetailPage.jsx` (MODIFIED: profile, stats, Subscriptions/Invoices/Payments tabs)
- `frontend/src/pages/StaffPage.jsx` (MODIFIED: full staff management with invite & status toggle)
- `frontend/src/pages/DashboardPage.jsx` (MODIFIED: metric cards & recent customers live feed)
- `.gitignore` (MODIFIED: ignore local mongo data/ and binaries)

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
| GET | `/api/customers` | Admin, Staff | List customers with search, city/state filter & pagination |
| POST | `/api/customers` | Admin, Staff | Create a new customer |
| GET | `/api/customers/:id` | Admin, Staff, Customer (scoped) | Retrieve customer profile |
| PUT | `/api/customers/:id` | Admin, Staff | Update customer profile |
| DELETE | `/api/customers/:id` | Admin, Staff | Delete customer (blocked if subscriptions/invoices exist) |
| GET | `/api/customers/:id/subscriptions` | Admin, Staff, Customer (scoped) | List customer's subscriptions |
| GET | `/api/customers/:id/invoices` | Admin, Staff, Customer (scoped) | List customer's invoices |
| GET | `/api/customers/:id/payments` | Admin, Staff, Customer (scoped) | List customer's payments |
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
   npm run seed    # Seeds demo admin, staff, and 10 realistic Indian customers
   npm start       # Runs on http://localhost:5000
   ```
3. **Run Tests**:
   ```bash
   cd backend
   npm test        # Runs all 24 Jest integration tests (auth.test.js & customer.test.js)
   ```
4. **Run Frontend**:
   ```bash
   cd frontend
   npm run dev     # Runs on http://localhost:5173
   ```
5. **Test in Browser**:
   - Visit `http://localhost:5173/login`
   - Sign in as Admin (`admin@loopledger.dev` / `Admin@1234!`) -> Redirects to `/dashboard`
   - In Sidebar, click **Customers** -> View customer list, search by name/company/email, click **Add Customer**
   - Click any customer row -> View profile details, Subscriptions tab, Invoices tab, Payments tab
   - In Sidebar, click **Staff** -> View staff members, invite a new staff member, test status toggle
   - Sign in as Customer (`pooja@loopledger.dev` / `Customer@1234!`) -> Redirects to `/portal`

---

### 6. Known Issues / Sandbox Considerations
- On Windows sandboxed environments with loopback socket restrictions, running in-memory mongo tests (`mongodb-memory-server`) requires network binding permission (`BypassSandbox: true` or running outside restricted sandboxes).
- Ethereal email fallback generates an email preview URL in console when `SMTP_HOST` is omitted in development.

---

### 7. What is Next (Phase 3)
The next phase is **Phase 3: Catalog, Plans, Taxes, Discounts**:
- Admin writes, staff reads, customers none.
- Taxes CRUD with active toggle (GST 18%, GST 5%, Exempt 0%).
- Products CRUD (name, type, sales price, cost price, notes, default tax, archive), variants add and remove, search and filters, and price calculator (base ₹1,000 + Odoo +₹560 shows ₹1,560).
- Plans CRUD with every field and flag (`autoClose`, `allowEarlyClose`, `allowPause`, `allowRenew`, `active`), availableTo after availableFrom validation, flag badges, filters.
- Discounts (admin only to write): fixed or percent (0 to 100), minimum purchase, minimum quantity, dates, usage limit, scope product or subscription; backend validation; list shows computed status (active, scheduled, expired, exhausted) and used/limit.
- Build `services/discountEligibility.js` with unit tests (expired, not started, exhausted, below minimum quantity, below minimum purchase).
- Seed: 5 products with variants (including Business Software with Odoo +560), daily, weekly, monthly and yearly plans (one auto-close without pause, one with all flags on), taxes (GST 18%, GST 5%, Exempt 0%), discounts (10% at 10+ seats, fixed ₹500 above ₹5,000, one expired, one exhausted, one scheduled).
