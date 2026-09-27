import apiClient from './client.js';

/** { lockCostPrice, hideOutOfStockAtPos } - readable by any signed-in user. */
export function getSettings() {
  return apiClient.get('/settings').then((res) => res.data);
}

/** { lockCostPrice, hideOutOfStockAtPos } - requires SETTINGS_MANAGE server-side. */
export function updateSettings(settings) {
  return apiClient.put('/settings', settings).then((res) => res.data);
}
