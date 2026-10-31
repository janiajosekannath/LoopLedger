// services/billingEngine.js
// Idempotent batch billing engine for LoopLedger.
// Creates BillingPeriod claims, computes invoice lines via pricingEngine,
// creates draft Invoices, updates Subscription.nextBillingDate, and records a BillingRun.

const mongoose = require('mongoose');
const BillingPeriod = require('../models/BillingPeriod');
const BillingRun = require('../models/BillingRun');
const Subscription = require('../models/Subscription');
const Invoice = require('../models/Invoice');
const pricingEngine = require('./pricingEngine');
const { recordStatusChange } = require('./audit');
const { getDuePeriods } = require('./billingPeriods');
const { nextSequence } = require('../utils/sequence');

/**
 * Run billing for all due subscription periods up to `asOf`.
 * @param {Object} options
 * @param {Date|string} [options.asOf] - Date up to which periods are billed (default: now).
 * @param {boolean} [options.dryRun=false] - If true, only simulate, no DB writes.
 * @param {string} [options.triggeredBy] - Identifier of caller (e.g., user email or cron).
 * @returns {Promise<Object>} Summary of the run.
 */
async function runBilling({ asOf = new Date(), dryRun = false, triggeredBy = 'system' } = {}) {
  const mode = dryRun ? 'dry' : 'live';
  const evaluationDate = asOf ? new Date(asOf) : new Date();

  const run = new BillingRun({
    mode,
    asOf: evaluationDate,
    triggeredBy,
    createdCount: 0,
    skippedCount: 0,
    failedCount: 0,
    details: [],
  });

  // ---------------------------------------------------------------------
  // DRY RUN – only compute previews, no persistence.
  // ---------------------------------------------------------------------
  if (dryRun) {
    const subs = await Subscription.find({ status: { $in: ['active', 'confirmed'] } }).populate('plan');
    for (const sub of subs) {
      const periods = getDuePeriods(sub, evaluationDate);
      for (const p of periods) {
        try {
          const quote = await pricingEngine.quote({
            lines: sub.lines || [],
            planId: sub.plan?._id || sub.plan,
            customerId: sub.customer,
            subscriptionId: sub._id,
            asOf: p.periodStart,
          });
          run.createdCount += 1;
          run.details.push({
            subscription: sub._id,
            periodStart: p.periodStart,
            outcome: 'created',
            reason: 'dry-run preview',
            invoice: null,
          });
        } catch (e) {
          run.failedCount += 1;
          run.details.push({
            subscription: sub._id,
            periodStart: p.periodStart,
            outcome: 'failed',
            reason: e.message,
            invoice: null,
          });
        }
      }
    }
    await run.save();
    return { runId: run._id, created: run.createdCount, skipped: run.skippedCount, failed: run.failedCount };
  }

  // ---------------------------------------------------------------------
  // LIVE RUN – full persistence with idempotent claim.
  // ---------------------------------------------------------------------
  const liveSubs = await Subscription.find({ status: { $in: ['active', 'confirmed'] } }).populate('plan');

  for (const sub of liveSubs) {
    const periods = getDuePeriods(sub, evaluationDate);
    for (const p of periods) {
      try {
        // 1️⃣ Insert claim – unique index guarantees single billing per period.
        const claim = await BillingPeriod.create({
          subscription: sub._id,
          periodStart: p.periodStart,
          periodEnd: p.periodEnd,
          runId: run._id,
        });

        // 2️⃣ Compute pricing via existing engine.
        const quote = await pricingEngine.quote({
          lines: sub.lines || [],
          planId: sub.plan?._id || sub.plan,
          customerId: sub.customer,
          subscriptionId: sub._id,
          asOf: p.periodStart,
        });

        const invoiceNumber = await nextSequence('INV');

        // 3️⃣ Persist draft invoice.
        const invoice = await Invoice.create({
          number: invoiceNumber,
          customer: sub.customer,
          subscription: sub._id,
          billingPeriodStart: p.periodStart,
          billingPeriodEnd: p.periodEnd,
          issueDate: new Date(),
          dueDate: new Date(new Date(p.periodStart).getTime() + 15 * 86400000),
          lines: quote.lines,
          subtotal: quote.subtotal,
          discountTotal: quote.discountTotal,
          taxTotal: quote.taxTotal,
          total: quote.total,
          amountPaid: 0,
          balance: quote.total,
          status: 'draft',
          appliedDiscounts: quote.appliedDiscounts,
        });

        // 4️⃣ Link invoice to claim.
        claim.invoice = invoice._id;
        await claim.save();

        // 5️⃣ Advance subscription nextBillingDate.
        sub.nextBillingDate = p.periodEnd;
        await sub.save();

        // 6️⃣ Record audit entry
        await recordStatusChange({
          entityType: 'invoice',
          entityId: invoice._id,
          from: null,
          to: 'draft',
          changedBy: null,
          note: `Generated by automated billing run for period starting ${new Date(p.periodStart).toISOString().slice(0, 10)}`,
        });

        // 7️⃣ Update run summary.
        run.createdCount += 1;
        run.details.push({
          subscription: sub._id,
          periodStart: p.periodStart,
          outcome: 'created',
          reason: null,
          invoice: invoice._id,
        });
      } catch (err) {
        // Duplicate key => already billed, just skip.
        if (err.code === 11000) {
          run.skippedCount += 1;
          run.details.push({
            subscription: sub._id,
            periodStart: p.periodStart,
            outcome: 'skipped',
            reason: 'already billed',
            invoice: null,
          });
        } else {
          // Any other error – rollback claim if it exists.
          await BillingPeriod.deleteOne({ subscription: sub._id, periodStart: p.periodStart });
          run.failedCount += 1;
          run.details.push({
            subscription: sub._id,
            periodStart: p.periodStart,
            outcome: 'failed',
            reason: err.message,
            invoice: null,
          });
        }
      }
    }
  }

  await run.save();
  return { runId: run._id, created: run.createdCount, skipped: run.skippedCount, failed: run.failedCount };
}

module.exports = { runBilling };
