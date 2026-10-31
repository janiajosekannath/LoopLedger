import client from './client';

export const customersApi = {
  list: (params) => client.get('/customers', { params }),
  get: (id) => client.get(`/customers/${id}`),
  create: (data) => client.post('/customers', data),
  update: (id, data) => client.put(`/customers/${id}`, data),
  delete: (id) => client.delete(`/customers/${id}`),
  getSubscriptions: (id) => client.get(`/customers/${id}/subscriptions`),
  getInvoices: (id) => client.get(`/customers/${id}/invoices`),
  getPayments: (id) => client.get(`/customers/${id}/payments`),
};
