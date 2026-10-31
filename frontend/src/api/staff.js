import client from './client';

export const staffApi = {
  list: (params) => client.get('/admin/staff', { params }),
  create: (data) => client.post('/admin/staff', data),
  toggle: (id) => client.patch(`/admin/staff/${id}/toggle`),
};
