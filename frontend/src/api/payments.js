import client from './client';

export const paymentsApi = {
  list: (params) => client.get('/payments', { params }),
  get: (id) => client.get(`/payments/${id}`),
  create: (data) => client.post('/payments', data),
};
