import client from './client';

export const collectionsApi = {
  getAging: (params) => client.get('/api/collections/aging', { params }),
  remindInvoice: (invoiceId) => client.post(`/api/invoices/${invoiceId}/remind`),
};

export default collectionsApi;
