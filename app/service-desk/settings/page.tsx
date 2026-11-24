'use client';

import { useEffect, useState } from 'react';
import { Plus, Edit, X, Trash2, Check, MoreHorizontal } from 'lucide-react';
import {
  listServiceLevelPolicies,
  createServiceLevelPolicy,
  updateServiceLevelPolicy,
  deleteServiceLevelPolicy,
} from '@/app/actions/service-desk';

type Priority = 'low' | 'normal' | 'high' | 'critical' | 'urgent';

export default function ServiceDeskSettingsPage() {
  const [policies, setPolicies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [openForm, setOpenForm] = useState(false);
  const [editingPolicy, setEditingPolicy] = useState<any | null>(null);
  const [form, setForm] = useState<{
    name: string;
    description: string;
    responseMinutes: number;
    resolutionMinutes: number;
    isDefault: boolean;
    appliesToPriorities: Priority[];
    businessHoursOnly: boolean;
    timezone: string;
  }>({
    name: '',
    description: '',
    responseMinutes: 60,
    resolutionMinutes: 480,
    isDefault: false,
    appliesToPriorities: ['low', 'normal', 'high', 'critical', 'urgent'],
    businessHoursOnly: true,
    timezone: 'Africa/Kampala',
  });
  const [submitting, setSubmitting] = useState(false);

  const priorityOptions: Priority[] = ['low', 'normal', 'high', 'critical', 'urgent'];

  async function loadData() {
    setLoading(true);
    try {
      const data = await listServiceLevelPolicies();
      setPolicies(data);
    } catch (err) {
      console.error('Failed to load policies:', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  function resetForm() {
    setForm({
      name: '',
      description: '',
      responseMinutes: 60,
      resolutionMinutes: 480,
      isDefault: false,
      appliesToPriorities: ['low', 'normal', 'high', 'critical', 'urgent'],
      businessHoursOnly: true,
      timezone: 'Africa/Kampala',
    });
    setEditingPolicy(null);
    setOpenForm(false);
  }

  function openCreate() {
    resetForm();
    setOpenForm(true);
  }

  function openEdit(policy: any) {
    setEditingPolicy(policy);
    setForm({
      name: policy.name,
      description: policy.description || '',
      responseMinutes: policy.responseMinutes,
      resolutionMinutes: policy.resolutionMinutes,
      isDefault: policy.isDefault,
      appliesToPriorities: policy.appliesToPriorities || [
        'low',
        'normal',
        'high',
        'critical',
        'urgent',
      ],
      businessHoursOnly: policy.businessHoursOnly !== false,
      timezone: policy.timezone || 'Africa/Kampala',
    });
    setOpenForm(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (editingPolicy) {
        await updateServiceLevelPolicy({ id: editingPolicy.id, ...form });
      } else {
        await createServiceLevelPolicy(form);
      }
      resetForm();
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to save policy');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(policyId: string) {
    if (!confirm('Delete this SLA policy? This cannot be undone.')) return;
    try {
      await deleteServiceLevelPolicy(policyId);
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to delete policy');
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-jt-text">SLA Policies</h1>
          <p className="text-jt-muted text-sm">
            Manage service level agreements for your support team
          </p>
        </div>
        <button className="primary-button" onClick={openCreate}>
          <Plus size={14} /> Create Policy
        </button>
      </div>

      {openForm && (
        <section className="border border-jt-border rounded-[var(--jt-radius)] bg-jt-surface shadow-sm">
          <div className="p-6 border-b border-jt-border/50">
            <h3 className="text-lg font-semibold text-jt-text">
              {editingPolicy ? 'Edit Policy' : 'Create New Policy'}
            </h3>
          </div>
          <div className="p-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-semibold text-jt-muted uppercase tracking-wider mb-1.5">
                    Policy Name
                  </label>
                  <input
                    type="text"
                    required
                    className="w-full border border-jt-border rounded-lg px-3 py-2.5 bg-jt-surface text-sm focus:border-jt-teal focus:ring-1 focus:ring-jt-teal"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="e.g. Standard Support"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-jt-muted uppercase tracking-wider mb-1.5">
                    Timezone
                  </label>
                  <input
                    type="text"
                    className="w-full border border-jt-border rounded-lg px-3 py-2.5 bg-jt-surface text-sm focus:border-jt-teal focus:ring-1 focus:ring-jt-teal"
                    value={form.timezone}
                    onChange={(e) => setForm({ ...form, timezone: e.target.value })}
                    placeholder="Africa/Kampala"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-jt-muted uppercase tracking-wider mb-1.5">
                    Response Time (minutes)
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    className="w-full border border-jt-border rounded-lg px-3 py-2.5 bg-jt-surface text-sm focus:border-jt-teal focus:ring-1 focus:ring-jt-teal"
                    value={form.responseMinutes}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        responseMinutes: parseInt(e.target.value) || 60,
                      })
                    }
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-jt-muted uppercase tracking-wider mb-1.5">
                    Resolution Time (minutes)
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    className="w-full border border-jt-border rounded-lg px-3 py-2.5 bg-jt-surface text-sm focus:border-jt-teal focus:ring-1 focus:ring-jt-teal"
                    value={form.resolutionMinutes}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        resolutionMinutes: parseInt(e.target.value) || 480,
                      })
                    }
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-jt-muted uppercase tracking-wider mb-1.5">
                  Description
                </label>
                <textarea
                  className="w-full border border-jt-border rounded-lg px-3 py-2.5 bg-jt-surface text-sm focus:border-jt-teal focus:ring-1 focus:ring-jt-teal"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={3}
                  placeholder="Optional description of this policy..."
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.isDefault}
                      onChange={(e) => setForm({ ...form, isDefault: e.target.checked })}
                      className="rounded border-jt-border text-jt-teal"
                    />
                    <span className="text-sm text-jt-text">
                      Set as default policy for new tickets
                    </span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.businessHoursOnly}
                      onChange={(e) => setForm({ ...form, businessHoursOnly: e.target.checked })}
                      className="rounded border-jt-border text-jt-teal"
                    />
                    <span className="text-sm text-jt-text">
                      Business hours only (exclude nights/weekends)
                    </span>
                  </label>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-jt-muted uppercase tracking-wider mb-1.5">
                    Applies to Priorities
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {priorityOptions.map((p) => (
                      <label key={p} className="cursor-pointer flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={form.appliesToPriorities.includes(p)}
                          onChange={(e) =>
                            setForm({
                              ...form,
                              appliesToPriorities: e.target.checked
                                ? [...form.appliesToPriorities, p]
                                : form.appliesToPriorities.filter((x: string) => x !== p),
                            })
                        }
                          className="rounded border-jt-border text-jt-teal"
                        />
                        <span className="text-sm capitalize text-jt-text">{p}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-6 border-t border-jt-border/50">
                <button type="button" className="button-secondary flex-1" onClick={resetForm}>
                  <X size={14} /> Cancel
                </button>
                <button type="submit" className="primary-button flex-1" disabled={submitting}>
                  {submitting ? 'Saving...' : editingPolicy ? 'Update Policy' : 'Create Policy'}
                </button>
              </div>
            </form>
          </div>
        </section>
      )}

      {loading ? (
        <section className="border border-jt-border rounded-[var(--jt-radius)] bg-jt-surface shadow-sm">
          <div className="p-8 flex items-center justify-center">
            <p className="text-sm text-jt-muted">Loading policies...</p>
          </div>
        </section>
      ) : policies.length === 0 ? (
        <section className="border border-jt-border rounded-[var(--jt-radius)] bg-jt-surface shadow-sm">
          <div className="p-10 flex flex-col items-center justify-center text-center">
            <p className="text-sm text-jt-muted mb-6">
              No SLA policies configured yet.
            </p>
            <button className="primary-button" onClick={openCreate}>
              <Plus size={14} /> Create Your First Policy
            </button>
          </div>
        </section>
      ) : (
        <section className="space-y-4">
          {policies.map((policy) => (
            <div
              key={policy.id}
              className="border border-jt-border rounded-[var(--jt-radius)] bg-jt-surface shadow-sm hover:shadow-md transition-shadow group"
            >
              <div className="p-6 border-b border-jt-border/50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <h3 className="text-lg font-semibold text-jt-text">
                      {policy.name}
                    </h3>
                    {policy.isDefault && (
                      <span className="px-2 py-0.5 rounded text-xs font-semibold bg-green-100 text-green-700 border border-green-200">
                        Default
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => openEdit(policy)} className="row-action text-jt-primary hover:bg-jt-surface/50">
                      <Edit size={14} />
                    </button>
                    {!policy.isDefault && (
                      <button
                        onClick={() => handleDelete(policy.id)}
                        className="row-action text-rose-600 hover:bg-rose-50"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
              <div className="p-6">
                <p className="text-sm text-jt-muted mb-4 truncate">
                  {policy.description || 'No description'}
                </p>
                <div className="flex flex-wrap gap-4 text-sm">
                  <span className="text-jt-muted">
                    Response: <span className="font-medium text-jt-text">{policy.responseMinutes} min</span>
                  </span>
                  <span className="text-jt-muted">
                    Resolution:{' '}
                    <span className="font-medium text-jt-text">{policy.resolutionMinutes} min</span>
                  </span>
                  <span className="text-jt-muted">
                    Hours:{' '}
                    <span className="font-medium text-jt-text">
                      {policy.businessHoursOnly ? 'Business only' : '24/7'}
                    </span>
                  </span>
                  <span className="text-jt-muted">
                    Timezone:{' '}
                    <span className="font-medium text-jt-text">{policy.timezone}</span>
                  </span>
                </div>
                <div className="flex flex-wrap gap-2 mt-4">
                  {policy.appliesToPriorities?.map((p: string) => (
                    <span
                      key={p}
                      className="px-2 py-1 rounded text-xs font-semibold border bg-blue-100 text-blue-700 border-blue-200 capitalize"
                    >
                      {p}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
