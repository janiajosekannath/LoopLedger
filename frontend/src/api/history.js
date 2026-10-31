import client from './client';

export const historyApi = {
  getHistory: (entityType, entityId) => client.get(`/history/${entityType}/${entityId}`),
};
