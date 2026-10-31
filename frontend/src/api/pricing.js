import client from './client';

export const pricingApi = {
  quote: (data) => client.post('/pricing/quote', data),
};
