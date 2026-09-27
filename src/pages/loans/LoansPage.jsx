import React, { useEffect, useState } from 'react';
import { searchLoans, getLoan, recordLoanPayment } from '../../api/loans.js';
import { extractErrorMessage } from '../../api/client.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import { useBranchScope } from '../../branch/BranchContext.jsx';
import DataTable from '../../components/DataTable.jsx';
import LoadingState from '../../components/LoadingState.jsx';
import ErrorState from '../../components/ErrorState.jsx';
import Pagination from '../../components/Pagination.jsx';
import Badge from '../../components/Badge.jsx';
import Modal from '../../components/Modal.jsx';
import BankSelect from '../../components/BankSelect.jsx';
import { formatMoney, formatDate } from '../../utils/format.js';
import ElegantSelect from '../../components/ElegantSelect.jsx';

const STATUS_FILTERS = ['', 'OPEN', 'PARTIALLY_PAID', 'PAID', 'OVERDUE'];
const PAYMENT_METHODS = ['CASH', 'BANK'];

const COLUMNS = [
  { key: 'customerName', header: 'Customer', render: (r) => <span className="font-medium text-ink-900">{r.customerName}</span> },
  { key: 'saleNumber', header: 'Sale #' },
  { key: 'branchName', header: 'Branch' },
  { key: 'originalAmount', header: 'Original', render: (r) => formatMoney(r.originalAmount), className: 'text-right' },
  { key: 'remainingAmount', header: 'Owed', render: (r) => formatMoney(r.remainingAmount), className: 'text-right' },
  { key: 'dueDate', header: 'Due', render: (r) => formatDate(r.dueDate) },
  { key: 'status', header: 'Status', render: (r) => <Badge status={r.status} /> },
];

/**
 * status filter includes OVERDUE even though it's never a persisted value
 * server-side (see LoanStatus) - the backend translates it into a
 * due-date condition itself (LoanService.search), so this just passes it
 * straight through.
 */
export default function LoansPage() {
  const { hasPermission } = useAuth();
  const { scopeParams } = useBranchScope();
  const [page, setPage] = useState(0);
  const [statusFilter, setStatusFilter] = useState('');
  const [data, setData] = useState(null);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(null);
  const [detailStatus, setDetailStatus] = useState('idle');
  const [payOpen, setPayOpen] = useState(false);

  const load = () => {
    setStatus('loading');
    searchLoans({ ...scopeParams, status: statusFilter || undefined, page })
      .then((res) => { setData(res); setStatus('ready'); })
      .catch((err) => { setError(extractErrorMessage(err)); setStatus('error'); });
  };

  useEffect(load, [page, statusFilter, scopeParams.scope, scopeParams.branchId]);

  const openLoan = (row) => {
    setDetailStatus('loading');
    getLoan(row.id)
      .then((l) => { setSelected(l); setDetailStatus('ready'); })
      .catch((err) => { setError(extractErrorMessage(err)); setDetailStatus('error'); });
  };

  return (
    <div>
      <h1 className="page-title mb-4">Loans</h1>

      <div className="card card-pad">
        <select value={statusFilter} onChange={(e) => { setPage(0); setStatusFilter(e.target.value); }} className="input mb-3 w-full max-w-xs">
          {STATUS_FILTERS.map((s) => <option key={s} value={s}>{s || 'All statuses'}</option>)}
        </select>

        {status === 'loading' && <LoadingState />}
        {status === 'error' && <ErrorState message={error} onRetry={load} />}
        {status === 'ready' && (
          <>
            <DataTable columns={COLUMNS} rows={data.content} onRowClick={openLoan} emptyMessage="No loans found." />
            <div className="mt-3">
              <Pagination page={data.page} totalPages={data.totalPages} totalElements={data.totalElements} onPageChange={setPage} />
            </div>
          </>
        )}
      </div>

      <Modal open={!!selected || detailStatus === 'loading'} title={selected ? `${selected.customerName} - ${selected.saleNumber}` : 'Loading...'} onClose={() => setSelected(null)}>
        {detailStatus === 'loading' && <LoadingState />}
        {selected && (
          <div className="space-y-4 text-sm">
            <Row label="Branch" value={selected.branchName} />
            <Row label="Original Amount" value={formatMoney(selected.originalAmount)} />
            <Row label="Paid" value={formatMoney(selected.paidAmount)} />
            <Row label="Remaining" value={formatMoney(selected.remainingAmount)} strong />
            <Row label="Due Date" value={formatDate(selected.dueDate)} />
            <Row label="Status" value={<Badge status={selected.status} />} />

            <div className="border-t border-cream-200 pt-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-400">Payment History</p>
              {selected.payments.length === 0 ? (
                <p className="text-ink-400">No payments recorded yet.</p>
              ) : (
                <div className="space-y-1.5">
                  {selected.payments.map((p) => (
                    <div key={p.id} className="flex items-center justify-between">
                      <span className="text-ink-500">{formatDate(p.createdAt)} · {p.method}</span>
                      <span className="font-medium text-slate-800">{formatMoney(p.amount)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {hasPermission('SALES_CREATE') && selected.status !== 'PAID' && (
              <div className="flex justify-end border-t border-cream-200 pt-3">
                <button onClick={() => setPayOpen(true)} className="btn btn-primary btn-sm">
                  Record Payment
                </button>
              </div>
            )}
          </div>
        )}
      </Modal>

      {payOpen && selected && (
        <RecordPaymentModal
          loan={selected}
          onClose={() => setPayOpen(false)}
          onPaid={(updated) => { setPayOpen(false); setSelected(updated); load(); }}
        />
      )}
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

function RecordPaymentModal({ loan, onClose, onPaid }) {
  const [method, setMethod] = useState('CASH');
  const [amount, setAmount] = useState(loan.remainingAmount);
  const [bankId, setBankId] = useState('');
  const [accountReference, setAccountReference] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const updated = await recordLoanPayment(loan.id, {
        method, amount: Number(amount),
        bankId: method === 'BANK' ? bankId : undefined,
        accountReference: accountReference || undefined,
      });
      onPaid(updated);
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open title="Record Loan Payment" onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <p className="text-sm text-ink-500">Remaining balance: <strong>{formatMoney(loan.remainingAmount)}</strong></p>
        <label className="block"><span className="mb-1 block text-xs font-medium text-ink-500">Amount</span>
          <input required type="number" min="0.01" max={loan.remainingAmount} step="0.01" className="input" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </label>
        <label className="block"><span className="mb-1 block text-xs font-medium text-ink-500">Method</span>
          <select className="input" value={method} onChange={(e) => setMethod(e.target.value)}>
            {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </label>
        {method === 'BANK' && (
          <div className="block"><span className="mb-1 block text-xs font-medium text-ink-500">Bank</span>
            <BankSelect required value={bankId} onChange={setBankId} />
          </div>
        )}
        <label className="block"><span className="mb-1 block text-xs font-medium text-ink-500">Reference (optional)</span>
          <input className="input" value={accountReference} onChange={(e) => setAccountReference(e.target.value)} />
        </label>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="btn btn-secondary btn-sm">Cancel</button>
          <button type="submit" disabled={saving} className="btn btn-primary btn-sm">
            {saving ? 'Saving...' : 'Record Payment'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
