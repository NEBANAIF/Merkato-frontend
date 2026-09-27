import React, { useEffect, useState } from 'react';
import { useAuth } from '../../auth/AuthContext.jsx';
import { getSettings, updateSettings } from '../../api/settings.js';
import { extractErrorMessage } from '../../api/client.js';
import LoadingState from '../../components/LoadingState.jsx';

export default function SettingsPage() {
  const { user } = useAuth();

  const [settings, setSettings] = useState(null);
  const [status, setStatus] = useState('loading');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    getSettings()
      .then((res) => { setSettings(res); setStatus('ready'); })
      .catch((err) => { setError(extractErrorMessage(err)); setStatus('error'); });
  }, []);

  const toggleSetting = async (key, checked) => {
    const previous = settings;
    setSettings({ ...settings, [key]: checked }); // optimistic
    setSaving(true);
    setError('');
    try {
      const saved = await updateSettings({ ...settings, [key]: checked });
      setSettings(saved);
    } catch (err) {
      setSettings(previous); // roll back
      setError(extractErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <h1 className="page-title mb-1">Settings</h1>
      <p className="mb-6 text-sm text-ink-500">Account and system information.</p>

      <div className="max-w-lg space-y-4">
        <div className="card card-pad">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink-400">Your Account</p>
          <dl className="space-y-2 text-sm">
            <Row label="Name" value={user?.name} />
            <Row label="Email" value={user?.email} />
            <Row label="Role" value={user?.roleName || user?.role?.replaceAll('_', ' ')} />
            <Row label="Branch" value={user?.branchName || 'All branches'} />
          </dl>
        </div>

        <div className="card card-pad">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-400">Inventory</p>

          {status === 'loading' && <LoadingState label="Loading settings..." />}
          {status === 'error' && <p className="text-sm text-red-600">{error}</p>}
          {status === 'ready' && (
            <>
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={settings.lockCostPrice}
                  disabled={saving}
                  onChange={(e) => toggleSetting('lockCostPrice', e.target.checked)}
                />
                <span>
                  <span className="font-medium text-ink-900">Lock cost price</span>
                  <p className="text-ink-500">
                    When on, the cost-price field on the New Product form is disabled, so whoever is adding
                    products can still record an opening quantity without needing to know the cost. The
                    stock is recorded at cost 0 until someone with stock-adjust access corrects it later.
                  </p>
                </span>
              </label>

              <label className="mt-3 flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={settings.hideOutOfStockAtPos}
                  disabled={saving}
                  onChange={(e) => toggleSetting('hideOutOfStockAtPos', e.target.checked)}
                />
                <span>
                  <span className="font-medium text-ink-900">Hide out-of-stock products at POS</span>
                  <p className="text-ink-500">
                    When on, a product with zero stock at the branch making the sale won&apos;t show up when
                    searching for it in POS, so a cashier can&apos;t ring up something that isn&apos;t there.
                    Purchases, Batches and Transfers still show it — you need to find it there to restock it.
                  </p>
                </span>
              </label>
              {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-ink-400">{label}</dt>
      <dd className="text-ink-700">{value || '—'}</dd>
    </div>
  );
}
