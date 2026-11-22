'use client'

import { useEffect, useState } from 'react'
import { createTaxRate, listTaxRates, updateTaxRate as updateTaxRateAction } from '@/app/actions/finance'
import { Plus } from 'lucide-react'

export default function TaxRatesPage() {
  const [taxRates, setTaxRates] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [openForm, setOpenForm] = useState(false)
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')
  const [form, setForm] = useState({
    name: '',
    rate: '',
    type: 'vat',
    isDefault: false,
    isActive: true,
    effectiveFrom: '',
    effectiveTo: '',
    description: '',
  })

  async function loadData() {
    setLoading(true)
    try {
      const rows = await listTaxRates()
      setTaxRates(rows)
    } catch {
      setTaxRates([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setLoading(true)
    setError('')
    try {
      await createTaxRate(form)
      setOpenForm(false)
      setForm({ name: '', rate: '', type: 'vat', isDefault: false, isActive: true, effectiveFrom: '', effectiveTo: '', description: '' })
      await loadData()
    } catch (cause: any) {
      setError(cause.message || 'Failed to create tax rate')
    } finally {
      setLoading(false)
    }
  }

  async function toggleTaxRate(id: string, updates: { status?: string; isDefault?: boolean }) {
    setLoading(true)
    setError('')
    try {
      await updateTaxRateAction({ id, ...updates })
      setToast('Tax rate updated.')
      await loadData()
    } catch (cause: any) {
      setError(cause.message || 'Could not update tax rate')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Tax Rates</h1>
        <button className="primary-button" onClick={() => setOpenForm(true)}>
          <Plus size={14} /> Add Tax Rate
        </button>
      </div>
      {openForm && (
        <div className="mb-6 panel data-panel">
          <div className="panel-heading">
            <div><span className="panel-eyebrow">TAX RATES</span><h2>Tax Rates</h2></div>
            <button className="primary-button" onClick={() => setOpenForm(false)}>Close</button>
          </div>
          <form onSubmit={handleSubmit} className="modal-form">
            <div className="form-two">
              <label>Name</label>
              <input name="name" type="text" defaultValue={form.name} required minLength={2} maxLength={160} />
            </div>
            <div className="form-two">
              <label>Rate (%)</label>
              <input name="rate" type="number" defaultValue={form.rate} required />
            </div>
            <div className="form-two">
              <label>Type</label>
              <select name="type" defaultValue={form.type} required>
                <option value="vat">VAT</option>
                <option value="withholding">Withholding</option>
                <option value="excise">Excise</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div className="form-two">
              <label>Effective From</label>
              <input name="effectiveFrom" type="date" defaultValue={form.effectiveFrom} />
            </div>
            <div className="form-two">
              <label>Effective To</label>
              <input name="effectiveTo" type="date" defaultValue={form.effectiveTo} />
            </div>
            <div className="modal-actions">
              <button className="button-secondary" type="button" onClick={() => setOpenForm(false)}>Cancel</button>
              <button className="primary-button" type="submit" disabled={loading}>{loading ? 'Creating...' : 'Create Tax Rate'}</button>
            </div>
          </form>
        </div>
      )}
      <div className="invoice-table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Rate</th>
              <th>Type</th>
              <th>Status</th>
              <th>Effective From</th>
              <th>Effective To</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {taxRates.map((tr: any) => (
              <tr key={tr.id}>
                <td>{tr.name}</td>
                <td>{tr.rate}%</td>
                <td>{tr.type}</td>
                <td><span className={`status-pill status-${tr.status || 'active'}`}>{tr.status}</span></td>
                <td>{tr.effectiveFrom}</td>
                <td>{tr.effectiveTo || '-'}</td>
                <td>
                  <button className="row-action" onClick={() => toggleTaxRate(tr.id, { status: tr.status === 'active' ? 'inactive' : 'active' })}>{tr.status === 'active' ? 'Deactivate' : 'Activate'}</button>
                  <button className="row-action" onClick={() => toggleTaxRate(tr.id, { isDefault: !tr.isDefault })}>{tr.isDefault ? 'Revoke Default' : 'Set Default'}</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
