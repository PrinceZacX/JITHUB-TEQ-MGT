'use client';

import { useEffect, useState } from 'react';
import {
  createSupplier,
  listBusinesses,
  listSuppliers,
  updateBusiness,
  updateSupplier,
  suspendSupplier,
  reactivateSupplier,
} from '@/app/actions/finance';
import { Plus, PlusCircle, Edit, X } from 'lucide-react';

export default function SuppliersPage() {
  const [businesses, setBusinesses] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [openForm, setOpenForm] = useState(false);
  const [form, setForm] = useState({
    name: '',
    legalName: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    country: 'Uganda',
    category: '',
    creditLimit: '',
    creditTermsDays: '',
  });

  async function loadData() {
    setLoading(true);
    try {
      const [bizs, sups] = await Promise.all([listBusinesses(), listSuppliers()]);
      setBusinesses(bizs);
      setSuppliers(sups);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await createSupplier(form);
      setOpenForm(false);
      setForm({
        name: '',
        legalName: '',
        email: '',
        phone: '',
        address: '',
        city: '',
        country: 'Uganda',
        category: '',
        creditLimit: '',
        creditTermsDays: '',
      });
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to create supplier');
    } finally {
      setLoading(false);
    }
  }

  async function toggleStatus(id: string, currentStatus: string) {
    try {
      if (currentStatus === 'active') {
        await suspendSupplier({ id });
      } else {
        await reactivateSupplier({ id });
      }
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to update supplier');
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-jt-text">Supplier Management</h1>
          <p className="text-jt-muted text-sm">Manage your suppliers and purchase terms</p>
        </div>
        <button className="primary-button" onClick={() => setOpenForm(true)}>
          <Plus size={14} /> Add Supplier
        </button>
      </div>

      {openForm && (
        <section className="border border-jt-border rounded-[var(--jt-radius)] bg-jt-surface shadow-sm">
          <div className="p-6 border-b border-jt-border/50">
            <h3 className="text-lg font-semibold text-jt-text">Add Supplier</h3>
          </div>
          <div className="p-6">
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <div>
                  <label
                    htmlFor="name"
                    className="block text-xs font-semibold text-jt-muted uppercase tracking-wider mb-1.5"
                  >
                    Business Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="name"
                    name="name"
                    className="w-full border border-jt-border rounded-lg px-3 py-2.5 bg-jt-surface text-sm focus:border-jt-teal focus:ring-1 focus:ring-jt-teal"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label
                    htmlFor="legalName"
                    className="block text-xs font-semibold text-jt-muted uppercase tracking-wider mb-1.5"
                  >
                    Legal Name
                  </label>
                  <input
                    id="legalName"
                    name="legalName"
                    className="w-full border border-jt-border rounded-lg px-3 py-2.5 bg-jt-surface text-sm focus:border-jt-teal focus:ring-1 focus:ring-jt-teal"
                    value={form.legalName}
                    onChange={(e) => setForm({ ...form, legalName: e.target.value })}
                  />
                </div>
                <div>
                  <label
                    htmlFor="email"
                    className="block text-xs font-semibold text-jt-muted uppercase tracking-wider mb-1.5"
                  >
                    Email
                  </label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    className="w-full border border-jt-border rounded-lg px-3 py-2.5 bg-jt-surface text-sm focus:border-jt-teal focus:ring-1 focus:ring-jt-teal"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                  />
                </div>
                <div>
                  <label
                    htmlFor="phone"
                    className="block text-xs font-semibold text-jt-muted uppercase tracking-wider mb-1.5"
                  >
                    Phone
                  </label>
                  <input
                    id="phone"
                    name="phone"
                    className="w-full border border-jt-border rounded-lg px-3 py-2.5 bg-jt-surface text-sm focus:border-jt-teal focus:ring-1 focus:ring-jt-teal"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  />
                </div>
                <div>
                  <label
                    htmlFor="address"
                    className="block text-xs font-semibold text-jt-muted uppercase tracking-wider mb-1.5"
                  >
                    Address
                  </label>
                  <input
                    id="address"
                    name="address"
                    className="w-full border border-jt-border rounded-lg px-3 py-2.5 bg-jt-surface text-sm focus:border-jt-teal focus:ring-1 focus:ring-jt-teal"
                    value={form.address}
                    onChange={(e) => setForm({ ...form, address: e.target.value })}
                  />
                </div>
                <div>
                  <label
                    htmlFor="city"
                    className="block text-xs font-semibold text-jt-muted uppercase tracking-wider mb-1.5"
                  >
                    City
                  </label>
                  <input
                    id="city"
                    name="city"
                    className="w-full border border-jt-border rounded-lg px-3 py-2.5 bg-jt-surface text-sm focus:border-jt-teal focus:ring-1 focus:ring-jt-teal"
                    value={form.city}
                    onChange={(e) => setForm({ ...form, city: e.target.value })}
                  />
                </div>
                <div>
                  <label
                    htmlFor="country"
                    className="block text-xs font-semibold text-jt-muted uppercase tracking-wider mb-1.5"
                  >
                    Country
                  </label>
                  <input
                    id="country"
                    name="country"
                    className="w-full border border-jt-border rounded-lg px-3 py-2.5 bg-jt-surface text-sm focus:border-jt-teal focus:ring-1 focus:ring-jt-teal"
                    value={form.country}
                    onChange={(e) => setForm({ ...form, country: e.target.value })}
                  />
                </div>
                <div>
                  <label
                    htmlFor="category"
                    className="block text-xs font-semibold text-jt-muted uppercase tracking-wider mb-1.5"
                  >
                    Category
                  </label>
                  <input
                    id="category"
                    name="category"
                    className="w-full border border-jt-border rounded-lg px-3 py-2.5 bg-jt-surface text-sm focus:border-jt-teal focus:ring-1 focus:ring-jt-teal"
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                  />
                </div>
                <div>
                  <label
                    htmlFor="creditLimit"
                    className="block text-xs font-semibold text-jt-muted uppercase tracking-wider mb-1.5"
                  >
                    Credit Limit
                  </label>
                  <input
                    id="creditLimit"
                    name="creditLimit"
                    type="number"
                    className="w-full border border-jt-border rounded-lg px-3 py-2.5 bg-jt-surface text-sm focus:border-jt-teal focus:ring-1 focus:ring-jt-teal"
                    value={form.creditLimit}
                    onChange={(e) => setForm({ ...form, creditLimit: e.target.value })}
                  />
                </div>
                <div>
                  <label
                    htmlFor="creditTermsDays"
                    className="block text-xs font-semibold text-jt-muted uppercase tracking-wider mb-1.5"
                  >
                    Credit Terms (days)
                  </label>
                  <input
                    id="creditTermsDays"
                    name="creditTermsDays"
                    type="number"
                    className="w-full border border-jt-border rounded-lg px-3 py-2.5 bg-jt-surface text-sm focus:border-jt-teal focus:ring-1 focus:ring-jt-teal"
                    value={form.creditTermsDays}
                    onChange={(e) => setForm({ ...form, creditTermsDays: e.target.value })}
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
                  {loading ? 'Creating...' : 'Create Supplier'}
                </button>
              </div>
            </form>
          </div>
        </section>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Active Suppliers */}
        <section className="border border-jt-border rounded-[var(--jt-radius)] bg-jt-surface shadow-sm">
          <div className="p-6 border-b border-jt-border/50">
            <h3 className="text-lg font-semibold text-jt-text">Active Suppliers</h3>
          </div>
          <div className="p-4">
            {suppliers.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <PlusCircle size={32} className="text-jt-muted/50 mb-3" />
                <p className="text-sm text-jt-muted">No suppliers yet.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {suppliers.map((s: any) => (
                  <div
                    key={s.id}
                    className="flex items-center justify-between p-4 rounded-lg border border-jt-border hover:border-jt-teal/30 transition-colors bg-jt-surface"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center">
                        <span className="text-blue-600 font-medium">
                          {s.name?.charAt(0) || 'U'}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-jt-text truncate">{s.name}</p>
                        <p className="text-xs text-jt-muted truncate">{s.email || '—'}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span
                        className={`px-2 py-0.5 rounded text-xs font-semibold border ${
                          s.status === 'active'
                            ? 'bg-green-100 text-green-700 border-green-200'
                            : 'bg-slate-100 text-slate-700 border-slate-200'
                        }`}
                      >
                        {s.status}
                        {s.status !== 'active' ? ` • ${s.status}` : ''}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Pending Actions / Status */}
        <section className="border border-jt-border rounded-[var(--jt-radius)] bg-jt-surface shadow-sm">
          <div className="p-6 border-b border-jt-border/50">
            <h3 className="text-lg font-semibold text-jt-text">Supplier Actions</h3>
          </div>
          <div className="p-4 space-y-4">
            <div className="flex items-center justify-between p-3 rounded-lg border border-jt-border bg-jt-surface/50">
              <div>
                <p className="text-sm font-medium text-jt-text">Suspend / Reactivate</p>
                <p className="text-xs text-jt-muted">
                  Toggle supplier status between active and suspended
                </p>
              </div>
              <div className="flex gap-1">
                {suppliers.map((s: any) => (
                  <button
                    key={s.id}
                    onClick={() => toggleStatus(s.id, s.status)}
                    className={`row-action text-sm px-3 py-1.5 rounded-md ${
                      s.status === 'active'
                        ? 'text-rose-600 hover:bg-rose-50 border border-rose-100'
                        : 'text-green-600 hover:bg-green-50 border border-green-100'
                    }`}
                  >
                    {s.status === 'active' ? 'Suspend' : 'Reactivate'}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg border border-jt-border bg-jt-surface/50">
              <div>
                <p className="text-sm font-medium text-jt-text">Supplier Count</p>
                <p className="text-xs text-jt-muted">{suppliers.length} total suppliers</p>
              </div>
              <span className="text-sm font-bold text-jt-text">{suppliers.length}</span>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
