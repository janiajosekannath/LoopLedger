import client from './client';

export const paymentsApi = {
  list: (params) => client.get('/payments', { params }),
  get: (id) => client.get(`/payments/${id}`),
  // Legacy: direct payment creation (admin)
  create: (data) => client.post('/payments', data),
  // Phase 6: pay an invoice (customer or admin)
  payInvoice: (invoiceId, data) => client.post(`/payments/${invoiceId}/pay`, data),
  // Phase 6: refund a payment (admin)
  refund: (paymentId, data) => client.patch(`/payments/${paymentId}/refund`, data),
};
