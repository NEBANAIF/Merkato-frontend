import apiClient from './client.js';

export function searchUsers({ branchId, role, search, page = 0, size = 20 } = {}) {
  return apiClient.get('/users', { params: { branchId, role, search, page, size } }).then((res) => res.data);
}

export function getUser(id) {
  return apiClient.get(`/users/${id}`).then((res) => res.data);
}

/** { name, email, phone, password, roleId, branchId } - roleId is any role from the Roles page. */
export function createUser(user) {
  return apiClient.post('/users', user).then((res) => res.data);
}

/** { name, phone, roleId, branchId } - no email/password here, see UpdateUserRequest's javadoc. */
export function updateUser(id, user) {
  return apiClient.put(`/users/${id}`, user).then((res) => res.data);
}

export function setUserActive(id, active) {
  return apiClient.patch(`/users/${id}/status`, { active }).then((res) => res.data);
}

export function resetUserPassword(id, newPassword) {
  return apiClient.post(`/users/${id}/reset-password`, { newPassword });
}
