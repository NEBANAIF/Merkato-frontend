import React, { useEffect, useState } from 'react';
import { searchCustomerReturns } from '../../api/returns.js';
import { searchSales, getSale } from '../../api/sales.js';
import { extractErrorMessage } from '../../api/client.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import { useBranchScope } from '../../branch/BranchContext.jsx';
import DataTable from '../../components/DataTable.jsx';
import LoadingState from '../../components/LoadingState.jsx';
import ErrorState from '../../components/ErrorState.jsx';
import Pagination from '../../components/Pagination.jsx';
import Modal from '../../components/Modal.jsx';
import Badge from '../../components/Badge.jsx';
import CustomerReturnDialog from '../sales-history/CustomerReturnDialog.jsx';
import { formatMoney, formatDateTime } from '../../utils/format.js';
import SearchInput from '../../components/SearchInput.jsx';

const COLUMNS = [
  { key: 'saleNumber', header: 'Sale #', render: (r) => <span className="font-medium text-ink-900">{r.saleNumber}</span> },
  { key: 'customerName', header: 'Customer' },
  { key: 'branchName', header: 'Branch' },
  { key: 'refundAmount', header: 'Refund', render: (r) => formatMoney(r.refundAmount), className: 'text-right' },
  { key: 'status', header: 'Status', render: (r) => <Badge status={r.status} /> },
  { key: 'createdAt', header: 'Date', render: (r) => formatDateTime(r.createdAt) },
];

export default function CustomerReturnsTab() {
  const { hasPermission } = useAuth();
  const { scopeParams } = useBranchScope();
  const [page, setPage] = useState(0);
  const [data, setData] = useState(null);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [dialogSale, setDialogSale] = useState(null);

  const load = () => {
    setStatus('loading');
    searchCustomerReturns({ ...scopeParams, page })
      .then((res) => { setData(res); setStatus('ready'); })
      .catch((err) => { setError(extractErrorMessage(err)); setStatus('error'); });
  };
  useEffect(load, [page, scopeParams.scope, scopeParams.branchId]);

  return (
    <div>
      <div className="mb-3 flex justify-end">
        {hasPermission('SALES_RETURN') && (
          <button onClick={() => setPickerOpen(true)} className="btn btn-primary btn-sm">
            + New Customer Return
          </button>
        )}
      </div>

      <div className="card card-pad">
        {status === 'loading' && <LoadingState />}
        {status === 'error' && <ErrorState message={error} onRetry={load} />}
        {status === 'ready' && (
          <>
            <DataTable columns={COLUMNS} rows={data.content} emptyMessage="No customer returns yet." />
            <div className="mt-3">
              <Pagination page={data.page} totalPages={data.totalPages} totalElements={data.totalElements} onPageChange={setPage} />
            </div>
          </>
        )}
      </div>

      {pickerOpen && (
        <SalePickerModal
          onClose={() => setPickerOpen(false)}
          onPicked={(sale) => { setPickerOpen(false); setDialogSale(sale); }}
        />
      )}

      {dialogSale && (
        <CustomerReturnDialog
          sale={dialogSale}
          onClose={() => setDialogSale(null)}
          onCompleted={() => { setDialogSale(null); load(); }}
        />
      )}
    </div>
  );
}

/** Search-by-sale-number step before handing off to the existing CustomerReturnDialog, which needs the full sale (with allocations) already loaded. */
function SalePickerModal({ onClose, onPicked }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!query) { setResults([]); return; }
    const t = setTimeout(() => {
      searchSales({ search: query, size: 8 }).then((res) => setResults(res.content)).catch(() => {});
    }, 250);
    return () => clearTimeout(t);
  }, [query]);

  const pick = async (row) => {
    setLoading(true); setError('');
    try { onPicked(await getSale(row.id)); }
    catch (err) { setError(extractErrorMessage(err)); } finally { setLoading(false); }
  };

  return (
    <Modal open title="Find the sale to return" onClose={onClose}>
      <SearchInput value={query} onChange={setQuery} placeholder="Search sale number…" autoFocus className="mb-3" width="w-full" />
      {error && <p className="mb-2 text-sm text-red-600">{error}</p>}
      {loading && <p className="text-sm text-ink-400">Loading sale...</p>}
      <div className="max-h-64 space-y-1 overflow-y-auto">
        {results.map((r) => (
          <button key={r.id} onClick={() => pick(r)} className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm hover:bg-cream-50">
            <span>{r.saleNumber} <span className="text-ink-400">· {r.customerName || 'Walk-in'}</span></span>
            <span className="text-ink-400">{formatDateTime(r.createdAt)}</span>
          </button>
        ))}
        {query && results.length === 0 && !loading && <p className="px-3 py-2 text-sm text-ink-400">No matching sales.</p>}
      </div>
    </Modal>
  );
}
