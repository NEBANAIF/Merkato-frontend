import apiClient from './client.js';

export function searchPurchaseOrders({ scope = 'ALL', branchId, supplierId, status, search, page = 0, size = 20 } = {}) {
  return apiClient
    .get('/purchases', { params: { scope, branchId, supplierId, status, search, page, size, sort: 'createdAt,desc' } })
    .then((res) => res.data);
}

export function getPurchaseOrder(id) {
  return apiClient.get(`/purchases/${id}`).then((res) => res.data);
}

/** { supplierId, branchId, orderDate, items: [{productId, quantity, unitCost}] } */
export function createPurchaseOrder(order) {
  return apiClient.post('/purchases', order).then((res) => res.data);
}

export function submitPurchaseOrder(id) {
  return apiClient.post(`/purchases/${id}/submit`).then((res) => res.data);
}

export function approvePurchaseOrder(id) {
  return apiClient.post(`/purchases/${id}/approve`).then((res) => res.data);
}

export function cancelPurchaseOrder(id) {
  return apiClient.post(`/purchases/${id}/cancel`).then((res) => res.data);
}

/** { items: [{purchaseOrderItemId, quantityReceived}] } */
export function receivePurchaseOrder(id, request) {
  return apiClient.post(`/purchases/${id}/receive`, request).then((res) => res.data);
}
