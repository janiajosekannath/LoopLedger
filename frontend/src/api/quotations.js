import client from './client';

export const quotationsApi = {
  list: (params) => client.get('/quotations', { params }),
  get: (id) => client.get(`/quotations/${id}`),
  create: (data) => client.post('/quotations', data),
  update: (id, data) => client.put(`/quotations/${id}`, data),
  updateStatus: (id, status, note) => client.patch(`/quotations/${id}/status`, { status, note }),
  confirm: (id) => client.post(`/quotations/${id}/confirm`),
  delete: (id) => client.delete(`/quotations/${id}`),
};
