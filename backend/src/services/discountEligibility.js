/**
 * services/discountEligibility.js
 * Centralized evaluator for discount eligibility against purchase criteria.
 */

/**
 * Computes the lifecycle status of a discount document.
 * @param {Object} discount
 * @param {Date} [asOf]
 * @returns {'active' | 'scheduled' | 'expired' | 'exhausted' | 'inactive'}
 */
function getDiscountStatus(discount, asOf = new Date()) {
  if (!discount.active) return 'inactive';

  const checkDate = asOf instanceof Date ? asOf : new Date(asOf);

  if (discount.startDate && checkDate < new Date(discount.startDate)) {
    return 'scheduled';
  }

  if (discount.endDate && checkDate > new Date(discount.endDate)) {
    return 'expired';
  }

  if (
    discount.usageLimit != null &&
    discount.usageLimit > 0 &&
    discount.timesUsed >= discount.usageLimit
  ) {
    return 'exhausted';
  }

  return 'active';
}

/**
 * Determines whether a given discount can be applied to an order or line item.
 *
 * @param {Object} discount - The Discount document/object.
 * @param {Object} criteria
 * @param {number} [criteria.subtotal=0] - The applicable subtotal before this discount.
 * @param {number} [criteria.quantity=1] - Number of units being purchased.
 * @param {string|Array<string>} [criteria.productId] - Product ID for line-scoped checks.
 * @param {string} [criteria.subscriptionId] - Subscription ID for subscription-scoped checks.
 * @param {Date} [criteria.asOf] - Evaluation date (defaults to now).
 * @returns {{ eligible: boolean, reason?: string, status: string }}
 */
function isDiscountEligible(discount, criteria = {}) {
  const asOf = criteria.asOf || new Date();
  const status = getDiscountStatus(discount, asOf);

  if (status !== 'active') {
    return {
      eligible: false,
      reason: `Discount is ${status}`,
      status,
    };
  }

  const quantity = Number(criteria.quantity) || 1;
  const subtotal = Number(criteria.subtotal) || 0;

  // Check minimum quantity
  if (discount.minQty != null && discount.minQty > 1) {
    if (quantity < discount.minQty) {
      return {
        eligible: false,
        reason: `Requires minimum quantity of ${discount.minQty} (provided: ${quantity})`,
        status,
      };
    }
  }

  // Check minimum purchase subtotal
  if (discount.minPurchase != null && discount.minPurchase > 0) {
    if (subtotal < discount.minPurchase) {
      return {
        eligible: false,
        reason: `Requires minimum purchase of ₹${discount.minPurchase} (subtotal: ₹${subtotal})`,
        status,
      };
    }
  }

  // Scope: product
  if (discount.scope === 'product') {
    if (discount.products && discount.products.length > 0) {
      const allowedProductIds = discount.products.map((p) =>
        p._id ? p._id.toString() : p.toString()
      );

      const targetProductIds = Array.isArray(criteria.productId)
        ? criteria.productId.map((p) => (p._id ? p._id.toString() : p.toString()))
        : criteria.productId
        ? [criteria.productId._id ? criteria.productId._id.toString() : criteria.productId.toString()]
        : [];

      const matches = targetProductIds.some((pId) => allowedProductIds.includes(pId));
      if (!matches) {
        return {
          eligible: false,
          reason: 'Discount does not apply to this product',
          status,
        };
      }
    }
  }

  // Scope: subscription
  if (discount.scope === 'subscription') {
    if (discount.subscriptions && discount.subscriptions.length > 0) {
      const allowedSubIds = discount.subscriptions.map((s) =>
        s._id ? s._id.toString() : s.toString()
      );
      if (
        !criteria.subscriptionId ||
        !allowedSubIds.includes(
          criteria.subscriptionId._id
            ? criteria.subscriptionId._id.toString()
            : criteria.subscriptionId.toString()
        )
      ) {
        return {
          eligible: false,
          reason: 'Discount does not apply to this subscription',
          status,
        };
      }
    }
  }

  return {
    eligible: true,
    status,
  };
}

module.exports = {
  getDiscountStatus,
  isDiscountEligible,
};
