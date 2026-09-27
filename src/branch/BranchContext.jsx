import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../auth/AuthContext.jsx';
import { listBranches } from '../api/branches.js';

const BranchContext = createContext(null);

/**
 * Holds the GLOBAL branch-selector state (spec section 37): scope is one
 * of ALL / STORES / WAREHOUSES / SPECIFIC, paired with a specificBranchId
 * when scope is SPECIFIC. Every page that calls a scoped endpoint
 * (dashboard, reports, finance, inventory overview...) reads from here so
 * the selector in the topbar drives the whole app consistently.
 *
 * This is a UI convenience only - it is never what actually restricts a
 * non-admin's data. BranchAccessService on the backend collapses any
 * scope/branchId a non-admin sends down to their own assigned branch
 * regardless of what this context holds, so there's nothing to bypass by
 * tampering with this state client-side.
 */
const BranchContext_ = BranchContext;

export function BranchProvider({ children }) {
  const { user, status } = useAuth();
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';

  const [scope, setScope] = useState('ALL');
  const [specificBranchId, setSpecificBranchId] = useState(null);
  const [branches, setBranches] = useState([]);
  const [branchesLoading, setBranchesLoading] = useState(false);

  // Non-admins never see a scope selector at all - pin them to their own
  // branch the moment we know who they are.
  useEffect(() => {
    if (status !== 'authenticated' || !user) return;
    if (!isSuperAdmin && user.branchId) {
      setScope('SPECIFIC');
      setSpecificBranchId(user.branchId);
    }
  }, [status, user, isSuperAdmin]);

  // Only super-admins need the full branch list, to populate the "Specific
  // Store/Warehouse" dropdown.
  useEffect(() => {
    if (status !== 'authenticated' || !isSuperAdmin) return;
    setBranchesLoading(true);
    listBranches()
      .then(setBranches)
      .finally(() => setBranchesLoading(false));
  }, [status, isSuperAdmin]);

  const value = useMemo(
    () => ({
      scope,
      specificBranchId,
      setScope,
      setSpecificBranchId,
      branches,
      branchesLoading,
      isSuperAdmin,
      // Convenience for API calls: the params object every scoped endpoint expects.
      scopeParams: { scope, branchId: scope === 'SPECIFIC' ? specificBranchId : undefined },
    }),
    [scope, specificBranchId, branches, branchesLoading, isSuperAdmin],
  );

  return <BranchContext_.Provider value={value}>{children}</BranchContext_.Provider>;
}

export function useBranchScope() {
  const ctx = useContext(BranchContext);
  if (!ctx) throw new Error('useBranchScope must be used within a BranchProvider');
  return ctx;
}
