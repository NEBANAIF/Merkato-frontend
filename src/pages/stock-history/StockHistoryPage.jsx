import React, { useEffect, useState } from 'react';
import { searchStockHistory } from '../../api/stockHistory.js';
import { extractErrorMessage } from '../../api/client.js';
import { useBranchScope } from '../../branch/BranchContext.jsx';
import DataTable from '../../components/DataTable.jsx';
import LoadingState from '../../components/LoadingState.jsx';
import ErrorState from '../../components/ErrorState.jsx';
import Pagination from '../../components/Pagination.jsx';
import { formatDate, formatTime } from '../../utils/format.js';
import ElegantSelect from '../../components/ElegantSelect.jsx';

/** Spec section 20: additions green, deductions red - the full inventory ledger. */
const COLUMNS = [
  { key: 'occurredAt', header: 'Date', render: (r) => (
      <div>
        <p>{formatDate(r.occurredAt)}</p>
        <p className="text-xs text-ink-400">{formatTime(r.occurredAt)}</p>
      </div>
    ) },
  { key: 'productName', header: 'Product', render: (r) => (
      <div><p className="font-medium text-ink-900">{r.productName}</p><p className="text-xs text-ink-400">{r.branchName}{r.batchNumber ? ` · ${r.batchNumber}` : ''}</p></div>
    ) },
  { key: 'movementType', header: 'Movement', render: (r) => <span className="text-xs font-medium uppercase text-ink-500">{r.movementType.replace(/_/g, ' ')}</span> },
  { key: 'quantityChange', header: 'Change', className: 'text-right', render: (r) => (
      <span className={`font-semibold tabular-nums ${r.quantityChange >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
        {r.quantityChange >= 0 ? '+' : ''}{r.quantityChange}
      </span>
    ) },
  { key: 'newQuantity', header: 'Before → After', render: (r) => (
      <span className="tabular-nums text-ink-500">{r.previousQuantity} → {r.newQuantity}</span>
    ) },
  { key: 'reason', header: 'Reason', render: (r) => <span className="text-ink-500">{r.reason || '—'}</span> },
  { key: 'userName', header: 'User' },
];

const MOVEMENT_TYPES = ['PURCHASE', 'SALE', 'TRANSFER_OUT', 'TRANSFER_IN', 'CUSTOMER_RETURN', 'SUPPLIER_RETURN', 'ADJUSTMENT', 'DAMAGED', 'LOST', 'SALE_VOID', 'BATCH_ADDED'];

export default function StockHistoryPage() {
  const { scopeParams } = useBranchScope();
  const [page, setPage] = useState(0);
  const [movementType, setMovementType] = useState('');
  const [data, setData] = useState(null);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');

  const load = () => {
    setStatus('loading');
    searchStockHistory({ ...scopeParams, movementType: movementType || undefined, page })
      .then((res) => { setData(res); setStatus('ready'); })
      .catch((err) => { setError(extractErrorMessage(err)); setStatus('error'); });
  };

  useEffect(load, [page, movementType, scopeParams.scope, scopeParams.branchId]);

  return (
    <div>
      <h1 className="page-title mb-4">Stock History</h1>

      <div className="card card-pad">
        <ElegantSelect
          value={movementType}
          onChange={(val) => { setPage(0); setMovementType(val); }}
          ariaLabel="Filter by movement type"
          className="mb-3"
          width="w-full max-w-xs"
        >
          <option value="">All movement types</option>
          {MOVEMENT_TYPES.map((t) => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
        </ElegantSelect>

        {status === 'loading' && <LoadingState />}
        {status === 'error' && <ErrorState message={error} onRetry={load} />}
        {status === 'ready' && (
          <>
            <DataTable columns={COLUMNS} rows={data.content} emptyMessage="No stock movements found." />
            <div className="mt-3">
              <Pagination page={data.page} totalPages={data.totalPages} totalElements={data.totalElements} onPageChange={setPage} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
