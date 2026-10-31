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
- **Frontend Core**:
  - Vite + React 18 + Tailwind CSS + React Router v6 + TanStack Query + Axios.
  - Design tokens: Indigo accent, slate sidebar, clean white/gray cards.
  - Core components: `DataTable`, `Pagination`, `Modal`, `ConfirmDialog`, `StatusBadge`, `StatCard`, `PageHeader`, `EmptyState`, `Spinner`, `FormField`, `SearchInput`, `Toast`, `Timeline`.
  - Layouts: `AdminLayout` (responsive with collapsible dark sidebar) and `PortalLayout` (customer scoped).
  - Auth Pages: `LoginPage`, `SignupPage` (live password criteria checklist), `ForgotPasswordPage`, `ResetPasswordPage`, `NotFoundPage`.
  - Frontend builds with 0 errors via `npm run build`.
- **Tests**:
  - Jest + Supertest + MongoDB integration test suite in `backend/tests/auth.test.js`.
  - **12/12 passing tests**:
    1. 8-character password rejected
    2. 9-character password accepted
    3. Password missing uppercase rejected
    4. Password missing special char rejected
    5. Duplicate email returns 409
    6. Staff cannot create another staff (403)
    7. Customer blocked from admin routes (403)
    8. Unauthenticated request blocked (401)
    9. Admin can create staff (201)
    10. Reset token is single-use only
    11. Signup response does not leak passwordHash or resetTokenHash
    12. Login response does not leak passwordHash or resetTokenHash
- **Seed Script**:
  - `backend/scripts/seed.js` seeded with 1 Admin, 2 Staff, and 10 realistic Indian customers (2 with portal logins).

---

### 2. Files Created
- `docker-compose.yml`, `.env.example`, `.gitignore`
- `backend/package.json`, `backend/Dockerfile`
- `backend/src/config/database.js`, `backend/src/config/mailer.js`
- `backend/src/models/User.js`, `Customer.js`, `Product.js`, `SubscriptionPlan.js`, `Tax.js`, `Discount.js`, `Quotation.js`, `QuotationTemplate.js`, `Subscription.js`, `Invoice.js`, `Payment.js`, `Billing.js`, `History.js`
- `backend/src/utils/money.js`, `sequence.js`, `asyncHandler.js`
- `backend/src/middleware/errorHandler.js`, `auth.js`
- `backend/src/controllers/authController.js`, `adminController.js`
- `backend/src/routes/auth.js`, `admin.js`
- `backend/src/app.js`, `server.js`
- `backend/scripts/seed.js`
- `backend/tests/auth.test.js`
- `frontend/package.json`, `vite.config.js`, `tailwind.config.js`, `postcss.config.js`, `index.html`
- `frontend/src/index.css`, `main.jsx`, `App.jsx`
- `frontend/src/api/client.js`, `auth.js`
- `frontend/src/context/AuthContext.jsx`, `ProtectedRoute.jsx`
- `frontend/src/components/*` (13 reusable shared UI components)
- `frontend/src/layouts/AdminLayout.jsx`, `PortalLayout.jsx`
- `frontend/src/pages/*` (Auth pages + route stubs for Phase 2-7)

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
- Node.js 18+ (tested on Node 22.16)
- MongoDB running locally on `localhost:27017` or via Docker: `docker compose up mongo -d`

#### Step-by-Step
1. **Configure Environment**:
   ```bash
   cp .env.example backend/.env
   ```
2. **Run Backend**:
   ```bash
   cd backend
   npm run seed    # Seeds demo admin, staff, and 10 customers
   npm start       # Runs on http://localhost:5000
   ```
3. **Run Tests**:
   ```bash
   cd backend
   npm test        # Runs all 12 Jest integration tests
   ```
4. **Run Frontend**:
   ```bash
   cd frontend
   npm run dev     # Runs on http://localhost:5173
   ```
5. **Test in Browser**:
   - Visit `http://localhost:5173/login`
   - Sign in as Admin (`admin@loopledger.dev` / `Admin@1234!`) -> Redirects to `/dashboard`
   - Sign in as Customer (`pooja@loopledger.dev` / `Customer@1234!`) -> Redirects to `/portal`
   - Visit `http://localhost:5173/signup` -> Test live password validation indicators

---

### 6. Known Issues / Sandbox Considerations
- On Windows sandboxed environments with loopback socket restrictions, running in-memory mongo tests (`mongodb-memory-server`) requires network binding permission (`BypassSandbox: true` or running outside restricted sandboxes).
- Ethereal email fallback generates an email preview URL in console when `SMTP_HOST` is omitted in development.

---

### 7. What is Next (Phase 2)
The next team member will build **Phase 2: UI Shell, Shared Components, Customers, Staff**:
- Implement full Customers CRUD with search (name, email, company, phone), filters, and pagination.
- Customer detail page with profile and tabs for Subscriptions, Invoices, Payments (`/api/customers/:id/subscriptions`, `/invoices`, `/payments`).
- Staff management page for Admin (list, create, activate/deactivate).
- Connect real backend APIs for Customers (`/api/customers`) and Staff (`/api/admin/staff`).
