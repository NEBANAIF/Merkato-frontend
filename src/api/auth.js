import apiClient from './client.js';

export function login(email, password) {
  return apiClient.post('/auth/login', { email, password }).then((res) => res.data);
}

export function fetchCurrentUser() {
  return apiClient.get('/auth/me').then((res) => res.data);
}
