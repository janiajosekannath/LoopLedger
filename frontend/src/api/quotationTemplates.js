import client from './client';

export const quotationTemplatesApi = {
  list: (params) => client.get('/quotation-templates', { params }),
  get: (id) => client.get(`/quotation-templates/${id}`),
  create: (data) => client.post('/quotation-templates', data),
  update: (id, data) => client.put(`/quotation-templates/${id}`, data),
  delete: (id) => client.delete(`/quotation-templates/${id}`),
};
