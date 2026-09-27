import React, { useEffect, useState } from 'react';
import {
  searchPurchaseOrders, createPurchaseOrder, submitPurchaseOrder,
  approvePurchaseOrder, cancelPurchaseOrder, receivePurchaseOrder,
} from '../../api/purchases.js';
import { listSuppliers } from '../../api/suppliers.js';
import { listBranches } from '../../api/branches.js';
import { extractErrorMessage } from '../../api/client.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import { useBranchScope } from '../../branch/BranchContext.jsx';
import DataTable from '../../components/DataTable.jsx';
import LoadingState from '../../components/LoadingState.jsx';
import ErrorState from '../../components/ErrorState.jsx';
import Pagination from '../../components/Pagination.jsx';
import Badge from '../../components/Badge.jsx';
import Modal from '../../components/Modal.jsx';
import ProductSelect from '../../components/ProductSelect.jsx';
import ConfirmDialog from '../../components/ConfirmDialog.jsx';
import { formatMoney, formatDate } from '../../utils/format.js';

const COLUMNS = [
  { key: 'orderNumber', header: 'Order #', render: (r) => <span className="font-medium text-ink-900">{r.orderNumber}</span> },
  { key: 'supplierName', header: 'Supplier' },
  { key: 'branchName', header: 'Branch' },
  { key: 'orderDate', header: 'Date', render: (r) => formatDate(r.orderDate) },
  { key: 'total', header: 'Total', render: (r) => formatMoney(r.total), className: 'text-right' },
  { key: 'status', header: 'Status', render: (r) => <Badge status={r.status} /> },
];

/**
 * Lifecycle actions (spec section 17: DRAFT -> PENDING -> APPROVED ->
 * PARTIALLY_RECEIVED/RECEIVED, or CANCELLED) are exposed as buttons on
 * the detail view, gated per-action by both permission AND current status
 * - the backend is the real enforcer, these just avoid offering a button
 * that would fail.
 */
export default function PurchasesPage() {
  const { hasPermission } = useAuth();
  const { scopeParams } = useBranchScope();
  const [page, setPage] = useState(0);
  const [data, setData] = useState(null);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [actionError, setActionError] = useState('');
  const [receiveOpen, setReceiveOpen] = useState(false);
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const load = () => {
    setStatus('loading');
    searchPurchaseOrders({ ...scopeParams, page })
      .then((res) => { setData(res); setStatus('ready'); })
      .catch((err) => { setError(extractErrorMessage(err)); setStatus('error'); });
  };

  useEffect(load, [page, scopeParams.scope, scopeParams.branchId]);

  const runAction = async (fn) => {
    setActionError('');
    try {
      const updated = await fn();
      setSelected(updated);
      load();
    } catch (err) {
      setActionError(extractErrorMessage(err));
    }
  };

  return (
    <div>
      <h1 className="page-title mb-4">Purchases</h1>

      <div className="card card-pad">
        <div className="mb-3 flex justify-end">
          {hasPermission('PURCHASE_CREATE') && (
            <button onClick={() => setCreateOpen(true)} className="btn btn-primary btn-sm">
              + New Purchase Order
            </button>
          )}
        </div>

        {status === 'loading' && <LoadingState />}
        {status === 'error' && <ErrorState message={error} onRetry={load} />}
        {status === 'ready' && (
          <>
            <DataTable columns={COLUMNS} rows={data.content} onRowClick={(r) => { setSelected(r); setActionError(''); setCancelConfirmOpen(false); }} emptyMessage="No purchase orders yet." />
            <div className="mt-3">
              <Pagination page={data.page} totalPages={data.totalPages} totalElements={data.totalElements} onPageChange={setPage} />
            </div>
          </>
        )}
      </div>

      <Modal open={!!selected} title={selected ? `PO ${selected.orderNumber}` : ''} onClose={() => setSelected(null)} wide>
        {selected && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
              <Info label="Supplier" value={selected.supplierName} />
              <Info label="Branch" value={selected.branchName} />
              <Info label="Status" value={<Badge status={selected.status} />} />
              <Info label="Order Date" value={formatDate(selected.orderDate)} />
              <Info label="Created By" value={selected.createdByName} />
              <Info label="Approved By" value={selected.approvedByName || '—'} />
            </div>

            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-cream-200 text-left text-xs uppercase text-ink-400">
                  <th className="py-1.5 pr-3 font-medium">Product</th>
                  <th className="py-1.5 pr-3 text-right font-medium">Ordered</th>
                  <th className="py-1.5 pr-3 text-right font-medium">Received</th>
                  <th className="py-1.5 pr-3 text-right font-medium">Unit Cost</th>
                  <th className="py-1.5 pr-3 text-right font-medium">Line Total</th>
                </tr>
              </thead>
              <tbody>
                {selected.items.map((item) => (
                  <tr key={item.id} className="border-b border-slate-50 last:border-0">
                    <td className="py-1.5 pr-3">{item.productName}</td>
                    <td className="py-1.5 pr-3 text-right">{item.quantity}</td>
                    <td className="py-1.5 pr-3 text-right">{item.receivedQuantity}</td>
                    <td className="py-1.5 pr-3 text-right">{formatMoney(item.unitCost)}</td>
                    <td className="py-1.5 pr-3 text-right">{formatMoney(item.lineTotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="flex justify-end border-t border-cream-200 pt-3 text-sm font-semibold">
              Total: {formatMoney(selected.total)}
            </div>

            {actionError && <p className="alert alert-error">{actionError}</p>}

            <div className="flex flex-wrap justify-end gap-2 border-t border-cream-200 pt-3">
              {selected.status === 'DRAFT' && hasPermission('PURCHASE_CREATE') && (
                <ActionButton onClick={() => runAction(() => submitPurchaseOrder(selected.id))}>Submit</ActionButton>
              )}
              {selected.status === 'PENDING' && hasPermission('PURCHASE_CREATE') && (
                <ActionButton onClick={() => runAction(() => approvePurchaseOrder(selected.id))}>Approve</ActionButton>
              )}
              {['APPROVED', 'PARTIALLY_RECEIVED'].includes(selected.status) && hasPermission('PURCHASE_RECEIVE') && (
                <ActionButton primary onClick={() => setReceiveOpen(true)}>Receive Stock</ActionButton>
              )}
              {!['RECEIVED', 'CANCELLED'].includes(selected.status) && hasPermission('PURCHASE_CREATE') && (
                <ActionButton danger onClick={() => setCancelConfirmOpen(true)}>Cancel Order</ActionButton>
              )}
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={cancelConfirmOpen}
        title="Cancel this purchase order?"
        description="This cannot be undone."
        confirmLabel="Cancel Order"
        danger
        busy={cancelling}
        onCancel={() => setCancelConfirmOpen(false)}
        onConfirm={async () => {
          setCancelling(true);
          await runAction(() => cancelPurchaseOrder(selected.id));
          setCancelling(false);
          setCancelConfirmOpen(false);
        }}
      />

      {receiveOpen && selected && (
        <ReceiveModal
          po={selected}
          onClose={() => setReceiveOpen(false)}
          onReceived={(updated) => { setReceiveOpen(false); setSelected(updated); load(); }}
        />
      )}

      <CreatePurchaseOrderModal open={createOpen} onClose={() => setCreateOpen(false)} onCreated={() => { setCreateOpen(false); load(); }} />
    </div>
  );
}

function ActionButton({ children, onClick, primary, danger }) {
  const cls = primary ? 'btn-primary' : danger ? 'btn-danger' : 'btn-secondary';
  return (
    <button onClick={onClick} className={`btn btn-sm ${cls}`}>
      {children}
    </button>
  );
}

function Info({ label, value }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-ink-400">{label}</p>
      <p className="text-slate-800">{value}</p>
    </div>
  );
}

function ReceiveModal({ po, onClose, onReceived }) {
  const receivable = po.items.filter((i) => i.remainingToReceive > 0);
  const [quantities, setQuantities] = useState(() => Object.fromEntries(receivable.map((i) => [i.id, i.remainingToReceive])));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    setSaving(true);
    setError('');
    try {
      const items = receivable
        .map((i) => ({ purchaseOrderItemId: i.id, quantityReceived: Number(quantities[i.id]) || 0 }))
        .filter((i) => i.quantityReceived > 0);
      if (items.length === 0) {
        setError('Enter a quantity to receive for at least one item.');
        setSaving(false);
        return;
      }
      const updated = await receivePurchaseOrder(po.id, { items });
      onReceived(updated);
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open title={`Receive stock - ${po.orderNumber}`} onClose={onClose}>
      <div className="space-y-3">
        {receivable.map((item) => (
          <div key={item.id} className="flex items-center justify-between gap-3 rounded-lg border border-cream-300 p-3">
            <div>
              <p className="text-sm font-medium text-slate-800">{item.productName}</p>
              <p className="text-xs text-ink-400">Remaining: {item.remainingToReceive} of {item.quantity}</p>
            </div>
            <input
              type="number" min="0" max={item.remainingToReceive}
              value={quantities[item.id]}
              onChange={(e) => setQuantities({ ...quantities, [item.id]: e.target.value })}
              className="w-24 input"
            />
          </div>
        ))}
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="btn btn-secondary btn-sm">Cancel</button>
          <button onClick={submit} disabled={saving} className="btn btn-primary btn-sm">
            {saving ? 'Receiving...' : 'Confirm Receipt'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function CreatePurchaseOrderModal({ open, onClose, onCreated }) {
  const { scopeParams, isSuperAdmin } = useBranchScope();
  const [suppliers, setSuppliers] = useState([]);
  const [branches, setBranches] = useState([]);
  const [form, setForm] = useState(blank());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setForm({ ...blank(), branchId: scopeParams.branchId || '' });
      setError('');
      listSuppliers().then(setSuppliers);
      // Only the Super Admin chooses the receiving branch; everyone else buys for their own.
      if (isSuperAdmin) listBranches().then(setBranches).catch(() => setBranches([]));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const addLine = () => setForm((f) => ({ ...f, items: [...f.items, { product: null, quantity: 1, unitCost: '' }] }));
  const removeLine = (idx) => setForm((f) => ({ ...f, items: f.items.filter((_, i) => i !== idx) }));
  const updateLine = (idx, patch) =>
    setForm((f) => ({ ...f, items: f.items.map((it, i) => (i === idx ? { ...it, ...patch } : it)) }));

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (form.items.some((i) => !i.product)) {
      setError('Pick a product from the list on every line.');
      return;
    }
    setSaving(true);
    try {
      await createPurchaseOrder({
        supplierId: form.supplierId,
        branchId: form.branchId || scopeParams.branchId,
        orderDate: form.orderDate,
        items: form.items.map((i) => ({ productId: i.product.id, quantity: Number(i.quantity), unitCost: Number(i.unitCost) })),
      });
      onCreated();
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} title="New Purchase Order" onClose={onClose} wide>
      <form onSubmit={submit} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          {isSuperAdmin && (
            <label className="col-span-2 block"><span className="mb-1 block text-xs font-medium text-ink-500">Receiving Branch</span>
              <select required className="input" value={form.branchId} onChange={(e) => setForm({ ...form, branchId: e.target.value })}>
                <option value="">Select branch...</option>
                {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </label>
          )}
          <label className="block"><span className="mb-1 block text-xs font-medium text-ink-500">Supplier</span>
            <select required className="input" value={form.supplierId} onChange={(e) => setForm({ ...form, supplierId: e.target.value })}>
              <option value="">Select supplier...</option>
              {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </label>
          <label className="block"><span className="mb-1 block text-xs font-medium text-ink-500">Order Date</span>
            <input required type="date" className="input" value={form.orderDate} onChange={(e) => setForm({ ...form, orderDate: e.target.value })} />
          </label>
        </div>

        <div>
          <div className="mb-1 flex items-center justify-between">
            <span className="text-xs font-medium text-ink-500">Items</span>
            <button type="button" onClick={addLine} className="text-xs font-medium text-sage-600 hover:underline">+ Add line</button>
          </div>
          <div className="space-y-2">
            {form.items.map((item, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <div className="min-w-0 flex-1">
                  <ProductSelect
                    value={item.product}
                    onChange={(product) => updateLine(idx, { product })}
                    placeholder="Search product by name or SKU…"
                    requireAtBranches={form.branchId || scopeParams.branchId || undefined}
                  />
                </div>
                <input required type="number" min="1" placeholder="Qty" className="input w-20" value={item.quantity} onChange={(e) => updateLine(idx, { quantity: e.target.value })} />
                <input required type="number" min="0" step="0.01" placeholder="Cost" className="input w-24" value={item.unitCost} onChange={(e) => updateLine(idx, { unitCost: e.target.value })} />
                <button type="button" onClick={() => removeLine(idx)} className="text-ink-400 hover:text-red-600">✕</button>
              </div>
            ))}
          </div>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="btn btn-secondary btn-sm">Cancel</button>
          <button type="submit" disabled={saving || form.items.length === 0} className="btn btn-primary btn-sm">
            {saving ? 'Saving...' : 'Create Purchase Order'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function blank() {
  return { supplierId: '', branchId: '', orderDate: new Date().toISOString().slice(0, 10), items: [{ product: null, quantity: 1, unitCost: '' }] };
}
