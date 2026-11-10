import React, { useEffect, useState } from 'react';
import { listSuppliers, createSupplier, updateSupplier, setSupplierActive, getSupplierBalance } from '../../api/suppliers.js';
import { extractErrorMessage, notifyError } from '../../api/client.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import DataTable from '../../components/DataTable.jsx';
import LoadingState from '../../components/LoadingState.jsx';
import ErrorState from '../../components/ErrorState.jsx';
import EmptyState from '../../components/EmptyState.jsx';
import Modal from '../../components/Modal.jsx';
import ConfirmDialog from '../../components/ConfirmDialog.jsx';
import Badge from '../../components/Badge.jsx';
import Icon from '../../components/Icon.jsx';
import { formatMoney } from '../../utils/format.js';

const COLUMNS = (canManage, onEdit, onToggleActive) => [
  { key: 'name', header: 'Name', render: (r) => <span className="font-medium text-ink-900">{r.name}</span> },
  { key: 'phone', header: 'Phone', render: (r) => r.phone || '—' },
  { key: 'email', header: 'Email', render: (r) => r.email || '—' },
  { key: 'active', header: 'Status', render: (r) => <Badge status={r.active ? 'ACTIVE' : 'INACTIVE'} /> },
  ...(canManage
    ? [{
        key: 'actions', header: '', className: 'text-right',
        render: (r) => (
          <div className="flex justify-end gap-3 text-xs">
            <button onClick={(e) => { e.stopPropagation(); onEdit(r); }} className="btn-icon" title="Edit supplier" aria-label="Edit supplier"><Icon name="edit" size={15} /></button>
            <button onClick={(e) => { e.stopPropagation(); onToggleActive(r); }} className="btn-icon" title={r.active ? 'Deactivate' : 'Activate'} aria-label={r.active ? 'Deactivate supplier' : 'Activate supplier'}>{r.active ? <Icon name="close" size={15} /> : <Icon name="check" size={15} />}</button>
          </div>
        ),
      }]
    : []),
];

export default function SuppliersPage() {
  const { hasPermission } = useAuth();
  const canManage = hasPermission('SUPPLIER_MANAGE');
  const [suppliers, setSuppliers] = useState(null);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [toggleTarget, setToggleTarget] = useState(null);
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState(null);
  const [balance, setBalance] = useState(null);

  const load = () => {
    setStatus('loading');
    listSuppliers(true)
      .then((res) => { setSuppliers(res); setStatus('ready'); })
      .catch((err) => { setError(extractErrorMessage(err)); setStatus('error'); });
  };

  useEffect(load, []);

  const openSupplier = (supplier) => {
    setSelected(supplier);
    setBalance(null);
    getSupplierBalance(supplier.id)
      .then(setBalance)
      .catch(() => setBalance('forbidden'));
  };

  const confirmToggle = async () => {
    setBusy(true);
    try { await setSupplierActive(toggleTarget.id, !toggleTarget.active); setToggleTarget(null); load(); }
    catch (err) { notifyError(err); } finally { setBusy(false); }
  };

  return (
    <div>
      <h1 className="page-title mb-4">Suppliers</h1>

      <div className="card card-pad">
        <div className="mb-3 flex justify-end">
          {canManage && (
            <button onClick={() => setCreateOpen(true)} className="btn btn-primary btn-sm">
              + New Supplier
            </button>
          )}
        </div>

        {status === 'loading' && <LoadingState />}
        {status === 'error' && <ErrorState message={error} onRetry={load} />}
        {status === 'ready' && suppliers.length === 0 && <EmptyState title="No suppliers yet" />}
        {status === 'ready' && suppliers.length > 0 && (
          <DataTable columns={COLUMNS(canManage, setEditing, setToggleTarget)} rows={suppliers} onRowClick={openSupplier} />
        )}
      </div>

      <Modal open={!!selected} title={selected?.name} onClose={() => setSelected(null)}>
        {selected && (
          <div className="space-y-3 text-sm">
            <Row label="Phone" value={selected.phone || '—'} />
            <Row label="Email" value={selected.email || '—'} />
            <Row label="Address" value={selected.address || '—'} />
            <Row label="Tax Number" value={selected.taxNumber || '—'} />
            <div className="border-t border-cream-200 pt-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-400">Balance</p>
              {balance === 'forbidden' && (
                <p className="text-ink-400">You don't have permission to view supplier balances.</p>
              )}
              {balance && balance !== 'forbidden' && (
                <div className="space-y-1">
                  <Row label="Total Purchased" value={formatMoney(balance.totalPurchased)} />
                  <Row label="Total Paid" value={formatMoney(balance.totalPaid)} />
                  <Row label="Outstanding" value={formatMoney(balance.outstandingBalance)} strong />
                  <p className="pt-1 text-xs text-ink-400">
                    Outstanding here currently equals total purchased minus returns - supplier payment
                    tracking is a later phase, so paid stays at zero until then.
                  </p>
                </div>
              )}
              {balance === null && <p className="text-ink-400">Loading...</p>}
            </div>
          </div>
        )}
      </Modal>

      <SupplierFormModal
        open={createOpen || !!editing}
        supplier={editing}
        onClose={() => { setCreateOpen(false); setEditing(null); }}
        onSaved={() => { setCreateOpen(false); setEditing(null); load(); }}
      />

      <ConfirmDialog
        open={!!toggleTarget}
        title={toggleTarget?.active ? 'Deactivate supplier?' : 'Activate supplier?'}
        description={toggleTarget?.active ? `${toggleTarget?.name} will be hidden from new purchase orders.` : `${toggleTarget?.name} will be available for purchase orders again.`}
        confirmLabel={toggleTarget?.active ? 'Deactivate' : 'Activate'}
        danger={toggleTarget?.active}
        busy={busy}
        onConfirm={confirmToggle}
        onCancel={() => setToggleTarget(null)}
      />
    </div>
  );
}

function Row({ label, value, strong }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-ink-400">{label}</span>
      <span className={strong ? 'font-semibold text-ink-900' : 'text-ink-700'}>{value}</span>
    </div>
  );
}

function SupplierFormModal({ open, supplier, onClose, onSaved }) {
  const isEdit = !!supplier;
  const [form, setForm] = useState(blank());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setError('');
    setForm(isEdit
      ? { name: supplier.name, phone: supplier.phone || '', email: supplier.email || '', address: supplier.address || '', taxNumber: supplier.taxNumber || '' }
      : blank());
  }, [open, supplier]);

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      if (isEdit) {
        await updateSupplier(supplier.id, form);
      } else {
        await createSupplier(form);
      }
      onSaved();
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} title={isEdit ? `Edit ${supplier?.name}` : 'New Supplier'} onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <label className="block"><span className="mb-1 block text-xs font-medium text-ink-500">Name</span>
          <input required className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </label>
        <label className="block"><span className="mb-1 block text-xs font-medium text-ink-500">Phone</span>
          <input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        </label>
        <label className="block"><span className="mb-1 block text-xs font-medium text-ink-500">Email</span>
          <input type="email" className="input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </label>
        <label className="block"><span className="mb-1 block text-xs font-medium text-ink-500">Address</span>
          <input className="input" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
        </label>
        <label className="block"><span className="mb-1 block text-xs font-medium text-ink-500">Tax Number</span>
          <input className="input" value={form.taxNumber} onChange={(e) => setForm({ ...form, taxNumber: e.target.value })} />
        </label>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="btn btn-secondary btn-sm">Cancel</button>
          <button type="submit" disabled={saving} className="btn btn-primary btn-sm">
            {saving ? 'Saving...' : isEdit ? 'Save Changes' : 'Create Supplier'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function blank() {
  return { name: '', phone: '', email: '', address: '', taxNumber: '' };
}
