'use client';

import { useEffect, useState } from 'react';
import {
  createTaxRate,
  listTaxRates,
  updateTaxRate as updateTaxRateAction,
} from '@/app/actions/finance';
import { Plus } from 'lucide-react';

type TaxRate = {
  id: string;
  name: string;
  rate: number | string;
  type: string;
  status?: string;
  isDefault?: boolean;
  effectiveFrom?: string | null;
  effectiveTo?: string | null;
  description?: string | null;
};

export default function TaxRatesPage() {
  const [taxRates, setTaxRates] = useState<TaxRate[]>([]);
  const [loading, setLoading] = useState(true);
  const [openForm, setOpenForm] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    name: '',
    rate: '',
    type: 'vat',
    isDefault: false,
    isActive: true,
    effectiveFrom: '',
    effectiveTo: '',
    description: '',
  });

  async function loadData() {
    setLoading(true);
    try {
      const rows = await listTaxRates();
      setTaxRates(rows);
    } catch {
      setTaxRates([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      await createTaxRate(form);
      setOpenForm(false);
      setForm({
        name: '',
        rate: '',
        type: 'vat',
        isDefault: false,
        isActive: true,
        effectiveFrom: '',
        effectiveTo: '',
        description: '',
      });
      await loadData();
    } catch (cause: any) {
      setError(cause.message || 'Failed to create tax rate');
    } finally {
      setLoading(false);
    }
  }

  async function toggleTaxRate(id: string, updates: { status?: string; isDefault?: boolean }) {
    setLoading(true);
    setError('');
    try {
      await updateTaxRateAction({ id, ...updates });
      await loadData();
    } catch (cause: any) {
      setError(cause.message || 'Could not update tax rate');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-jt-text">Tax Rates</h1>
          <p className="text-jt-muted text-sm">
            Manage tax rates for your business
          </p>
        </div>
        <button className="primary-button" onClick={() => setOpenForm(true)}>
          <Plus size={14} /> Add Tax Rate
        </button>
      </div>

      {openForm && (
        <section className="border border-jt-border rounded-[var(--jt-radius)] bg-jt-surface shadow-sm">
          <div className="p-6 border-b border-jt-border/50">
            <h3 className="text-lg font-semibold text-jt-text">Create Tax Rate</h3>
          </div>
          <div className="p-6">
            <form onSubmit={handleSubmit} className="space-y-5">
              {error && (
                <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
                  {error}
                </div>
              )}
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label htmlFor="name" className="block text-xs font-semibold text-jt-muted uppercase tracking-wider mb-1.5">
                    Name
                  </label>
                  <input
                    id="name"
                    name="name"
                    type="text"
                    className="w-full border border-jt-border rounded-lg px-3 py-2.5 bg-jt-surface text-sm focus:border-jt-teal focus:ring-1 focus:ring-jt-teal"
                    defaultValue={form.name}
                    required
                    minLength={2}
                    maxLength={160}
                  />
                </div>
                <div>
                  <label htmlFor="rate" className="block text-xs font-semibold text-jt-muted uppercase tracking-wider mb-1.5">
                    Rate (%)
                  </label>
                  <input
                    id="rate"
                    name="rate"
                    type="number"
                    className="w-full border border-jt-border rounded-lg px-3 py-2.5 bg-jt-surface text-sm focus:border-jt-teal focus:ring-1 focus:ring-jt-teal"
                    defaultValue={form.rate}
                    required
                  />
                </div>
                <div>
                  <label htmlFor="type" className="block text-xs font-semibold text-jt-muted uppercase tracking-wider mb-1.5">
                    Type
                  </label>
                  <select
                    id="type"
                    name="type"
                    className="w-full border border-jt-border rounded-lg px-3 py-2.5 bg-jt-surface text-sm focus:border-jt-teal focus:ring-1 focus:ring-jt-teal"
                    defaultValue={form.type}
                    required
                  >
                    <option value="vat">VAT</option>
                    <option value="withholding">Withholding</option>
                    <option value="excise">Excise</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label htmlFor="description" className="block text-xs font-semibold text-jt-muted uppercase tracking-wider mb-1.5">
                    Description
                  </label>
                  <textarea
                    id="description"
                    name="description"
                    className="w-full border border-jt-border rounded-lg px-3 py-2.5 bg-jt-surface text-sm focus:border-jt-teal focus:ring-1 focus:ring-jt-teal"
                    defaultValue={form.description}
                    rows={3}
                    placeholder="Optional description of this tax rate..."
                  />
                </div>
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  className="button-secondary flex-1"
                  onClick={() => setOpenForm(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="primary-button flex-1" disabled={loading}>
                  {loading ? 'Creating...' : 'Create Tax Rate'}
                </button>
              </div>
            </form>
          </div>
        </section>
      )}

      {loading && taxRates.length === 0 ? (
        <section className="border border-jt-border rounded-[var(--jt-radius)] bg-jt-surface shadow-sm">
          <div className="p-8 flex items-center justify-center">
            <p className="text-sm text-jt-muted">Loading tax rates…</p>
          </div>
        </section>
      ) : taxRates.length === 0 ? (
        <section className="border border-jt-border rounded-[var(--jt-radius)] bg-jt-surface shadow-sm">
          <div className="p-8 flex flex-col items-center justify-center text-center">
            <p className="text-sm text-jt-muted mb-4">No tax rates configured yet.</p>
            <button className="primary-button mt-4" onClick={() => setOpenForm(true)}>
              <Plus size={14} /> Add Tax Rate
            </button>
          </div>
        </section>
      ) : (
        <section className="border border-jt-border rounded-[var(--jt-radius)] bg-jt-surface shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-jt-border/50 bg-jt-surface/50 sticky top-0 z-10">
                  <th className="px-4 py-3 text-xs font-semibold text-jt-muted uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold text-jt-muted uppercase tracking-wider">
                    Rate
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold text-jt-muted uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold text-jt-muted uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold text-jt-muted uppercase tracking-wider">
                    Effective From
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold text-jt-muted uppercase tracking-wider">
                    Effective To
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold text-jt-muted uppercase tracking-wider text-right">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-jt-border/50">
                {taxRates.map((tr: TaxRate) => (
                  <tr key={tr.id} className="hover:bg-jt-surface/50 transition-colors group">
                    <td className="px-4 py-3 text-sm text-jt-text truncate block">{tr.name}</td>
                    <td className="px-4 py-3 text-sm text-jt-text">{tr.rate}%</td>
                    <td className="px-4 py-3 text-sm text-jt-text">{tr.type}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-semibold border inline-block ${
                          tr.status === 'active'
                            ? 'bg-green-100 text-green-700 border-green-200'
                            : 'bg-slate-100 text-slate-700 border-slate-200'
                        }`}
                      >
                        {tr.status || 'active'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-jt-muted">
                      {tr.effectiveFrom || '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-jt-muted">
                      {tr.effectiveTo || '-'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => toggleTaxRate(tr.id, { status: tr.status === 'active' ? 'inactive' : 'active' })}
                          className="row-action text-jt-primary hover:bg-jt-surface/50"
                          title={tr.status === 'active' ? 'Deactivate' : 'Activate'}
                        >
                          {tr.status === 'active' ? 'Deactivate' : 'Activate'}
                        </button>
                        <button
                          onClick={() => toggleTaxRate(tr.id, { isDefault: !tr.isDefault })}
                          className="row-action text-jt-primary hover:bg-jt-surface/50"
                          title={tr.isDefault ? 'Revoke Default' : 'Set Default'}
                        >
                          {tr.isDefault ? 'Revoke Default' : 'Set Default'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
