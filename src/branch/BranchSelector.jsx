import React from 'react';
import { useAuth } from '../auth/AuthContext.jsx';
import { useBranchScope } from './BranchContext.jsx';
import Icon from '../components/Icon.jsx';
import ElegantSelect from '../components/ElegantSelect.jsx';

/** Spec section 37: SUPER_ADMIN gets All Branches/All Stores/All Warehouses/Specific; everyone else just sees their own branch name, no dropdown. */
export default function BranchSelector() {
  const { user } = useAuth();
  const { isSuperAdmin, scope, setScope, specificBranchId, setSpecificBranchId, branches, branchesLoading } =
    useBranchScope();

  if (!isSuperAdmin) {
    return (
      <div className="flex min-w-0 items-center gap-2 rounded-lg border border-cream-300 bg-cream-50 px-2.5 py-1.5 text-sm text-ink-700">
        <span className="relative flex h-2 w-2 shrink-0" aria-hidden="true">
          <span className="absolute inline-flex h-full w-full rounded-full bg-sage-400 opacity-60" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-sage-500" />
        </span>
        <span className="truncate">{user?.branchName || 'Your branch'}</span>
      </div>
    );
  }

  function handleScopeChange(e) {
    const next = e.target.value;
    setScope(next);
    if (next !== 'SPECIFIC') setSpecificBranchId(null);
    else if (!specificBranchId && branches.length) setSpecificBranchId(branches[0].id);
  }

  return (
    <div className="flex min-w-0 items-center gap-2">
      <span className="hidden text-ink-400 sm:block" aria-hidden="true">
        <Icon name="building" size={16} />
      </span>
      <ElegantSelect
        value={scope}
        onChange={(v) => handleScopeChange({ target: { value: v } })}
        ariaLabel="Branch scope"
        width="w-auto"
        minWidth={140}
      >
        <option value="ALL">All Branches</option>
        <option value="STORES">All Stores</option>
        <option value="WAREHOUSES">All Warehouses</option>
        <option value="SPECIFIC">Specific Branch</option>
      </ElegantSelect>

      {scope === 'SPECIFIC' && (
        <ElegantSelect
          value={specificBranchId || ''}
          disabled={branchesLoading}
          onChange={(v) => setSpecificBranchId(v)}
          ariaLabel="Branch"
          width="w-auto"
          minWidth={140}
        >
          {branches.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </ElegantSelect>
      )}
    </div>
  );
}
