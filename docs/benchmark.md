# LoopLedger API Performance Benchmark Results

**Date:** Sat, 31 Oct 2026 10:55:11 GMT  
**Environment:** Node.js v22.16.0 + Express + MongoDB Mongoose 8.4  
**SLA Threshold:** Max 2,000 ms (Target < 200 ms for indexed queries)  
**Iterations:** 5 runs per endpoint after warm-up  

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
| Invoice PDF Generation Stream | `GET /api/invoices/6ae5c90e29d6fdaa59ace7eb/pdf` | 200 | 20 | **24** | **28** | 28 | **PASS** |

### Summary Assessment
> [!NOTE]
> **ALL 10 CRITICAL WORKFLOWS PASSED SLA REQUIREMENTS.**
> All queries utilize optimized compound MongoDB indexes with lean projection pipelines.
