// The single list of pages and what each one needs. Used by the router (App.jsx) to
// guard a route AND by the sidebar to hide links the user cannot open, so the two can
// never disagree. `permissions` is OR: holding any one of them opens the page. Which
// role holds which permission is set on the Roles & Permissions page. `icon` names an
// entry in components/Icon.jsx and is used by the sidebar only.
export const NAV_SECTIONS = [
  {
    label: 'Main',
    items: [
      { label: 'Dashboard', to: '/dashboard', icon: 'dashboard', permissions: ['DASHBOARD_VIEW'] },
      { label: 'Branches', to: '/branches', icon: 'branches', permissions: ['BRANCH_MANAGE'] },
      { label: 'Branch Products', to: '/branch-products', icon: 'check', permissions: ['BRANCH_MANAGE'] },
      { label: 'Notifications', to: '/notifications', icon: 'bell', permissions: ['ACTIVITY_VIEW'] },
    ],
  },
  {
    label: 'Sales',
    items: [
      { label: 'POS', to: '/pos', icon: 'pos', permissions: ['POS_ACCESS'] },
      { label: 'Sales History', to: '/sales-history', icon: 'sales', permissions: ['SALES_VIEW'] },
      { label: 'Customers', to: '/customers', icon: 'customers', permissions: ['SALES_VIEW', 'POS_ACCESS'] },
      { label: 'Loans', to: '/loans', icon: 'loans', permissions: ['SALES_VIEW', 'FINANCE_VIEW'] },
      { label: 'Returns', to: '/returns', icon: 'returns', permissions: ['SALES_RETURN', 'SALES_VIEW', 'SUPPLIER_MANAGE'] },
    ],
  },
  {
    label: 'Inventory',
    items: [
      { label: 'Inventory', to: '/inventory', icon: 'inventory', permissions: ['INVENTORY_VIEW'] },
      { label: 'Batches', to: '/batches', icon: 'batches', permissions: ['INVENTORY_VIEW'] },
      { label: 'Transfers', to: '/transfers', icon: 'transfers', permissions: ['TRANSFER_CREATE', 'TRANSFER_APPROVE', 'TRANSFER_RECEIVE'] },
      { label: 'Stock History', to: '/stock-history', icon: 'history', permissions: ['INVENTORY_VIEW'] },
    ],
  },
  {
    label: 'Purchasing',
    items: [
      { label: 'Suppliers', to: '/suppliers', icon: 'suppliers', permissions: ['SUPPLIER_MANAGE', 'PURCHASE_CREATE'] },
      // One entry: the page combines creating orders with the full order list (history).
      { label: 'Purchases', to: '/purchases', icon: 'purchases', permissions: ['PURCHASE_CREATE', 'PURCHASE_RECEIVE'] },
    ],
  },
  {
    label: 'Finance',
    items: [
      { label: 'Finance', to: '/finance', icon: 'finance', permissions: ['FINANCE_VIEW'] },
      { label: 'Expenses', to: '/expenses', icon: 'expenses', permissions: ['EXPENSE_CREATE', 'FINANCE_VIEW'] },
      { label: 'Payments', to: '/payments', icon: 'payments', permissions: ['PAYMENT_VIEW'] },
    ],
  },
  {
    label: 'Reports',
    items: [
      // One entry: the page covers products, growth and branch comparison.
      { label: 'Reports', to: '/reports', icon: 'reports', permissions: ['REPORT_VIEW'] },
    ],
  },
  {
    label: 'Administration',
    items: [
      { label: 'Users', to: '/users', icon: 'users', permissions: ['USER_MANAGE'] },
      { label: 'Roles & Permissions', to: '/roles', icon: 'roles', permissions: ['USER_MANAGE'] },
      { label: 'Settings', to: '/settings', icon: 'settings', permissions: ['SETTINGS_MANAGE'] },
    ],
  },
];

/** path -> permissions needed, derived from the list above. */
export const ROUTE_PERMISSIONS = Object.fromEntries(
  NAV_SECTIONS.flatMap((section) => section.items.map((item) => [item.to, item.permissions])),
);

function canOpen(item, hasPermission) {
  return item.permissions.length === 0 || item.permissions.some((p) => hasPermission(p));
}

/** The sections and links this user may see; a section with no links left is dropped. */
export function visibleSections(hasPermission) {
  return NAV_SECTIONS
    .map((section) => ({ ...section, items: section.items.filter((item) => canOpen(item, hasPermission)) }))
    .filter((section) => section.items.length > 0);
}

/** Where to send someone who has just logged in: the first page they can open, or null if none. */
export function firstAllowedPath(hasPermission) {
  for (const section of NAV_SECTIONS) {
    for (const item of section.items) {
      if (canOpen(item, hasPermission)) return item.to;
    }
  }
  return null;
}
