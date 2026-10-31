import client from './client';

export const remindersApi = {
  list: (params) => client.get('/reminders', { params }),
  trigger: (data) => client.post('/reminders/run', data),
};
