const {
  getDiscountStatus,
  isDiscountEligible,
} = require('../src/services/discountEligibility');

describe('Discount Eligibility Service Unit Tests', () => {
  const baseDiscount = {
    name: 'Standard Promo',
    type: 'percent',
    value: 10,
    scope: 'subscription',
    active: true,
    timesUsed: 0,
    usageLimit: null,
    minQty: 1,
    minPurchase: 0,
  };

  test('active discount with no restrictions is eligible', () => {
    const res = isDiscountEligible(baseDiscount, { subtotal: 1000, quantity: 1 });
    expect(res.eligible).toBe(true);
    expect(res.status).toBe('active');
  });

  test('inactive discount is not eligible', () => {
    const disc = { ...baseDiscount, active: false };
    const res = isDiscountEligible(disc);
    expect(res.eligible).toBe(false);
    expect(res.status).toBe('inactive');
  });

  test('not started (scheduled) discount is not eligible', () => {
    const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const disc = { ...baseDiscount, startDate: futureDate };
    const res = isDiscountEligible(disc);
    expect(res.eligible).toBe(false);
    expect(res.status).toBe('scheduled');
    expect(res.reason).toContain('scheduled');
  });

  test('expired discount is not eligible', () => {
    const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const disc = { ...baseDiscount, endDate: pastDate };
    const res = isDiscountEligible(disc);
    expect(res.eligible).toBe(false);
    expect(res.status).toBe('expired');
    expect(res.reason).toContain('expired');
  });

  test('exhausted discount (timesUsed >= usageLimit) is not eligible', () => {
    const disc = { ...baseDiscount, usageLimit: 5, timesUsed: 5 };
    const res = isDiscountEligible(disc);
    expect(res.eligible).toBe(false);
    expect(res.status).toBe('exhausted');
    expect(res.reason).toContain('exhausted');
  });

  test('discount below minimum quantity is rejected', () => {
    const disc = { ...baseDiscount, minQty: 10 };
    // Only 8 units
    const res = isDiscountEligible(disc, { quantity: 8, subtotal: 5000 });
    expect(res.eligible).toBe(false);
    expect(res.reason).toContain('Requires minimum quantity of 10');

    // 10 units passes
    const passRes = isDiscountEligible(disc, { quantity: 10, subtotal: 5000 });
    expect(passRes.eligible).toBe(true);
  });

  test('discount below minimum purchase is rejected', () => {
    const disc = { ...baseDiscount, minPurchase: 5000 };
    // Subtotal 4000 fails
    const res = isDiscountEligible(disc, { subtotal: 4000 });
    expect(res.eligible).toBe(false);
    expect(res.reason).toContain('Requires minimum purchase of ₹5000');

    // Subtotal 5000 passes
    const passRes = isDiscountEligible(disc, { subtotal: 5000 });
    expect(passRes.eligible).toBe(true);
  });

  test('product scoped discount only applies to targeted products', () => {
    const prodA = '60d5ec49f1b2c82b8c8b4567';
    const prodB = '60d5ec49f1b2c82b8c8b4568';
    const disc = {
      ...baseDiscount,
      scope: 'product',
      products: [prodA],
    };

    const failRes = isDiscountEligible(disc, { productId: prodB });
    expect(failRes.eligible).toBe(false);

    const passRes = isDiscountEligible(disc, { productId: prodA });
    expect(passRes.eligible).toBe(true);
  });
});
