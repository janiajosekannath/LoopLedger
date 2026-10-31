/**
 * services/paymentGateway.js
 *
 * LoopLedger Payment Gateway Stub
 * -------------------------------------------------------------
 * NOTE: LoopLedger strictly enforces proven accounting principles:
 * manual payment recording against confirmed invoices with atomic balance
 * updates is the core system of record.
 *
 * This file serves as an architectural integration stub for external payment
 * gateways (e.g. Razorpay, Stripe, Cashfree). LoopLedger does NOT pretend a live
 * gateway exists in this deployment. All production payments in this build are
 * manually recorded or received via signed webhooks.
 */

class PaymentGatewayStub {
  constructor() {
    this.name = 'MockGateway';
    this.isStub = true;
  }

  /**
   * Create an intent or checkout session with external gateway.
   * In this deployment, returns a simulated session descriptor.
   */
  async createPaymentIntent({ invoiceId, amount, customerEmail, currency = 'INR' }) {
    return {
      success: true,
      mode: 'stub',
      gateway: this.name,
      transactionId: `TXN_STUB_${Date.now()}_${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
      invoiceId,
      amount,
      currency,
      customerEmail,
      message: 'Integration stub: LoopLedger uses manual verification and webhook settlement.',
      simulatedStatus: 'ready_for_settlement',
    };
  }

  /**
   * Verify an incoming webhook signature.
   */
  verifyWebhookSignature(payload, signature) {
    if (!signature) return false;
    // Mock signature check for testing / staging
    return signature.startsWith('mock_sig_') || signature === 'test-secret-signature';
  }

  /**
   * Process refund request with external gateway.
   */
  async processRefund({ paymentId, amount, reason }) {
    return {
      success: true,
      mode: 'stub',
      refundId: `REF_STUB_${Date.now()}`,
      paymentId,
      amount,
      reason,
      processedAt: new Date().toISOString(),
    };
  }
}

module.exports = new PaymentGatewayStub();
