import React, { useEffect, useMemo, useState } from 'react';
import { listRoles, getPermissionCatalog, createRole, updateRole, deleteRole } from '../../api/roles.js';
import { extractErrorMessage } from '../../api/client.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import LoadingState from '../../components/LoadingState.jsx';
import ErrorState from '../../components/ErrorState.jsx';
import ConfirmDialog from '../../components/ConfirmDialog.jsx';

/**
 * Roles & Permissions. Every role - the five built-in ones and any you create - is a named set of
 * switches. Each switch is either "can open this page", "can do this action" or "can see this
 * information" (costs, profit, inventory value, dashboard panels...). The switches that exist are
 * defined by the system and listed here in groups; which role holds which is what you choose.
 *
 * Only a Super Admin can change anything. The Super Admin role itself always has every switch.
 */
export default function RolesPage() {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';

  const [roles, setRoles] = useState([]);
  const [catalog, setCatalog] = useState([]);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');

  const [selectedId, setSelectedId] = useState(null); // a role id, or 'new' while creating
  const [draft, setDraft] = useState(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [notice, setNotice] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  const load = async (selectId) => {
    try {
      const [roleList, permissionList] = await Promise.all([listRoles(), getPermissionCatalog()]);
      setRoles(roleList);
      setCatalog(permissionList);
      const toSelect = roleList.find((r) => r.id === selectId) || roleList[0] || null;
      if (toSelect) {
        setSelectedId(toSelect.id);
        setDraft(draftFromRole(toSelect));
      }
      setStatus('ready');
    } catch (err) {
      setError(extractErrorMessage(err));
      setStatus('error');
    }
  };

  useEffect(() => {
    load(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The catalog is a flat list; the editor shows it grouped by page, in the order it arrives.
  const groups = useMemo(() => {
    const byGroup = new Map();
    catalog.forEach((p) => {
      if (!byGroup.has(p.group)) byGroup.set(p.group, []);
      byGroup.get(p.group).push(p);
    });
    return [...byGroup.entries()];
  }, [catalog]);

  const isNew = selectedId === 'new';
  const current = roles.find((r) => r.id === selectedId) || null; // null while creating
  const readOnly = !isSuperAdmin || Boolean(current && current.superAdmin);
  const nameEditable = isNew || Boolean(current && !current.systemRole);

  const dirty = isNew
    ? true
    : Boolean(draft && current && (
      draft.name !== current.name
      || (draft.description || '') !== (current.description || '')
      || !sameSet(draft.permissions, new Set(current.permissions))
    ));

  const selectRole = (role) => {
    setSelectedId(role.id);
    setDraft(draftFromRole(role));
    setFormError('');
    setNotice('');
  };

  const startNew = () => {
    setSelectedId('new');
    setDraft(newDraft());
    setFormError('');
    setNotice('');
  };

  const discard = () => {
    if (isNew) {
      if (roles[0]) selectRole(roles[0]);
    } else if (current) {
      selectRole(current);
    }
  };

  const togglePermission = (key) => {
    const next = new Set(draft.permissions);
    if (next.has(key)) next.delete(key); else next.add(key);
    setDraft({ ...draft, permissions: next });
  };

  const setGroup = (items, on) => {
    const next = new Set(draft.permissions);
    items.forEach((p) => { if (on) next.add(p.key); else next.delete(p.key); });
    setDraft({ ...draft, permissions: next });
  };

  const save = async () => {
    setSaving(true);
    setFormError('');
    setNotice('');
    try {
      const payload = {
        name: draft.name,
        description: draft.description,
        branchType: draft.branchType,
        canManageBranch: draft.canManageBranch,
        permissions: [...draft.permissions],
      };
      const saved = isNew ? await createRole(payload) : await updateRole(selectedId, payload);
      await load(saved.id);
      setNotice(isNew
        ? 'Role created. You can now assign it to users on the Users page.'
        : 'Saved. The change applies the next time each person reloads the page or signs in.');
    } catch (err) {
      setFormError(extractErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const doDelete = async () => {
    setSaving(true);
    setFormError('');
    try {
      await deleteRole(selectedId);
      setConfirmDelete(false);
      await load(null);
      setNotice('Role deleted.');
    } catch (err) {
      setConfirmDelete(false);
      setFormError(extractErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  if (status === 'loading') return <LoadingState />;
  if (status === 'error') return <ErrorState message={error} onRetry={() => load(selectedId)} />;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="page-title">Roles &amp; Permissions</h1>
          <p className="text-sm text-ink-500">
            Choose what each role can open, do and see. A change applies the next time a person reloads the page or signs in.
          </p>
        </div>
        {isSuperAdmin && (
          <button
            onClick={startNew}
            className="btn btn-primary btn-sm"
          >
            + New role
          </button>
        )}
      </div>

      {!isSuperAdmin && (
        <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Only a Super Admin can change roles. You can look at them here.
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
        <div className="space-y-2">
          {roles.map((role) => (
            <button
              key={role.id}
              type="button"
              onClick={() => selectRole(role)}
              className={`block w-full rounded-xl border px-3 py-2 text-left transition ${
                selectedId === role.id ? 'border-brand-500 bg-cream-100' : 'border-cream-300 bg-cream-50 hover:bg-cream-50'
              }`}
            >
              <p className="text-sm font-medium text-ink-900">{role.name}</p>
              <p className="text-xs text-ink-500">
                {role.systemRole ? 'Built-in' : 'Custom'} · {role.userCount} {role.userCount === 1 ? 'user' : 'users'}
              </p>
            </button>
          ))}
          {isNew && (
            <div className="rounded-xl border border-brand-500 bg-cream-100 px-3 py-2">
              <p className="text-sm font-medium text-ink-900">{draft?.name || 'New role'}</p>
              <p className="text-xs text-ink-500">Not saved yet</p>
            </div>
          )}
        </div>

        {draft && (
          <div className="card card-pad space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-ink-500">Role name</span>
                <input
                  className="input"
                  value={draft.name}
                  disabled={readOnly || !nameEditable}
                  placeholder="For example: Cashier"
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-ink-500">Description (optional)</span>
                <input
                  className="input"
                  value={draft.description}
                  disabled={readOnly || !nameEditable}
                  onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                />
              </label>
            </div>

            {isNew ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-ink-500">This role works at</span>
                  <select
                    className="input"
                    value={draft.branchType}
                    onChange={(e) => setDraft({ ...draft, branchType: e.target.value })}
                  >
                    <option value="STORE">A store</option>
                    <option value="WAREHOUSE">A warehouse</option>
                  </select>
                </label>
                <label className="flex items-center gap-2 text-sm text-ink-700 sm:pt-5">
                  <input
                    type="checkbox"
                    checked={draft.canManageBranch}
                    onChange={(e) => setDraft({ ...draft, canManageBranch: e.target.checked })}
                  />
                  Can be set as the manager of a branch
                </label>
                <p className="text-xs text-ink-400 sm:col-span-2">
                  This is fixed once the role is created. It only decides which kind of branch people in this role
                  can be placed in - what they can do is the list below.
                </p>
              </div>
            ) : (
              <p className="text-xs text-ink-500">
                {current && current.superAdmin
                  ? 'Full access to everything, in every branch. This role cannot be changed.'
                  : `Works at a ${current && current.branchType ? current.branchType.toLowerCase() : 'branch'}`
                    + `${current && current.canManageBranch ? ' and can be set as a branch manager' : ''}.`}
              </p>
            )}

            {!(current && current.superAdmin) && (
              <div className="space-y-3">
                <p className="text-sm text-ink-600">
                  {draft.permissions.size} of {catalog.length} switches on
                </p>
                {groups.map(([group, items]) => (
                  <div key={group} className="rounded-lg border border-cream-300 p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <p className="text-sm font-semibold text-slate-800">{group}</p>
                      {!readOnly && (
                        <div className="flex gap-3 text-xs">
                          <button type="button" onClick={() => setGroup(items, true)} className="text-sage-600 hover:underline">
                            All
                          </button>
                          <button type="button" onClick={() => setGroup(items, false)} className="text-ink-500 hover:underline">
                            None
                          </button>
                        </div>
                      )}
                    </div>
                    <div className="space-y-2">
                      {items.map((p) => (
                        <label key={p.key} className="flex items-start gap-2">
                          <input
                            type="checkbox"
                            className="mt-0.5"
                            checked={draft.permissions.has(p.key)}
                            disabled={readOnly}
                            onChange={() => togglePermission(p.key)}
                          />
                          <span>
                            <span className="text-sm text-slate-800">{p.label}</span>
                            <span className="block text-xs text-ink-500">{p.description}</span>
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {formError && <p className="text-sm text-red-600">{formError}</p>}
            {notice && <p className="text-sm text-emerald-700">{notice}</p>}

            {!readOnly && (
              <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
                <div>
                  {current && !current.systemRole && (
                    <>
                      <button
                        type="button"
                        onClick={() => setConfirmDelete(true)}
                        disabled={current.userCount > 0}
                        className="btn btn-sm border border-red-200 bg-cream-50 text-red-600 hover:border-red-300 hover:bg-red-50"
                      >
                        Delete role
                      </button>
                      {current.userCount > 0 && (
                        <span className="ml-2 text-xs text-ink-400">Move its users to another role first.</span>
                      )}
                    </>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={discard}
                    className="btn btn-secondary btn-sm"
                  >
                    {isNew ? 'Cancel' : 'Discard changes'}
                  </button>
                  <button
                    type="button"
                    onClick={save}
                    disabled={saving || !dirty || !draft.name.trim()}
                    className="btn btn-primary btn-sm"
                  >
                    {saving ? 'Saving...' : isNew ? 'Create role' : 'Save changes'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={confirmDelete}
        danger
        title="Delete this role?"
        description={current ? `"${current.name}" will be removed. Nobody is using it, so no one loses access.` : ''}
        confirmLabel="Delete"
        busy={saving}
        onConfirm={doDelete}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  );
}

function draftFromRole(role) {
  return {
    name: role.name,
    description: role.description || '',
    branchType: role.branchType || 'STORE',
    canManageBranch: Boolean(role.canManageBranch),
    permissions: new Set(role.permissions),
  };
}

function newDraft() {
  return { name: '', description: '', branchType: 'STORE', canManageBranch: false, permissions: new Set() };
}

function sameSet(a, b) {
  if (a.size !== b.size) return false;
  for (const value of a) {
    if (!b.has(value)) return false;
  }
  return true;
}
