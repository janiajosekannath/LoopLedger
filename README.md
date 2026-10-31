# LoopLedger — Subscription Billing You Can Prove Is Correct

> **Brightloop Subscription Management System**  
> Currency: Indian Rupee (₹ / INR) | Architecture: Decoupled Full-Stack SaaS  
> Status: **Production Ready (Phases 1–9 Complete)**

---

## 1. Executive Summary & Core Value Proposition

Traditional subscription management systems suffer from silent billing drifts, duplicate invoices, and fuzzy revenue figures. **LoopLedger** solves this with an immutable, verifiable ledger approach to recurring billing:

1. **Idempotent Billing Ledger:** Utilizes an atomic unique index claim guard on `(subscription, periodStart)` ensuring that under no circumstances can a subscription be billed twice or skipped, even under concurrent execution.
2. **Billing Time Machine:** Allows billing managers to fast-forward into the future or simulate any past date with a full dry-run preview before executing live financial invoices.
3. **Single Source of Truth Pricing Engine:** All prices, discounts, and taxes for quotations, subscriptions, and recurring invoices flow through one central engine (`services/pricingEngine.js`).
4. **Verifiable MRR Waterfall:** Tracks monthly recurring revenue movements (`new`, `expansion`, `contraction`, `churn`) with an exact reconciliation formula:  
   $$\text{Closing MRR} = \text{Opening MRR} + \text{New} + \text{Expansion} - \text{Contraction} - \text{Churn}$$
5. **Collections Cockpit:** Categorizes overdue invoices into aging buckets (1–7, 8–30, 31–60, 60+ days) and automates dunning reminders via email with a 3-day quiet cooldown.
6. **Audit Timeline:** Immutable status history (`StatusHistory`) on every quotation, subscription, invoice, and payment.
7. **Benchmarked for Scale:** Stress-tested with 10,000 subscriptions and sub-100ms response times across all primary endpoints.

---

## 2. System Architecture

```mermaid
flowchart TD
    subgraph Frontend["Frontend Client (React 18 + Vite)"]
        UI["Tailwind CSS + Lucide Icons + Recharts"]
        Client["Axios Client + JWT Interceptors"]
        Router["React Router v6 (Admin & Portal Layouts)"]
    end

    subgraph Backend["Backend Core (Express + Node.js)"]
        MW["Security Middleware (Helmet, CORS, Rate Limit)"]
        Auth["Auth & RBAC (Admin, Staff, Customer)"]
        Pricing["Single Pricing Engine (services/pricingEngine.js)"]
        Billing["Billing Engine & Time Machine (services/billingEngine.js)"]
        Reports["Analytics & Aggregation Pipelines (services/reportsService.js)"]
        Jobs["Cron Schedulers (Auto-Close, Dunning Reminders)"]
    end

    subgraph Database["Database & Services (MongoDB Standalone)"]
        Mongo[("MongoDB Collections\nUsers, Customers, Products, Plans\nSubscriptions, Invoices, Payments\nBillingPeriods, MrrChanges, StatusHistory")]
        Mailer["Nodemailer (Ethereal Dev / SMTP Prod)"]
        PDF["PDFKit Invoice Generator"]
    end

    UI --> Client --> MW --> Auth
    Auth --> Pricing & Billing & Reports & Jobs
    Pricing & Billing & Reports --> Mongo
    Billing --> PDF & Mailer
```

---

## 3. Technology Stack

- **Frontend:** React 18, Vite, Tailwind CSS, Recharts, Lucide React, React Router v6, TanStack Query, Axios.
- **Backend:** Node.js, Express, Mongoose 8.4, Zod, jsonwebtoken, bcrypt, node-cron, Nodemailer, PDFKit, Helmet, express-rate-limit.
- **Database:** MongoDB (standalone, no replica set requirement).
- **Testing:** Jest, Supertest, mongodb-memory-server (zero external dependencies required for test runs).

---

## 4. Key Features Mapped to Requirements

| Module | Features & Capabilities |
|---|---|
| **Auth & RBAC** | Strict password validation (>=9 chars, uppercase, lowercase, special char), bcrypt hashing, JWT authentication, forgot/reset password with single-use tokens, staff management for Admin, role scoping for Customers. |
| **Catalog & Plans** | Products with multi-attribute variants and extra prices (e.g. ₹1,000 base + ₹560 Odoo = ₹1,560 effective price). Plans with billing periods (`daily`, `weekly`, `monthly`, `yearly`), `minQty`, date windows, and policy flags (`autoClose`, `allowEarlyClose`, `allowPause`, `allowRenew`). |
| **Discounts & Taxes** | Fixed or percentage discounts, `minPurchase`, `minQty`, dynamic computed status (`active`, `scheduled`, `expired`, `exhausted`), automatic usage counter tracking. GST taxes (18%, 5%, 0% exempt). |
| **Pricing Engine** | Centralized in `services/pricingEngine.js`. Calculates product discounts first, then subscription discounts, then taxes on discounted amounts. Enforces minimum quantities. All monetary values rounded to 2 decimals (`round2`). |
| **Quotations** | `QUO-000001` sequencing. Draft $\to$ Quotation $\to$ Confirmed. One-click conversion to active subscription without data re-entry. |
| **Subscriptions** | `SUB-000001` sequencing. Complete lifecycle: draft $\to$ quotation $\to$ confirmed $\to$ active $\leftrightarrow$ paused $\to$ closed. Plan policy enforcement on pause, close, renew. Automatic MRR change logging. |
| **Billing Time Machine** | `POST /api/billing/run` with `dryRun` and `asOf` date picker. Idempotent `BillingPeriod` claim guard guarantees zero duplicate invoices. Catches up all unbilled periods across missed days/weeks/months. |
| **Invoices & PDF** | `INV-000001` sequencing. Professional PDFKit invoices with download (`/api/invoices/:id/pdf`), email delivery, status tracking (`draft`, `confirmed`, `paid`, `cancelled`). |
| **Payments & Gateway Stub** | `PAY-000001` sequencing. Atomic balance deductions with conditional update guard preventing overpayment. Documented integration stub in `services/paymentGateway.js`. Webhook endpoint (`/api/payments/webhook`). |
| **Collections Cockpit** | Overdue aging buckets (1–7, 8–30, 31–60, 60+ days). On-demand and daily scheduled dunning email campaigns (`jobs/paymentReminders.js`) with 3-day quiet window. |
| **Customer Portal** | Scoped view for authenticated customer: view active subscriptions, inspect and download invoice PDFs, pay outstanding balance online via portal. |
| **Reports & MRR Waterfall** | Live MRR, ARR, ARPU, LTV, churn rate, revenue breakdown (daily, monthly, yearly), subscription growth, status distribution donut, and 12-month MRR waterfall chart. |

---

## 5. Installation & Setup

### Prerequisites
- Node.js >= 18.x (v22 tested)
- npm >= 9.x
- MongoDB (local or via Docker)

### Option A: With Docker Compose
```bash
# Clone the repository
git clone https://github.com/Gayathri6031/LoopLedger.git
cd LoopLedger

# Spin up MongoDB, Backend, and Frontend containers
docker compose up -d

# Seed the database
docker compose exec backend npm run seed
```

### Option B: Local Setup (Without Docker)

#### 1. Backend Setup
```bash
cd backend
npm install
cp .env.example .env

# Seed standard demo database (Admin, Staff, Customers, Catalog, Subscriptions, Invoices)
npm run seed

# Start backend server (runs on http://localhost:5000)
npm run dev
```

#### 2. Frontend Setup
```bash
cd ../frontend
npm install

# Start Vite dev server (runs on http://localhost:5173)
npm run dev
```

---

## 6. Environment Variables (`backend/.env.example`)

```ini
PORT=5000
MONGO_URI=mongodb://localhost:27017/loopledger
JWT_SECRET=super_secret_loopledger_jwt_key_must_be_32_chars_long!
JWT_EXPIRES_IN=7d
CLIENT_URL=http://localhost:5173

# SMTP Mailer (Leave empty for automatic Ethereal test inbox)
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
MAIL_FROM=no-reply@loopledger.dev
```

---

## 7. Demo Credentials

| Role | Name | Email | Password | Access Level |
|---|---|---|---|---|
| **Super Admin** | Super Admin | `admin@loopledger.dev` | `Admin@1234!` | Full System Access, Staff, Billing, Reports |
| **Staff 1** | Priya Sharma | `staff1@loopledger.dev` | `Staff@1234!` | Catalog, Subscriptions, Invoices, Payments |
| **Staff 2** | Rohit Verma | `staff2@loopledger.dev` | `Staff@5678!` | Catalog, Subscriptions, Invoices, Payments |
| **Customer 1** | Pooja Singh | `pooja@loopledger.dev` | `Customer@1234!` | Customer Portal (`/portal`), Invoices, Pay Online |
| **Customer 2** | Amit Desai | `amit@loopledger.dev` | `Customer@5678!` | Customer Portal (`/portal`), Subscriptions, PDFs |

---

## 8. 10-Step Interactive Demo Walkthrough

1. **Login & Security:** Log in as `admin@loopledger.dev` with `Admin@1234!`. Note the secure session and dark sidebar navigation.
2. **Product & Dynamic Variant Pricing:** Navigate to **Catalog $\to$ Products**. Open the Price Calculator on "Business Management Suite" and select the "Odoo" variant. Observe unit price compute to exactly ₹1,560 (₹1,000 base + ₹560 variant).
3. **Discount Rules:** Navigate to **Catalog $\to$ Discounts**. Review the "10% at 10 Seats" active rule and observe usage limit counters.
4. **Quotation to Subscription:** Navigate to **Sales $\to$ Quotations**. Click "New Quotation", pick a customer, add line items with live price preview, and click **Confirm**. The system automatically provisions a linked `SUB-xxxxxx` without data re-entry.
5. **Subscription Lifecycle & Policy Flags:** Navigate to **Sales $\to$ Subscriptions**. View the subscription stepper. Try pausing a subscription with `allowPause: false` and verify policy rejection. Click **Activate** to start billing and log `new` MRR.
6. **Billing Time Machine Preview:** Navigate to **Billing $\to$ Time Machine**. Pick a future date (e.g., +30 days) and click **Preview Billing Run**. View the line-by-line forecast of what will be billed.
7. **Idempotent Billing Run:** Click **Execute Live Run**. Invoices are generated. Click **Execute Live Run** a second time for the exact same date and verify that **0 duplicates** are created due to the atomic `BillingPeriod` claim guard.
8. **Invoice PDF Generation & Email:** Navigate to **Billing $\to$ Invoices**. Open any invoice, click **Download PDF** to inspect the professional PDFKit layout, or click **Send Email** to see the preview link.
9. **Record Payment & Auto-Settlement:** Click **Record Payment** against a confirmed invoice. Settle ₹2,000 via UPI. Watch the balance reduce in real time and the status change to `paid`.
10. **Reports & MRR Waterfall:** Navigate to **Insights $\to$ Reports**. Inspect the **MRR Waterfall** tab showing opening MRR, new activations, churn, and closing MRR. Switch to **Revenue** and **Churn** tabs to view live Recharts analytics.

---

## 9. Performance Benchmark Results (10,000 Subscriptions Scale)

LoopLedger includes an automated benchmark suite (`npm run benchmark`) measuring median and 95th-percentile latencies against an SLA limit of 2,000 ms:

| Benchmark Case | Endpoint | HTTP Status | Min (ms) | Median (ms) | p95 (ms) | Max (ms) | SLA (<2000ms) |
|---|---|:---:|:---:|:---:|:---:|:---:|:---:|
| Subscriptions List (Search & Filter) | `GET /api/subscriptions` | 200 | 5 | **6** | **9** | 9 | **PASS** |
| Invoices List (Status & Overdue) | `GET /api/invoices` | 200 | 12 | **13** | **16** | 16 | **PASS** |
| Customers List | `GET /api/customers` | 200 | 4 | **4** | **5** | 5 | **PASS** |
| Payments List | `GET /api/payments` | 200 | 8 | **10** | **10** | 10 | **PASS** |
| Dashboard Summary KPIs | `GET /api/reports/summary` | 200 | 14 | **15** | **17** | 17 | **PASS** |
| Revenue Analytics Report | `GET /api/reports/revenue` | 200 | 3 | **5** | **5** | 5 | **PASS** |
| MRR Waterfall Report | `GET /api/reports/mrr-waterfall` | 200 | 4 | **4** | **5** | 5 | **PASS** |
| Collections Cockpit Aging | `GET /api/collections/aging` | 200 | 10 | **12** | **14** | 14 | **PASS** |
| Billing Time Machine (Dry Run) | `POST /api/billing/run` | 200 | 16 | **18** | **21** | 21 | **PASS** |
| Invoice PDF Generation Stream | `GET /api/invoices/:id/pdf` | 200 | 20 | **24** | **28** | 28 | **PASS** |

*All 10 critical workflows execute in under 30 ms on indexed collections.*

---

## 10. Automated Test Suite

LoopLedger maintains comprehensive automated tests with **zero external database dependencies** using `mongodb-memory-server`:

```bash
cd backend
npm test
```

### Test Coverage Highlights
- `auth.test.js` — Password validation (8 chars fails, >=9 chars with uppercase, lowercase, special passes), duplicate email 409, single-use reset token.
- `catalog.test.js` — Role access control (staff read-only, admin write), product variants, plan date validation.
- `customer.test.js` — CRUD, regex search, delete protection when active subscriptions exist.
- `pricingEngine.test.js` — Single source of truth pricing, product vs subscription discount precedence, minQty rules, tax calculation.
- `quotation.test.js` — Number sequencing (`QUO-xxxxxx`), validity expiration, confirmed quotation to subscription conversion.
- `subscription.test.js` — Lifecycle state machine, `allowPause`, `allowEarlyClose`, `allowRenew` policy enforcement, daily auto-close cron.
- `payment.test.js` & `payments.test.js` — Atomic balance decrement, partial payment, full payment status transition.
- `reminders.test.js` — Overdue detection, dunning email dispatch, `ReminderLog` creation, 3-day quiet period enforcement.
- `portalPayments.test.js` — Scoped customer access, cross-customer isolation (403 Forbidden).
- `mrr.test.js` — MRR normalization across daily/weekly/monthly/yearly, delta calculation, waterfall reconciliation.
- `security.test.js` — Full API route traversal asserting authentication, RBAC enforcement, credential masking (no `passwordHash` in responses), Helmet security headers.

**Result: 13 Test Suites, 108 Tests, 100% Passing.**

---

## 11. Known Limitations & Architectural Notes

1. **Payment Gateway Integration:** In accordance with financial auditing requirements, payments in this build are recorded manually by administrative staff or initiated by customers via the portal. A documented integration stub is provided in `services/paymentGateway.js`. Live payment processors (Razorpay, Stripe, Cashfree) can be plugged in by implementing its interface and webhook listeners.
2. **Email Delivery:** In local development without SMTP credentials, LoopLedger creates an ephemeral Ethereal test inbox and outputs clickable preview URLs in logs. In production, configure `SMTP_HOST`, `SMTP_USER`, and `SMTP_PASS` for live transactional mail.

---

## 12. Team & Attribution

Developed by the **LoopLedger Engineering Team** for the Brightloop Subscription Management challenge.
- Built strictly on `main` branch.
- Fully verified end-to-end.
