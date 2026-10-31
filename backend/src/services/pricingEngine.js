/**
 * services/pricingEngine.js
 * Single source of truth for pricing calculation in LoopLedger.
 * Quotations, subscriptions, invoice previews, and real invoices all call this engine.
 *
 * Rules:
 * 1. Unit price = product sales price + variant extra price (e.g. ₹1,000 + Odoo ₹560 = ₹1,560)
 * 2. Line raw amount = unit price * quantity
 * 3. Enforce plan minQty (checks total quantity against plan.minQty)
 * 4. Apply eligible product-scoped discounts to their respective product lines
 * 5. Apply eligible subscription-scoped discounts to the remaining subtotal
 * 6. Tax is applied on the discounted amount
 * 7. Money values are rounded to 2 decimal places using round2
 * 8. Never changes discount timesUsed usage counters
 */

const { round2 } = require('../utils/money');
const { Product, ProductVariant } = require('../models/Product');
const SubscriptionPlan = require('../models/SubscriptionPlan');
const Tax = require('../models/Tax');
const Discount = require('../models/Discount');
const { isDiscountEligible } = require('./discountEligibility');

/**
 * Normalizes an ID whether it's an ObjectId, string, or populated object.
 */
function toIdString(val) {
  if (!val) return null;
  return val._id ? val._id.toString() : val.toString();
}

/**
 * quote({ lines, planId, customerId, subscriptionId, asOf })
 *
 * @param {Object} params
 * @param {Array<Object>} params.lines - [{ product, variant, quantity, description, tax }]
 * @param {string|ObjectId} [params.planId] - Optional SubscriptionPlan ID
 * @param {string|ObjectId} [params.customerId] - Customer ID
 * @param {string|ObjectId} [params.subscriptionId] - Optional Subscription ID
 * @param {Date|string} [params.asOf] - Pricing effective date (defaults to now)
 * @returns {Promise<Object>} Pricing calculation result
 */
async function quote({ lines = [], planId, customerId, subscriptionId, asOf = new Date() }) {
  const evalDate = asOf instanceof Date ? asOf : new Date(asOf);

  if (!Array.isArray(lines) || lines.length === 0) {
    throw new Error('Pricing quote requires at least one line item');
  }

  // 1. If planId is provided, validate plan and minimum quantity
  let plan = null;
  if (planId) {
    plan = await SubscriptionPlan.findById(planId).lean();
    if (!plan) {
      throw new Error(`Subscription plan not found: ${planId}`);
    }
    if (!plan.active) {
      throw new Error(`Subscription plan "${plan.name}" is not active`);
    }
    if (plan.availableFrom && evalDate < new Date(plan.availableFrom)) {
      throw new Error(`Subscription plan "${plan.name}" is not yet available as of ${evalDate.toISOString()}`);
    }
    if (plan.availableTo && evalDate > new Date(plan.availableTo)) {
      throw new Error(`Subscription plan "${plan.name}" has expired availability as of ${evalDate.toISOString()}`);
    }
  }

  // Calculate total quantity across lines
  const totalQuantity = lines.reduce((sum, line) => sum + (Number(line.quantity) || 1), 0);

  if (plan && plan.minQty && totalQuantity < plan.minQty) {
    throw new Error(`Plan requires a minimum quantity of ${plan.minQty} units (current total: ${totalQuantity})`);
  }

  // 2. Fetch all products, variants, taxes, and active discounts in parallel
  const productIds = lines.map((l) => toIdString(l.product)).filter(Boolean);
  const variantIds = lines.map((l) => toIdString(l.variant)).filter(Boolean);
  const lineTaxIds = lines.map((l) => toIdString(l.tax)).filter(Boolean);

  const [productsList, variantsList, allTaxes, activeDiscounts] = await Promise.all([
    Product.find({ _id: { $in: productIds } }).lean(),
    variantIds.length ? ProductVariant.find({ _id: { $in: variantIds } }).lean() : [],
    Tax.find().lean(),
    Discount.find({ active: true }).lean(),
  ]);

  const productMap = new Map(productsList.map((p) => [p._id.toString(), p]));
  const variantMap = new Map(variantsList.map((v) => [v._id.toString(), v]));
  const taxMap = new Map(allTaxes.map((t) => [t._id.toString(), t]));

  // Separate active discounts by scope
  const productDiscounts = activeDiscounts.filter((d) => d.scope === 'product');
  const subscriptionDiscounts = activeDiscounts.filter((d) => d.scope === 'subscription');

  const appliedDiscounts = [];
  const processedLines = [];
  let subtotal = 0;
  let totalProductDiscount = 0;

  // 3. Process each line: determine unit price, line subtotal, apply product discounts
  for (const rawLine of lines) {
    const pId = toIdString(rawLine.product);
    const product = productMap.get(pId);
    if (!product) {
      throw new Error(`Product not found: ${pId}`);
    }

    const vId = toIdString(rawLine.variant);
    const variant = vId ? variantMap.get(vId) : null;

    const quantity = Math.max(1, Number(rawLine.quantity) || 1);

    // Rule 1: Unit Price = base salesPrice + variant.extraPrice
    const basePrice = Number(product.salesPrice) || 0;
    const extraPrice = variant ? Number(variant.extraPrice) || 0 : 0;
    const unitPrice = round2(basePrice + extraPrice);

    // Rule 2: Line Subtotal = unitPrice * quantity
    const lineSubtotal = round2(unitPrice * quantity);
    subtotal = round2(subtotal + lineSubtotal);

    // Rule 4: Apply eligible product-scoped discounts
    let lineDiscountAmount = 0;
    for (const discount of productDiscounts) {
      const eligibility = isDiscountEligible(discount, {
        subtotal: lineSubtotal,
        quantity,
        productId: product._id,
        asOf: evalDate,
      });

      if (eligibility.eligible) {
        let discAmt = 0;
        if (discount.type === 'percent') {
          discAmt = round2(lineSubtotal * (Number(discount.value) / 100));
        } else if (discount.type === 'fixed') {
          discAmt = Math.min(lineSubtotal, Number(discount.value) || 0);
        }

        if (discAmt > 0) {
          lineDiscountAmount = round2(lineDiscountAmount + discAmt);
          appliedDiscounts.push({
            discount: discount._id,
            discountName: discount.name,
            scope: 'product',
            productId: product._id,
            amount: discAmt,
          });
        }
      }
    }

    // Cap line discount at lineSubtotal
    if (lineDiscountAmount > lineSubtotal) {
      lineDiscountAmount = lineSubtotal;
    }
    totalProductDiscount = round2(totalProductDiscount + lineDiscountAmount);

    const discountedLineBase = round2(lineSubtotal - lineDiscountAmount);

    // Tax determination: line tax override -> product tax -> default 0%
    let taxPercent = 0;
    let taxRef = null;
    const taxId = toIdString(rawLine.tax) || toIdString(product.tax);
    if (taxId && taxMap.has(taxId)) {
      const t = taxMap.get(taxId);
      if (t.active) {
        taxPercent = Number(t.percent) || 0;
        taxRef = t._id;
      }
    }

    // Rule 6: Tax on the discounted amount
    const lineTaxAmount = round2(discountedLineBase * (taxPercent / 100));
    const lineAmount = round2(discountedLineBase + lineTaxAmount);

    processedLines.push({
      product: product._id,
      productName: product.name,
      variant: variant ? variant._id : null,
      variantName: variant ? `${variant.attribute}: ${variant.value}` : null,
      description: rawLine.description || product.name,
      quantity,
      unitPrice,
      tax: taxRef,
      taxPercent,
      taxAmount: lineTaxAmount,
      discountAmount: lineDiscountAmount,
      amount: lineAmount,
      discountedBase: discountedLineBase,
    });
  }

  // 5. Apply subscription-scoped discounts on the remaining subtotal
  let remainingSubtotal = round2(subtotal - totalProductDiscount);
  let subscriptionDiscountAmount = 0;

  for (const discount of subscriptionDiscounts) {
    const eligibility = isDiscountEligible(discount, {
      subtotal: remainingSubtotal,
      quantity: totalQuantity,
      subscriptionId,
      asOf: evalDate,
    });

    if (eligibility.eligible && remainingSubtotal > 0) {
      let discAmt = 0;
      if (discount.type === 'percent') {
        discAmt = round2(remainingSubtotal * (Number(discount.value) / 100));
      } else if (discount.type === 'fixed') {
        discAmt = Math.min(remainingSubtotal, Number(discount.value) || 0);
      }

      if (discAmt > 0) {
        subscriptionDiscountAmount = round2(subscriptionDiscountAmount + discAmt);
        remainingSubtotal = round2(remainingSubtotal - discAmt);
        appliedDiscounts.push({
          discount: discount._id,
          discountName: discount.name,
          scope: 'subscription',
          amount: discAmt,
        });
      }
    }
  }

  // If a subscription discount was applied, recalculate tax on the adjusted base
  let finalTaxTotal = 0;
  if (subscriptionDiscountAmount > 0 && subtotal > totalProductDiscount) {
    const ratio = Math.max(0, 1 - subscriptionDiscountAmount / (subtotal - totalProductDiscount));
    finalTaxTotal = 0;
    for (const pLine of processedLines) {
      const adjustedBase = round2(pLine.discountedBase * ratio);
      const adjustedTax = round2(adjustedBase * (pLine.taxPercent / 100));
      pLine.taxAmount = adjustedTax;
      pLine.amount = round2(adjustedBase + adjustedTax);
      finalTaxTotal = round2(finalTaxTotal + adjustedTax);
    }
  } else {
    finalTaxTotal = processedLines.reduce((acc, l) => round2(acc + l.taxAmount), 0);
  }

  const discountTotal = round2(totalProductDiscount + subscriptionDiscountAmount);
  const total = round2(subtotal - discountTotal + finalTaxTotal);

  return {
    lines: processedLines.map((l) => ({
      product: l.product,
      productName: l.productName,
      variant: l.variant,
      variantName: l.variantName,
      description: l.description,
      quantity: l.quantity,
      unitPrice: l.unitPrice,
      tax: l.tax,
      taxPercent: l.taxPercent,
      taxAmount: l.taxAmount,
      discountAmount: l.discountAmount,
      amount: l.amount,
    })),
    subtotal: round2(subtotal),
    discountTotal: round2(discountTotal),
    taxTotal: round2(finalTaxTotal),
    total: round2(total),
    appliedDiscounts,
  };
}

module.exports = {
  quote,
};
