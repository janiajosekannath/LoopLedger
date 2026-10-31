import client from './client';

export const invoicesApi = {
  list: (params) => client.get('/invoices', { params }),
  get: (id) => client.get(`/invoices/${id}`),
  create: (data) => client.post('/invoices', data),
  confirm: (id) => client.patch(`/invoices/${id}/confirm`),
  cancel: (id) => client.patch(`/invoices/${id}/cancel`),
  send: (id) => client.post(`/invoices/${id}/send`),
  pdf: (id) => client.get(`/invoices/${id}/pdf`, { responseType: 'blob' }),
  // Payments
  pay: (invoiceId, data) => client.post(`/payments/${invoiceId}/pay`, data),
  refund: (paymentId, data) => client.patch(`/payments/${paymentId}/refund`, data),
};
