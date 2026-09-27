import React, { useEffect, useState } from 'react';
import { searchUsers, createUser, updateUser, setUserActive, resetUserPassword } from '../../api/users.js';
import { listBranches } from '../../api/branches.js';
import { listRoles } from '../../api/roles.js';
import { extractErrorMessage } from '../../api/client.js';
import DataTable from '../../components/DataTable.jsx';
import LoadingState from '../../components/LoadingState.jsx';
import ErrorState from '../../components/ErrorState.jsx';
import Pagination from '../../components/Pagination.jsx';
import Modal from '../../components/Modal.jsx';
import ConfirmDialog from '../../components/ConfirmDialog.jsx';
import Badge from '../../components/Badge.jsx';
import { formatDate } from '../../utils/format.js';
import Icon from '../../components/Icon.jsx';
import SearchInput from '../../components/SearchInput.jsx';

// The roles come from the Roles & Permissions page (GET /api/roles). A role knows what kind of
// branch it belongs to (branchType: STORE, WAREHOUSE, or none for the Super Admin), so the form
// only offers a branch of the right type. The backend re-validates this regardless.

const COLUMNS = (onEdit, onResetPassword, onToggleActive) => [
  { key: 'name', header: 'Name', render: (r) => <span className="font-medium text-ink-900">{r.name}</span> },
  { key: 'email', header: 'Email' },
  { key: 'roleName', header: 'Role', render: (r) => r.roleName || r.role.replaceAll('_', ' ') },
  { key: 'branchName', header: 'Branch', render: (r) => r.branchName || '—' },
  { key: 'active', header: 'Status', render: (r) => <Badge status={r.active ? 'ACTIVE' : 'INACTIVE'} /> },
  {
    key: 'actions', header: '', className: 'text-right',
    render: (r) => (
      <div className="flex justify-end gap-3 text-xs">
        <button onClick={(e) => { e.stopPropagation(); onEdit(r); }} className="btn-icon" title="Edit user" aria-label="Edit user"><Icon name="edit" size={15} /></button>
        <button onClick={(e) => { e.stopPropagation(); onResetPassword(r); }} className="btn-icon" title="Reset password" aria-label="Reset password"><Icon name="lock" size={15} /></button>
        <button onClick={(e) => { e.stopPropagation(); onToggleActive(r); }} className="btn-icon" title={r.active ? "Deactivate" : "Activate"} aria-label={r.active ? "Deactivate user" : "Activate user"}>{r.active ? <Icon name="close" size={15} /> : <Icon name="check" size={15} />}</button>
      </div>
    ),
  },
];

export default function UsersPage() {
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState('');
  const [data, setData] = useState(null);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');
  const [branches, setBranches] = useState([]);
  const [roles, setRoles] = useState([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [resetTarget, setResetTarget] = useState(null);
  const [toggleTarget, setToggleTarget] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = () => {
    setStatus('loading');
    searchUsers({ search: search || undefined, page })
      .then((res) => { setData(res); setStatus('ready'); })
      .catch((err) => { setError(extractErrorMessage(err)); setStatus('error'); });
  };
  useEffect(load, [page]);
  useEffect(() => { const t = setTimeout(load, 300); return () => clearTimeout(t); /* eslint-disable-line react-hooks/exhaustive-deps */ }, [search]);
  useEffect(() => { listBranches().then(setBranches); listRoles().then(setRoles); }, []);

  const confirmToggle = async () => {
    setBusy(true);
    try { await setUserActive(toggleTarget.id, !toggleTarget.active); setToggleTarget(null); load(); }
    catch (err) { alert(extractErrorMessage(err)); } finally { setBusy(false); }
  };

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="page-title">Users</h1>
        <div className="flex items-center gap-2">
          <SearchInput value={search} onChange={(v) => { setPage(0); setSearch(v); }} placeholder="Search name or email…" width="w-56" />
          <button onClick={() => setCreateOpen(true)} className="btn btn-primary btn-sm">
            + New User
          </button>
        </div>
      </div>

      <div className="card card-pad">
        {status === 'loading' && <LoadingState />}
        {status === 'error' && <ErrorState message={error} onRetry={load} />}
        {status === 'ready' && (
          <>
            <DataTable
              columns={COLUMNS(setEditing, setResetTarget, setToggleTarget)}
              rows={data.content}
              emptyMessage="No users found."
            />
            <div className="mt-3">
              <Pagination page={data.page} totalPages={data.totalPages} totalElements={data.totalElements} onPageChange={setPage} />
            </div>
          </>
        )}
      </div>

      <UserFormModal
        open={createOpen || !!editing}
        user={editing}
        branches={branches}
        roles={roles}
        onClose={() => { setCreateOpen(false); setEditing(null); }}
        onSaved={() => { setCreateOpen(false); setEditing(null); load(); }}
      />

      <ResetPasswordModal target={resetTarget} onClose={() => setResetTarget(null)} />

      <ConfirmDialog
        open={!!toggleTarget}
        title={toggleTarget?.active ? 'Deactivate user?' : 'Activate user?'}
        description={toggleTarget?.active ? `${toggleTarget?.name} will no longer be able to sign in.` : `${toggleTarget?.name} will be able to sign in again.`}
        confirmLabel={toggleTarget?.active ? 'Deactivate' : 'Activate'}
        danger={toggleTarget?.active}
        busy={busy}
        onConfirm={confirmToggle}
        onCancel={() => setToggleTarget(null)}
      />
    </div>
  );
}

function UserFormModal({ open, user, branches, roles, onClose, onSaved }) {
  const isEdit = !!user;
  const [form, setForm] = useState(blank());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setError('');
    setForm(isEdit
      ? { name: user.name, email: user.email, phone: user.phone || '', password: '', roleId: user.roleId || '', branchId: user.branchId || '' }
      : blank());
  }, [open, user]);

  const selectedRole = roles.find((r) => r.id === form.roleId);
  const requiredType = selectedRole?.branchType || null;
  const branchOptions = requiredType ? branches.filter((b) => b.type === requiredType) : [];

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true); setError('');
    try {
      const branchId = selectedRole?.superAdmin ? null : (form.branchId || null);
      if (isEdit) {
        await updateUser(user.id, { name: form.name, phone: form.phone, roleId: form.roleId, branchId });
      } else {
        await createUser({ name: form.name, email: form.email, phone: form.phone, password: form.password, roleId: form.roleId, branchId });
      }
      onSaved();
    } catch (err) { setError(extractErrorMessage(err)); } finally { setSaving(false); }
  };

  return (
    <Modal open={open} title={isEdit ? `Edit ${user?.name}` : 'New User'} onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <label className="block"><span className="mb-1 block text-xs font-medium text-ink-500">Name</span>
          <input required className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </label>
        <label className="block"><span className="mb-1 block text-xs font-medium text-ink-500">Email</span>
          <input required type="email" disabled={isEdit} className="input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </label>
        {!isEdit && (
          <label className="block"><span className="mb-1 block text-xs font-medium text-ink-500">Password</span>
            <input required minLength={8} type="password" className="input" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          </label>
        )}
        <label className="block"><span className="mb-1 block text-xs font-medium text-ink-500">Role</span>
          <select required className="input" value={form.roleId} onChange={(e) => setForm({ ...form, roleId: e.target.value, branchId: '' })}>
            <option value="">Select role...</option>
            {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        </label>
        {requiredType && (
          <label className="block"><span className="mb-1 block text-xs font-medium text-ink-500">Branch ({requiredType.toLowerCase()})</span>
            <select required className="input" value={form.branchId} onChange={(e) => setForm({ ...form, branchId: e.target.value })}>
              <option value="">Select branch...</option>
              {branchOptions.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </label>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="btn btn-secondary btn-sm">Cancel</button>
          <button type="submit" disabled={saving} className="btn btn-primary btn-sm">
            {saving ? 'Saving...' : isEdit ? 'Save Changes' : 'Create User'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function ResetPasswordModal({ target, onClose }) {
  const [password, setPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => { setPassword(''); setError(''); setDone(false); }, [target]);

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true); setError('');
    try { await resetUserPassword(target.id, password); setDone(true); }
    catch (err) { setError(extractErrorMessage(err)); } finally { setSaving(false); }
  };

  return (
    <Modal open={!!target} title={`Reset Password — ${target?.name}`} onClose={onClose}>
      {done ? (
        <div className="space-y-3">
          <p className="text-sm text-emerald-700">Password reset. Share the new password with {target?.name} through a secure channel.</p>
          <div className="flex justify-end"><button onClick={onClose} className="btn btn-primary btn-sm">Done</button></div>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-3">
          <label className="block"><span className="mb-1 block text-xs font-medium text-ink-500">New Password</span>
            <input required minLength={8} type="password" className="input" value={password} onChange={(e) => setPassword(e.target.value)} />
          </label>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn btn-secondary btn-sm">Cancel</button>
            <button type="submit" disabled={saving} className="btn btn-primary btn-sm">
              {saving ? 'Resetting...' : 'Reset Password'}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}

function blank() {
  return { name: '', email: '', phone: '', password: '', roleId: '', branchId: '' };
}
