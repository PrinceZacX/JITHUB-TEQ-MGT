'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  List,
  FileText,
  Tag,
  User,
  Clock,
  ArrowLeft,
} from 'lucide-react';
import {
  createServiceTicket,
  listCustomers,
  listServiceLevelPolicies,
} from '@/app/actions/service-desk';

type Priority = 'low' | 'normal' | 'high' | 'critical' | 'urgent';

export default function NewServiceTicketPage() {
  const [customers, setCustomers] = useState<any[]>([]);
  const [policies, setPolicies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState<{
    customerId: string;
    title: string;
    description: string;
    priority: Priority;
    slaPolicyId: string | null;
  }>({
    customerId: '',
    title: '',
    description: '',
    priority: 'normal',
    slaPolicyId: null,
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  async function loadData() {
    setLoading(true);
    try {
      const [customersData, policiesData] = await Promise.all([
        listCustomers(),
        listServiceLevelPolicies(),
      ]);
      setCustomers(customersData);
      setPolicies(policiesData);
    } catch (err: any) {
      setError(err.message || 'Failed to load form data.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!form.customerId) {
      setError('Please select a customer.');
      return;
    }
    if (!form.title.trim()) {
      setError('Title is required.');
      return;
    }
    try {
      setSubmitting(true);
      await createServiceTicket({
        customerId: form.customerId,
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        priority: form.priority,
        slaPolicyId: form.slaPolicyId || undefined,
      });
      setSuccess(true);
    } catch (err: any) {
      setError(err.message || 'Failed to create ticket.');
    } finally {
      setSubmitting(false);
    }
  }

  if (success) {
    return (
      <div className="p-6 max-w-xl mx-auto">
        <div className="panel data-panel text-center py-12">
          <List size={48} className="mx-auto text-jt-primary mb-4" />
          <h2 className="text-xl font-bold">Ticket Created</h2>
          <p className="text-jt-muted mt-2">
            Your service ticket has been created successfully.
          </p>
          <div className="mt-6 flex gap-2 justify-center">
            <Link
              href="/service-desk/tickets"
              className="primary-button"
            >
              View All Tickets
            </Link>
            <Link
              href="/service-desk/tickets/new"
              className="button-secondary"
            >
              Create Another
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <Link
          href="/service-desk/tickets"
          className="flex items-center gap-2 text-jt-primary hover:text-jt-text"
        >
          <ArrowLeft size={14} /> Back to Tickets
        </Link>
        <h1 className="text-2xl font-bold">New Service Ticket</h1>
      </div>

      {loading ? (
        <div className="panel data-panel flex items-center justify-center py-12">
          <p className="text-jt-muted">Loading form...</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
              {error}
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="block text-sm font-medium mb-1">
                Customer <span className="text-red-500">*</span>
              </label>
              <select
                className="w-full border border-jt-border rounded-lg px-3 py-2 bg-jt-surface"
                value={form.customerId}
                onChange={(e) =>
                  setForm({ ...form, customerId: e.target.value })
                }
              >
                <option value="">Select a customer</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Priority
              </label>
              <select
                className="w-full border border-jt-border rounded-lg px-3 py-2 bg-jt-surface"
                value={form.priority}
                onChange={(e) =>
                  setForm({ ...form, priority: e.target.value as Priority })
                }
              >
                <option value="low">Low</option>
                <option value="normal">Normal</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              className="w-full border border-jt-border rounded-lg px-3 py-2 bg-jt-surface"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Brief description of the issue"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Description
            </label>
            <textarea
              className="w-full border border-jt-border rounded-lg px-3 py-2 bg-jt-surface"
              value={form.description}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
              rows={4}
              placeholder="Detailed description of the issue..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              SLA Policy
            </label>
            <select
              className="w-full border border-jt-border rounded-lg px-3 py-2 bg-jt-surface"
              value={form.slaPolicyId || ''}
              onChange={(e) =>
                setForm({
                  ...form,
                  slaPolicyId: e.target.value || null,
                })
              }
            >
              <option value="">Default SLA</option>
              {policies.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <div className="pt-4 flex gap-3">
            <button
              type="submit"
              className="primary-button flex-1"
              disabled={submitting}
            >
              {submitting ? 'Creating...' : 'Create Ticket'}
            </button>
            <Link
              href="/service-desk/tickets"
              className="button-secondary flex-1 text-center"
            >
              Cancel
            </Link>
          </div>
        </form>
      )}
    </div>
  );
}
