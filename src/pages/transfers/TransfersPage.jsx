import React, { useEffect, useState } from 'react';
import {
  searchTransfers, getTransfer, createTransfer,
  approveTransfer, rejectTransfer, cancelTransfer, dispatchTransfer, receiveTransfer,
} from '../../api/transfers.js';
import { listTransferBranches } from '../../api/branches.js';
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
import { formatDateTime } from '../../utils/format.js';

const COLUMNS = [
  { key: 'transferNumber', header: 'Transfer #', render: (r) => <span className="font-medium text-ink-900">{r.transferNumber}</span> },
  { key: 'sourceBranchName', header: 'From' },
  { key: 'destinationBranchName', header: 'To' },
  { key: 'status', header: 'Status', render: (r) => <Badge status={r.status} /> },
  { key: 'requestedAt', header: 'Requested', render: (r) => formatDateTime(r.requestedAt) },
];

/**
 * Lifecycle per spec section 19: PENDING -> APPROVED -> IN_TRANSIT ->
 * RECEIVED (or REJECTED/CANCELLED before dispatch). Stock only actually
 * moves at dispatch (source deducted, FIFO) and receive (destination
 * batches created preserving cost) - see StockTransferService. Buttons
 * below only ever appear when both the permission AND the current status
 * genuinely allow the action; the backend is still the real enforcer.
 */
export default function TransfersPage() {
  const { hasPermission } = useAuth();
  const { scopeParams } = useBranchScope();
  const [page, setPage] = useState(0);
  const [data, setData] = useState(null);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(null);
  const [detailStatus, setDetailStatus] = useState('idle');
  const [actionError, setActionError] = useState('');
  const [createOpen, setCreateOpen] = useState(false);

  const load = () => {
    setStatus('loading');
    searchTransfers({ ...scopeParams, page })
      .then((res) => { setData(res); setStatus('ready'); })
      .catch((err) => { setError(extractErrorMessage(err)); setStatus('error'); });
  };

  useEffect(load, [page, scopeParams.scope, scopeParams.branchId]);

  const openTransfer = (row) => {
    setDetailStatus('loading');
    setActionError('');
    getTransfer(row.id)
      .then((t) => { setSelected(t); setDetailStatus('ready'); })
      .catch((err) => { setError(extractErrorMessage(err)); setDetailStatus('error'); });
  };

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
      <h1 className="page-title mb-4">Transfers</h1>

      <div className="card card-pad">
        <div className="mb-3 flex justify-end">
          {hasPermission('TRANSFER_CREATE') && (
            <button onClick={() => setCreateOpen(true)} className="btn btn-primary btn-sm">
              + New Transfer
            </button>
          )}
        </div>

        {status === 'loading' && <LoadingState />}
        {status === 'error' && <ErrorState message={error} onRetry={load} />}
        {status === 'ready' && (
          <>
            <DataTable columns={COLUMNS} rows={data.content} onRowClick={openTransfer} emptyMessage="No transfers yet." />
            <div className="mt-3">
              <Pagination page={data.page} totalPages={data.totalPages} totalElements={data.totalElements} onPageChange={setPage} />
            </div>
          </>
        )}
      </div>

      <Modal open={!!selected || detailStatus === 'loading'} title={selected ? selected.transferNumber : 'Loading...'} onClose={() => setSelected(null)} wide>
        {detailStatus === 'loading' && <LoadingState />}
        {selected && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
              <Info label="From" value={selected.sourceBranchName} />
              <Info label="To" value={selected.destinationBranchName} />
              <Info label="Status" value={<Badge status={selected.status} />} />
              <Info label="Requested By" value={selected.requestedByName} />
              <Info label="Approved By" value={selected.approvedByName || '—'} />
              <Info label="Received By" value={selected.receivedByName || '—'} />
            </div>

            {selected.rejectionReason && (
              <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">Rejected: {selected.rejectionReason}</p>
            )}

            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-cream-200 text-left text-xs uppercase text-ink-400">
                  <th className="py-1.5 pr-3 font-medium">Product</th>
                  <th className="py-1.5 pr-3 text-right font-medium">Quantity</th>
                  <th className="py-1.5 pr-3 font-medium">Batches (cost preserved)</th>
                </tr>
              </thead>
              <tbody>
                {selected.items.map((item) => (
                  <tr key={item.productId} className="border-b border-slate-50 last:border-0">
                    <td className="py-1.5 pr-3">{item.productName}</td>
                    <td className="py-1.5 pr-3 text-right">{item.quantity}</td>
                    <td className="py-1.5 pr-3 text-xs text-ink-500">
                      {item.allocations.length === 0
                        ? 'Not yet dispatched'
                        : item.allocations.map((a) => `${a.sourceBatchNumber} × ${a.quantityAllocated}`).join(', ')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {actionError && <p className="alert alert-error">{actionError}</p>}

            <div className="flex flex-wrap justify-end gap-2 border-t border-cream-200 pt-3">
              {selected.status === 'PENDING' && hasPermission('TRANSFER_APPROVE') && (
                <>
                  <ActionButton primary onClick={() => runAction(() => approveTransfer(selected.id))}>Approve</ActionButton>
                  <ActionButton danger onClick={() => runAction(() => rejectTransfer(selected.id, 'Rejected by approver'))}>Reject</ActionButton>
                </>
              )}
              {selected.status === 'APPROVED' && hasPermission('TRANSFER_APPROVE') && (
                <ActionButton primary onClick={() => runAction(() => dispatchTransfer(selected.id))}>Dispatch (Deduct Source Stock)</ActionButton>
              )}
              {selected.status === 'IN_TRANSIT' && hasPermission('TRANSFER_RECEIVE') && (
                <ActionButton primary onClick={() => runAction(() => receiveTransfer(selected.id))}>Receive at Destination</ActionButton>
              )}
              {['PENDING', 'APPROVED'].includes(selected.status) && hasPermission('TRANSFER_CREATE') && (
                <ActionButton danger onClick={() => runAction(() => cancelTransfer(selected.id))}>Cancel</ActionButton>
              )}
            </div>
          </div>
        )}
      </Modal>

      <CreateTransferModal open={createOpen} onClose={() => setCreateOpen(false)} onCreated={() => { setCreateOpen(false); load(); }} />
    </div>
  );
}

function ActionButton({ children, onClick, primary, danger }) {
  const cls = primary ? 'btn-primary' : danger ? 'btn-danger' : 'btn-secondary';
  return <button onClick={onClick} className={`btn btn-sm ${cls}`}>{children}</button>;
}

function Info({ label, value }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-ink-400">{label}</p>
      <p className="text-slate-800">{value}</p>
    </div>
  );
}

function CreateTransferModal({ open, onClose, onCreated }) {
  const [branches, setBranches] = useState([]);
  const [form, setForm] = useState(blank());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setForm(blank());
      setError('');
      listTransferBranches().then(setBranches);
    }
  }, [open]);

  const addLine = () => setForm((f) => ({ ...f, items: [...f.items, { product: null, quantity: 1 }] }));
  const removeLine = (idx) => setForm((f) => ({ ...f, items: f.items.filter((_, i) => i !== idx) }));
  const updateLine = (idx, patch) => setForm((f) => ({ ...f, items: f.items.map((it, i) => (i === idx ? { ...it, ...patch } : it)) }));

  const submit = async (e) => {
    e.preventDefault();
    if (form.sourceBranchId === form.destinationBranchId) {
      setError('Source and destination branches must be different.');
      return;
    }
    if (form.items.some((i) => !i.product)) {
      setError('Pick a product from the list on every line.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await createTransfer({
        sourceBranchId: form.sourceBranchId,
        destinationBranchId: form.destinationBranchId,
        items: form.items.map((i) => ({ productId: i.product.id, quantity: Number(i.quantity) })),
      });
      onCreated();
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} title="New Transfer Request" onClose={onClose} wide>
      <form onSubmit={submit} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <label className="block"><span className="mb-1 block text-xs font-medium text-ink-500">Source Branch</span>
            <select required className="input" value={form.sourceBranchId} onChange={(e) => setForm({ ...form, sourceBranchId: e.target.value })}>
              <option value="">Select...</option>
              {branches.map((b) => <option key={b.id} value={b.id}>{b.name} · {b.type === 'STORE' ? 'Store' : 'Warehouse'}</option>)}
            </select>
          </label>
          <label className="block"><span className="mb-1 block text-xs font-medium text-ink-500">Destination Branch</span>
            <select required className="input" value={form.destinationBranchId} onChange={(e) => setForm({ ...form, destinationBranchId: e.target.value })}>
              <option value="">Select...</option>
              {branches.map((b) => <option key={b.id} value={b.id}>{b.name} · {b.type === 'STORE' ? 'Store' : 'Warehouse'}</option>)}
            </select>
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
                    requireAtBranches={[form.sourceBranchId, form.destinationBranchId].filter(Boolean)}
                  />
                </div>
                <input required type="number" min="1" placeholder="Qty" className="input w-24" value={item.quantity} onChange={(e) => updateLine(idx, { quantity: e.target.value })} />
                <button type="button" onClick={() => removeLine(idx)} className="text-ink-400 hover:text-red-600">✕</button>
              </div>
            ))}
          </div>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="btn btn-secondary btn-sm">Cancel</button>
          <button type="submit" disabled={saving || form.items.length === 0} className="btn btn-primary btn-sm">
            {saving ? 'Saving...' : 'Request Transfer'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function blank() {
  return { sourceBranchId: '', destinationBranchId: '', items: [{ product: null, quantity: 1 }] };
}
