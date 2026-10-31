import client from './client';

export const subscriptionsApi = {
  list: (params) => client.get('/subscriptions', { params }),
  get: (id) => client.get(`/subscriptions/${id}`),
  create: (data) => client.post('/subscriptions', data),
  activate: (id) => client.post(`/subscriptions/${id}/activate`),
  pause: (id, note) => client.post(`/subscriptions/${id}/pause`, { note }),
  resume: (id, note) => client.post(`/subscriptions/${id}/resume`, { note }),
  close: (id, note) => client.post(`/subscriptions/${id}/close`, { note }),
  renew: (id, extendMonths = 12) => client.post(`/subscriptions/${id}/renew`, { extendMonths }),
};
