import React, { useEffect, useState } from 'react';
import { searchCustomers, createCustomer, updateCustomer, setCustomerActive, getCustomerBalance } from '../../api/customers.js';
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
import SearchInput from '../../components/SearchInput.jsx';

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
            <button onClick={(e) => { e.stopPropagation(); onEdit(r); }} className="btn-icon" title="Edit customer" aria-label="Edit customer"><Icon name="edit" size={15} /></button>
            <button onClick={(e) => { e.stopPropagation(); onToggleActive(r); }} className="btn-icon" title={r.active ? 'Deactivate' : 'Activate'} aria-label={r.active ? 'Deactivate customer' : 'Activate customer'}>{r.active ? <Icon name="close" size={15} /> : <Icon name="check" size={15} />}</button>
          </div>
        ),
      }]
    : []),
];

export default function CustomersPage() {
  const { hasPermission } = useAuth();
  const canManage = hasPermission('SALES_CREATE') || hasPermission('POS_ACCESS');
  const [search, setSearch] = useState('');
  const [customers, setCustomers] = useState(null);
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
    searchCustomers(search || undefined)
      .then((res) => { setCustomers(res); setStatus('ready'); })
      .catch((err) => { setError(extractErrorMessage(err)); setStatus('error'); });
  };

  useEffect(() => {
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const openCustomer = (customer) => {
    setSelected(customer);
    setBalance(null);
    getCustomerBalance(customer.id).then(setBalance).catch(() => {});
  };

  const confirmToggle = async () => {
    setBusy(true);
    try { await setCustomerActive(toggleTarget.id, !toggleTarget.active); setToggleTarget(null); load(); }
    catch (err) { notifyError(err); } finally { setBusy(false); }
  };

  return (
    <div>
      <h1 className="page-title mb-4">Customers</h1>

      <div className="card card-pad">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <SearchInput value={search} onChange={setSearch} placeholder="Search customers…" />
          {canManage && (
            <button onClick={() => setCreateOpen(true)} className="btn btn-primary btn-sm">
              + New Customer
            </button>
          )}
        </div>

        {status === 'loading' && <LoadingState />}
        {status === 'error' && <ErrorState message={error} onRetry={load} />}
        {status === 'ready' && customers.length === 0 && <EmptyState title="No customers found" />}
        {status === 'ready' && customers.length > 0 && (
          <DataTable columns={COLUMNS(canManage, setEditing, setToggleTarget)} rows={customers} onRowClick={openCustomer} />
        )}
      </div>

      <Modal open={!!selected} title={selected?.name} onClose={() => setSelected(null)}>
        {selected && (
          <div className="space-y-3 text-sm">
            <Row label="Phone" value={selected.phone || '—'} />
            <Row label="Email" value={selected.email || '—'} />
            <Row label="Address" value={selected.address || '—'} />
            <div className="border-t border-cream-200 pt-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-400">Loan Balance</p>
              {balance ? (
                <div className="space-y-1">
                  <Row label="Total Borrowed" value={formatMoney(balance.totalBorrowed)} />
                  <Row label="Total Paid" value={formatMoney(balance.totalPaid)} />
                  <Row label="Outstanding" value={formatMoney(balance.outstandingBalance)} strong />
                </div>
              ) : (
                <p className="text-ink-400">Loading...</p>
              )}
            </div>
          </div>
        )}
      </Modal>

      <CustomerFormModal
        open={createOpen || !!editing}
        customer={editing}
        onClose={() => { setCreateOpen(false); setEditing(null); }}
        onSaved={() => { setCreateOpen(false); setEditing(null); load(); }}
      />

      <ConfirmDialog
        open={!!toggleTarget}
        title={toggleTarget?.active ? 'Deactivate customer?' : 'Activate customer?'}
        description={toggleTarget?.active ? `${toggleTarget?.name} will be hidden from new sales and POS lookups.` : `${toggleTarget?.name} will be available for sales again.`}
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

function CustomerFormModal({ open, customer, onClose, onSaved }) {
  const isEdit = !!customer;
  const [form, setForm] = useState(blank());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setError('');
    setForm(isEdit
      ? { name: customer.name, phone: customer.phone || '', email: customer.email || '', address: customer.address || '' }
      : blank());
  }, [open, customer]);

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      if (isEdit) {
        await updateCustomer(customer.id, form);
      } else {
        await createCustomer(form);
      }
      onSaved();
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} title={isEdit ? `Edit ${customer?.name}` : 'New Customer'} onClose={onClose}>
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

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="btn btn-secondary btn-sm">Cancel</button>
          <button type="submit" disabled={saving} className="btn btn-primary btn-sm">
            {saving ? 'Saving...' : isEdit ? 'Save Changes' : 'Create Customer'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function blank() {
  return { name: '', phone: '', email: '', address: '' };
}
