import React, { useState } from 'react';
import CustomerReturnsTab from './CustomerReturnsTab.jsx';
import SupplierReturnsTab from './SupplierReturnsTab.jsx';

/** Spec section 36: one "Returns" sidebar item covering both kinds (spec sections 21 and 22). */
export default function ReturnsPage() {
  const [tab, setTab] = useState('customer');

  return (
    <div>
      <h1 className="page-title mb-4">Returns</h1>
      <div className="mb-4 flex gap-1 overflow-x-auto border-b border-cream-300">
        <TabButton active={tab === 'customer'} onClick={() => setTab('customer')}>Customer Returns</TabButton>
        <TabButton active={tab === 'supplier'} onClick={() => setTab('supplier')}>Supplier Returns</TabButton>
      </div>
      {tab === 'customer' ? <CustomerReturnsTab /> : <SupplierReturnsTab />}
    </div>
  );
}

function TabButton({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`-mb-px whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium transition ${active ? 'border-brand-600 text-sage-700' : 'border-transparent text-ink-500 hover:text-ink-700'}`}
    >
      {children}
    </button>
  );
}
