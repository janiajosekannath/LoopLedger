/**
 * api/reports.js
 * Phase 7 – Frontend API helpers for reports & dashboard analytics
 */
import client from './client';

export const reportsApi = {
  /** GET /api/reports/summary — KPI dashboard metrics */
  summary: () => client.get('/reports/summary').then((r) => r.data),

  /** GET /api/reports/mrr-waterfall?months=N */
  mrrWaterfall: (months = 12) =>
    client.get('/reports/mrr-waterfall', { params: { months } }).then((r) => r.data),

  /** GET /api/reports/revenue?months=N */
  revenue: (months = 12) =>
    client.get('/reports/revenue', { params: { months } }).then((r) => r.data),

  /** GET /api/reports/churn?months=N */
  churn: (months = 12) =>
    client.get('/reports/churn', { params: { months } }).then((r) => r.data),
};
