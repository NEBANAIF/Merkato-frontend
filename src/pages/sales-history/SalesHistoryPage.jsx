import React, { useEffect, useState } from 'react';
import { searchSales, getSale, voidSale } from '../../api/sales.js';
import { extractErrorMessage } from '../../api/client.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import { useBranchScope } from '../../branch/BranchContext.jsx';
import DataTable from '../../components/DataTable.jsx';
import LoadingState from '../../components/LoadingState.jsx';
import ErrorState from '../../components/ErrorState.jsx';
import Pagination from '../../components/Pagination.jsx';
import Badge from '../../components/Badge.jsx';
import Modal from '../../components/Modal.jsx';
import CustomerReturnDialog from './CustomerReturnDialog.jsx';
import { formatMoney, formatDateTime } from '../../utils/format.js';
import SearchInput from '../../components/SearchInput.jsx';

const COLUMNS = [
  { key: 'saleNumber', header: 'Sale #', render: (r) => <span className="font-medium text-ink-900">{r.saleNumber}</span> },
  { key: 'branchName', header: 'Branch' },
  { key: 'customerName', header: 'Customer', render: (r) => r.customerName || 'Walk-in' },
  { key: 'totalAmount', header: 'Total', render: (r) => formatMoney(r.totalAmount), className: 'text-right' },
  { key: 'remainingAmount', header: 'Owed', render: (r) => (r.remainingAmount > 0 ? formatMoney(r.remainingAmount) : '—'), className: 'text-right' },
  { key: 'paymentStatus', header: 'Payment', render: (r) => <Badge status={r.paymentStatus} /> },
  { key: 'status', header: 'Status', render: (r) => <Badge status={r.status} /> },
  { key: 'createdAt', header: 'Date', render: (r) => formatDateTime(r.createdAt) },
];

export default function SalesHistoryPage() {
  const { hasPermission } = useAuth();
  const { scopeParams } = useBranchScope();
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState('');
  const [data, setData] = useState(null);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');
  const [selectedSale, setSelectedSale] = useState(null);
  const [detailStatus, setDetailStatus] = useState('idle');
  const [returnDialogOpen, setReturnDialogOpen] = useState(false);
  const [voidOpen, setVoidOpen] = useState(false);

  const load = () => {
    setStatus('loading');
    searchSales({ ...scopeParams, search: search || undefined, page })
      .then((res) => { setData(res); setStatus('ready'); })
      .catch((err) => { setError(extractErrorMessage(err)); setStatus('error'); });
  };

  useEffect(load, [page, scopeParams.scope, scopeParams.branchId]);
  useEffect(() => {
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const openSale = (row) => {
    setDetailStatus('loading');
    setSelectedSale(null);
    getSale(row.id)
      .then((sale) => { setSelectedSale(sale); setDetailStatus('ready'); })
      .catch((err) => { setError(extractErrorMessage(err)); setDetailStatus('error'); });
  };

  return (
    <div>
      <h1 className="page-title mb-4">Sales History</h1>

      <div className="card card-pad">
        <SearchInput value={search} onChange={(v) => { setPage(0); setSearch(v); }} placeholder="Search by sale number…" className="mb-3" />

        {status === 'loading' && <LoadingState />}
        {status === 'error' && <ErrorState message={error} onRetry={load} />}
        {status === 'ready' && (
          <>
            <DataTable columns={COLUMNS} rows={data.content} onRowClick={openSale} emptyMessage="No sales found." />
            <div className="mt-3">
              <Pagination page={data.page} totalPages={data.totalPages} totalElements={data.totalElements} onPageChange={setPage} />
            </div>
          </>
        )}
      </div>

      <Modal open={!!selectedSale || detailStatus === 'loading'} title={selectedSale ? `Sale ${selectedSale.saleNumber}` : 'Loading...'} onClose={() => setSelectedSale(null)} wide>
        {detailStatus === 'loading' && <LoadingState />}
        {selectedSale && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
              <Info label="Branch" value={selectedSale.branchName} />
              <Info label="Customer" value={selectedSale.customerName || 'Walk-in'} />
              <Info label="Cashier" value={selectedSale.createdByName} />
              <Info label="Status" value={<Badge status={selectedSale.paymentStatus} />} />
              <Info label="Date" value={formatDateTime(selectedSale.createdAt)} />
            </div>

            {selectedSale.status === 'CANCELLED' && (
              <div className="rounded-lg border border-cream-300 bg-cream-50 px-3 py-2 text-sm text-ink-600">
                <span className="font-medium text-ink-800">Voided.</span> {selectedSale.voidReason || 'No reason recorded.'}
              </div>
            )}

            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-cream-200 text-left text-xs uppercase text-ink-400">
                  <th className="py-1.5 pr-3 font-medium">Product</th>
                  <th className="py-1.5 pr-3 text-right font-medium">Qty</th>
                  <th className="py-1.5 pr-3 text-right font-medium">Price</th>
                  <th className="py-1.5 pr-3 text-right font-medium">Line Total</th>
                  {hasPermission('VIEW_PROFIT') && <th className="py-1.5 pr-3 text-right font-medium">COGS</th>}
                </tr>
              </thead>
              <tbody>
                {selectedSale.items.map((item) => (
                  <tr key={item.productId} className="border-b border-slate-50 last:border-0">
                    <td className="py-1.5 pr-3">{item.productName}</td>
                    <td className="py-1.5 pr-3 text-right">{item.quantity}</td>
                    <td className="py-1.5 pr-3 text-right">{formatMoney(item.unitPrice)}</td>
                    <td className="py-1.5 pr-3 text-right">{formatMoney(item.lineTotal)}</td>
                    {hasPermission('VIEW_PROFIT') && <td className="py-1.5 pr-3 text-right text-ink-400">{formatMoney(item.cogs)}</td>}
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="flex flex-wrap justify-end gap-x-6 gap-y-1 border-t border-cream-200 pt-3 text-sm">
              <Totals label="Discount" value={selectedSale.discountAmount} />
              <Totals label="Total" value={selectedSale.totalAmount} strong />
              <Totals label="Paid" value={selectedSale.paidAmount} />
              <Totals label="Owed" value={selectedSale.remainingAmount} />
              {hasPermission('VIEW_PROFIT') && <Totals label="Gross Profit" value={selectedSale.grossProfit} strong />}
            </div>

            {selectedSale.status === 'COMPLETED' && (
              <div className="flex flex-wrap justify-end gap-2 border-t border-cream-200 pt-3">
                {hasPermission('SALES_VOID') && (
                  <button onClick={() => setVoidOpen(true)} className="btn btn-danger btn-sm">
                    Void Sale
                  </button>
                )}
                {hasPermission('SALES_RETURN') && (
                  <button onClick={() => setReturnDialogOpen(true)} className="btn btn-secondary btn-sm">
                    Process Return
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </Modal>

      {returnDialogOpen && selectedSale && (
        <CustomerReturnDialog
          sale={selectedSale}
          onClose={() => setReturnDialogOpen(false)}
          onCompleted={() => { setReturnDialogOpen(false); setSelectedSale(null); load(); }}
        />
      )}

      {voidOpen && selectedSale && (
        <VoidSaleDialog
          sale={selectedSale}
          onClose={() => setVoidOpen(false)}
          onVoided={() => { setVoidOpen(false); setSelectedSale(null); load(); }}
        />
      )}
    </div>
  );
}

function VoidSaleDialog({ sale, onClose, onVoided }) {
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await voidSale(sale.id, reason.trim());
      onVoided();
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open title={`Void Sale ${sale.saleNumber}`} onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <p className="text-sm text-ink-500">
          This restocks everything on this sale back to its original batches, reverses its revenue/COGS impact,
          and removes it from all reports. The sale itself stays visible here, marked Cancelled, with your reason
          attached — it isn't deleted. This can't be undone from this screen.
        </p>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-ink-500">Reason for voiding</span>
          <textarea
            required
            className="input min-h-[80px]"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Duplicate entry, wrong product rung up, cashier mistake…"
          />
        </label>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="btn btn-secondary btn-sm">Cancel</button>
          <button type="submit" disabled={saving || !reason.trim()} className="btn btn-danger btn-sm">
            {saving ? 'Voiding...' : 'Void Sale'}
          </button>
        </div>
      </form>
    </Modal>
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

function Totals({ label, value, strong }) {
  return (
    <div className={strong ? 'font-semibold text-ink-900' : 'text-ink-500'}>
      {label}: {formatMoney(value)}
    </div>
  );
}
