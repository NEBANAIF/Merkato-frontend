import apiClient from './client.js';

/**
 * Every role (built-in and custom) with its permissions and how many users hold it:
 * [{ id, name, description, baseRole, branchType, canManageBranch, systemRole,
 *    superAdmin, userCount, permissions: [...] }]
 */
export function listRoles() {
  return apiClient.get('/roles').then((res) => res.data);
}

/** Every permission that exists, in display order: [{ key, group, label, description }] */
export function getPermissionCatalog() {
  return apiClient.get('/roles/catalog').then((res) => res.data);
}

/**
 * { name, description, branchType: 'STORE' | 'WAREHOUSE', canManageBranch, permissions: [...] }
 * branchType and canManageBranch only matter when creating a role - they fix the kind of role it is.
 */
export function createRole(role) {
  return apiClient.post('/roles', role).then((res) => res.data);
}

export function updateRole(id, role) {
  return apiClient.put(`/roles/${id}`, role).then((res) => res.data);
}

export function deleteRole(id) {
  return apiClient.delete(`/roles/${id}`);
}
