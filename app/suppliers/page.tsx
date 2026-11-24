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
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Supplier Management</h1>
        <button className="primary-button" onClick={() => setOpenForm(true)}>
          <Plus size={14} /> Add Supplier
        </button>
      </div>
      {openForm && (
        <div className="mb-6 panel data-panel">
          <h3 className="text-lg font-medium mb-4">Add Supplier</h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <label className="block text-sm font-medium">Business Name</label>
              <input
                name="name"
                className="w-full border rounded px-2 py-1"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <label className="block text-sm font-medium">Email</label>
              <input
                name="email"
                type="email"
                className="w-full border rounded px-2 py-1"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
              <label className="block text-sm font-medium">Phone</label>
              <input
                name="phone"
                className="w-full border rounded px-2 py-1"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <label className="block text-sm font-medium">Address</label>
              <input
                name="address"
                className="w-full border rounded px-2 py-1"
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
              />
              <label className="block text-sm font-medium">City</label>
              <input
                name="city"
                className="w-full border rounded px-2 py-1"
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <label className="block text-sm font-medium">Country</label>
              <input
                name="country"
                className="w-full border rounded px-2 py-1"
                value={form.country}
                onChange={(e) => setForm({ ...form, country: e.target.value })}
              />
              <label className="block text-sm font-medium">Category</label>
              <input
                name="category"
                className="w-full border rounded px-2 py-1"
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <label className="block text-sm font-medium">Credit Limit</label>
              <input
                name="creditLimit"
                type="number"
                className="w-full border rounded px-2 py-1"
                value={form.creditLimit}
                onChange={(e) => setForm({ ...form, creditLimit: e.target.value })}
              />
              <label className="block text-sm font-medium">Credit Terms (days)</label>
              <input
                name="creditTermsDays"
                type="number"
                className="w-full border rounded px-2 py-1"
                value={form.creditTermsDays}
                onChange={(e) => setForm({ ...form, creditTermsDays: e.target.value })}
              />
            </div>
            <div className="flex gap-2">
              <button className="button-secondary" onClick={() => setOpenForm(false)}>
                Cancel
              </button>
              <button className="primary-button" type="submit" disabled={loading}>
                {loading ? 'Creating...' : 'Create Supplier'}
              </button>
            </div>
          </form>
        </div>
      )}
      <div className="invoice-table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Phone</th>
              <th>City</th>
              <th>Category</th>
              <th>Credit Limit</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {suppliers.map((s: any) => (
              <tr key={s.id}>
                <td>{s.name}</td>
                <td>{s.email || '—'}</td>
                <td>{s.phone || '—'}</td>
                <td>{s.city || '—'}</td>
                <td>{s.category || '—'}</td>
                <td>{s.creditLimit ? parseFloat(s.creditLimit).toFixed(2) : '0.00'}</td>
                <td>
                  <span className={`status-pill status-${s.status?.toLowerCase() || 'active'}`}>
                    {s.status}
                  </span>
                </td>
                <td>
                  <button className="row-action" onClick={() => toggleStatus(s.id, s.status)}>
                    {s.status === 'active' ? 'Suspend' : 'Reactivate'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
