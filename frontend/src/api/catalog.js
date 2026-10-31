import client from './client';

export const taxesApi = {
  list: (params) => client.get('/taxes', { params }),
  get: (id) => client.get(`/taxes/${id}`),
  create: (data) => client.post('/taxes', data),
  update: (id, data) => client.put(`/taxes/${id}`, data),
  toggle: (id) => client.patch(`/taxes/${id}/toggle`),
  delete: (id) => client.delete(`/taxes/${id}`),
};

export const productsApi = {
  list: (params) => client.get('/products', { params }),
  get: (id) => client.get(`/products/${id}`),
  create: (data) => client.post('/products', data),
  update: (id, data) => client.put(`/products/${id}`, data),
  delete: (id) => client.delete(`/products/${id}`),
  addVariant: (productId, data) => client.post(`/products/${productId}/variants`, data),
  updateVariant: (productId, variantId, data) => client.put(`/products/${productId}/variants/${variantId}`, data),
  deleteVariant: (productId, variantId) => client.delete(`/products/${productId}/variants/${variantId}`),
};

export const plansApi = {
  list: (params) => client.get('/plans', { params }),
  get: (id) => client.get(`/plans/${id}`),
  create: (data) => client.post('/plans', data),
  update: (id, data) => client.put(`/plans/${id}`, data),
  toggle: (id) => client.patch(`/plans/${id}/toggle`),
  delete: (id) => client.delete(`/plans/${id}`),
};

export const discountsApi = {
  list: (params) => client.get('/discounts', { params }),
  get: (id) => client.get(`/discounts/${id}`),
  create: (data) => client.post('/discounts', data),
  update: (id, data) => client.put(`/discounts/${id}`, data),
  toggle: (id) => client.patch(`/discounts/${id}/toggle`),
  delete: (id) => client.delete(`/discounts/${id}`),
};

export const catalogApi = {
  listPlans: (params) => plansApi.list(params),
  getPlan: (id) => plansApi.get(id),
  listProducts: (params) => productsApi.list(params),
  getProduct: (id) => productsApi.get(id),
  listTaxes: (params) => taxesApi.list(params),
  listDiscounts: (params) => discountsApi.list(params),
};
