import React, { useEffect, useState } from 'react';
import { searchExpenses, createExpense } from '../../api/expenses.js';
import { extractErrorMessage } from '../../api/client.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import { useBranchScope } from '../../branch/BranchContext.jsx';
import DataTable from '../../components/DataTable.jsx';
import LoadingState from '../../components/LoadingState.jsx';
import ErrorState from '../../components/ErrorState.jsx';
import Pagination from '../../components/Pagination.jsx';
import Modal from '../../components/Modal.jsx';
import { formatMoney, formatDate } from '../../utils/format.js';

const CATEGORIES = ['RENT', 'ELECTRICITY', 'SALARIES', 'TRANSPORT', 'INTERNET', 'MAINTENANCE', 'OTHER'];
const PAYMENT_METHODS = ['CASH', 'BANK', 'CREDIT'];

const COLUMNS = [
  { key: 'expenseDate', header: 'Date', render: (r) => formatDate(r.expenseDate) },
  { key: 'category', header: 'Category' },
  { key: 'description', header: 'Description' },
  { key: 'branchName', header: 'Branch' },
  { key: 'amount', header: 'Amount', render: (r) => formatMoney(r.amount), className: 'text-right' },
  { key: 'createdByName', header: 'Logged By' },
];

/**
 * EXPENSE_CREATE is held by every branch role, but listing/browsing
 * requires FINANCE_VIEW (managers only) - see ExpenseController's
 * javadoc. A STORE_STAFF sees only the "log an expense" form; a manager
 * sees the full list plus the same form.
 */
export default function ExpensesPage() {
  const { hasPermission } = useAuth();
  const { scopeParams } = useBranchScope();
  const canView = hasPermission('FINANCE_VIEW');
  const canCreate = hasPermission('EXPENSE_CREATE');

  const [page, setPage] = useState(0);
  const [data, setData] = useState(null);
  const [status, setStatus] = useState(canView ? 'loading' : 'idle');
  const [error, setError] = useState('');
  const [createOpen, setCreateOpen] = useState(false);

  const load = () => {
    if (!canView) return;
    setStatus('loading');
    searchExpenses({ ...scopeParams, page })
      .then((res) => { setData(res); setStatus('ready'); })
      .catch((err) => { setError(extractErrorMessage(err)); setStatus('error'); });
  };

  useEffect(load, [page, scopeParams.scope, scopeParams.branchId]);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="page-title">Expenses</h1>
        {canCreate && (
          <button onClick={() => setCreateOpen(true)} className="btn btn-primary btn-sm">
            + Log Expense
          </button>
        )}
      </div>

      {canView ? (
        <div className="card card-pad">
          {status === 'loading' && <LoadingState />}
          {status === 'error' && <ErrorState message={error} onRetry={load} />}
          {status === 'ready' && (
            <>
              <DataTable columns={COLUMNS} rows={data.content} emptyMessage="No expenses recorded yet." />
              <div className="mt-3">
                <Pagination page={data.page} totalPages={data.totalPages} totalElements={data.totalElements} onPageChange={setPage} />
              </div>
            </>
          )}
        </div>
      ) : (
        <div className="card p-6 text-sm text-ink-500">
          You can log expenses, but viewing the expense list requires manager access.
        </div>
      )}

      <CreateExpenseModal open={createOpen} onClose={() => setCreateOpen(false)} onCreated={() => { setCreateOpen(false); load(); }} />
    </div>
  );
}

function CreateExpenseModal({ open, onClose, onCreated }) {
  const { scopeParams } = useBranchScope();
  const [form, setForm] = useState(blank());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { if (open) { setForm(blank()); setError(''); } }, [open]);

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await createExpense({
        branchId: form.branchId || scopeParams.branchId,
        category: form.category,
        amount: Number(form.amount),
        description: form.description,
        expenseDate: form.expenseDate,
        paymentMethod: form.paymentMethod,
        reference: form.reference || undefined,
      });
      onCreated();
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} title="Log Expense" onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <label className="block"><span className="mb-1 block text-xs font-medium text-ink-500">Category</span>
            <select required className="input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
              <option value="">Select...</option>
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
          <label className="block"><span className="mb-1 block text-xs font-medium text-ink-500">Amount</span>
            <input required type="number" min="0.01" step="0.01" className="input" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
          </label>
        </div>
        <label className="block"><span className="mb-1 block text-xs font-medium text-ink-500">Description</span>
          <input required className="input" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block"><span className="mb-1 block text-xs font-medium text-ink-500">Date</span>
            <input required type="date" className="input" value={form.expenseDate} onChange={(e) => setForm({ ...form, expenseDate: e.target.value })} />
          </label>
          <label className="block"><span className="mb-1 block text-xs font-medium text-ink-500">Payment Method</span>
            <select required className="input" value={form.paymentMethod} onChange={(e) => setForm({ ...form, paymentMethod: e.target.value })}>
              {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </label>
        </div>
        <label className="block"><span className="mb-1 block text-xs font-medium text-ink-500">Reference (optional)</span>
          <input className="input" value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} />
        </label>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="btn btn-secondary btn-sm">Cancel</button>
          <button type="submit" disabled={saving} className="btn btn-primary btn-sm">
            {saving ? 'Saving...' : 'Log Expense'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function blank() {
  return { branchId: '', category: '', amount: '', description: '', expenseDate: new Date().toISOString().slice(0, 10), paymentMethod: 'CASH', reference: '' };
}
