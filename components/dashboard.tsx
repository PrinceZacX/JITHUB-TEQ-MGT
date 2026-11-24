'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { authClient } from '@/lib/auth-client';
import {
  createCustomer,
  createInvoice,
  getFinancialReport,
  issueDraftInvoice,
  recordExpense,
  recordPayment,
  recordRefund,
  approveRefund,
  completeRefund,
  saveCatalogueItem,
  setCatalogueItemStatus,
  updateCustomer,
  updateBusiness,
  voidReceipt,
  cancelInvoice,
  createBusiness,
  listBusinesses,
  setActiveBusiness,
  listBusinessMembers,
  inviteMember,
  updateMembershipRole,
  suspendMembership,
  removeMembership,
} from '@/app/actions/finance';
import {
  filterReceipts,
  formatReceiptDate,
  sortReceipts,
  type ReceiptSort,
} from '@/lib/receipt-ui';
import { type BusinessRole } from '@/lib/permissions';
import {
  Activity,
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  Bell,
  BookOpenCheck,
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  Check,
  ChevronDown,
  CircleHelp,
  ClipboardList,
  CreditCard,
  Download,
  FileClock,
  FilePlus2,
  FileText,
  Headset,
  LayoutDashboard,
  LogOut,
  Menu,
  MoreHorizontal,
  Package,
  Plus,
  ReceiptText,
  Search,
  Settings2,
  ShieldCheck,
  Users,
  WalletCards,
  X,
} from 'lucide-react';
import { FunctionGrid, type FunctionItem } from './function-selection';
import { UnifiedNavigation } from './navigation/UnifiedNavigation';
import { SearchOverlay } from './navigation/SearchOverlay';
import { ToastProvider, useToast } from './ui/Notifications';
import { SmartEmptyState } from './ui/SmartEmptyState';
import { LiveResultCount } from './ui/LiveResultCount';

type Data = Awaited<ReturnType<typeof import('@/app/actions/finance').getDashboardData>>;
export type Section =
  | 'Dashboard'
  | 'Invoices'
  | 'Payments'
  | 'Receipts'
  | 'Refunds'
  | 'Customers'
  | 'Suppliers'
  | 'Purchase Orders'
  | 'Goods Receipts'
  | 'Stock Movements'
  | 'Products & services'
  | 'Expenses'
  | 'Reports'
  | 'Notifications'
  | 'User management'
  | 'Audit logs'
  | 'Settings'
  | 'Service Desk'
  | 'Client Portal';
type CatalogueItem = Data['catalogue'][number];
const navigation: {
  label: Section;
  icon: typeof LayoutDashboard;
  group: string;
}[] = [
  { label: 'Dashboard', icon: LayoutDashboard, group: 'WORKSPACE' },
  { label: 'Invoices', icon: FileText, group: 'WORKSPACE' },
  { label: 'Payments', icon: CreditCard, group: 'WORKSPACE' },
  { label: 'Refunds', icon: FileClock, group: 'WORKSPACE' },
  { label: 'Receipts', icon: ReceiptText, group: 'WORKSPACE' },
  { label: 'Customers', icon: Users, group: 'WORKSPACE' },
  { label: 'Suppliers', icon: Building2, group: 'WORKSPACE' },
  { label: 'Purchase Orders', icon: ClipboardList, group: 'WORKSPACE' },
  { label: 'Goods Receipts', icon: Package, group: 'WORKSPACE' },
  { label: 'Stock Movements', icon: WalletCards, group: 'WORKSPACE' },
  { label: 'Products & services', icon: Package, group: 'MANAGE' },
  { label: 'Expenses', icon: WalletCards, group: 'MANAGE' },
  { label: 'Reports', icon: Activity, group: 'MANAGE' },
  { label: 'Service Desk', icon: Headset, group: 'MANAGE' },
  { label: 'Client Portal', icon: BriefcaseBusiness, group: 'MANAGE' },
  { label: 'Notifications', icon: Bell, group: 'ADMINISTRATION' },
  { label: 'User management', icon: ShieldCheck, group: 'ADMINISTRATION' },
  { label: 'Audit logs', icon: FileClock, group: 'ADMINISTRATION' },
  { label: 'Settings', icon: Settings2, group: 'ADMINISTRATION' },
];
const money = (value: string | number) =>
  `UGX ${new Intl.NumberFormat('en-UG', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(Number(value || 0))}`;
const titleCase = (value: string) =>
  value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
const localISODate = (date: Date) =>
  new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
const todayISO = () => localISODate(new Date());
const maxDueDateISO = () => {
  const date = new Date();
  date.setFullYear(date.getFullYear() + 2);
  return localISODate(date);
};
function isValidFormDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  if (year < 1900 || year > 2200) return false;
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  );
}
function readableError(cause: unknown) {
  const message = cause instanceof Error ? cause.message : '';
  if (!message || /Minified React error|Server Components render/i.test(message))
    return 'We couldn’t complete that action. Please check the details and try again.';
  return message;
}

export function Dashboard({ user, data }: { user: { name: string; email: string }; data: Data }) {
  const router = useRouter();
  const [section, setSection] = useState<Section>('Dashboard');
  const [modal, setModal] = useState<
    'customer' | 'invoice' | 'payment' | 'expense' | 'catalogue' | null
  >(null);
  const [selectedCatalogue, setSelectedCatalogue] = useState<CatalogueItem | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<Data['customers'][number] | null>(null);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState('');
  const [invoiceStatusFilter, setInvoiceStatusFilter] = useState('all');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [toast, setToast] = useState('');
  const [error, setError] = useState('');
  const [selectedReceipt, setSelectedReceipt] = useState<Data['receipts'][number] | null>(null);
  const [receiptSort, setReceiptSort] = useState<ReceiptSort>('newest');
  const [busy, setBusy] = useState(false);
  const [voidingReceiptId, setVoidingReceiptId] = useState('');
  const [cancellingInvoiceId, setCancellingInvoiceId] = useState('');
  const [businessEdit, setBusinessEdit] = useState<{
    name: string;
    email: string;
    phone: string;
    address: string;
    city: string;
    country: string;
    currency: string;
    receiptPrefix: string;
    invoicePrefix: string;
  } | null>(null);
  const [businesses, setBusinesses] = useState<{ id: string; name: string; role: string }[]>([]);
  const [businessesLoading, setBusinessesLoading] = useState(false);
  const [businessSwitcherOpen, setBusinessSwitcherOpen] = useState(false);
  const [businessMembers, setBusinessMembers] = useState<any[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [inviteFormOpen, setInviteFormOpen] = useState(false);
  const [inviteForm, setInviteForm] = useState({
    email: '',
    role: 'cashier' as BusinessRole,
  });
  const [invoiceLines, setInvoiceLines] = useState<
    {
      itemId: string;
      description: string;
      quantity: string;
      unitPrice: string;
      taxRate: string;
    }[]
  >([]);
  const visibleInvoices = useMemo(
    () =>
      data.invoices.filter(
        (item) =>
          `${item.number} ${item.customer} ${item.status}`
            .toLowerCase()
            .includes(query.toLowerCase()) &&
          (invoiceStatusFilter === 'all' || item.status === invoiceStatusFilter),
      ),
    [data.invoices, query, invoiceStatusFilter],
  );
  const visibleCustomers = useMemo(
    () =>
      data.customers.filter((item) =>
        `${item.name} ${item.email || ''} ${item.phone || ''}`
          .toLowerCase()
          .includes(query.toLowerCase()),
      ),
    [data.customers, query],
  );
  const visibleReceipts = useMemo(() => {
    const filtered = filterReceipts(data.receipts, query);
    return sortReceipts(filtered, receiptSort);
  }, [data.receipts, query, receiptSort]);

  useEffect(() => {
    let mounted = true;
    async function loadBusinesses() {
      setBusinessesLoading(true);
      try {
        const rows = await listBusinesses();
        if (mounted) setBusinesses(rows.map((r) => ({ id: r.id, name: r.name, role: 'owner' })));
      } catch {
        if (mounted) setBusinesses([]);
      } finally {
        if (mounted) setBusinessesLoading(false);
      }
    }
    loadBusinesses();
    return () => {
      mounted = false;
    };
  }, []);

  function openPayment(invoiceId = '') {
    setSelectedInvoiceId(invoiceId);
    setModal('payment');
  }

  async function issueInvoice(id: string) {
    setBusy(true);
    setError('');
    try {
      await issueDraftInvoice(id);
      setToast('Draft invoice issued.');
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not issue this invoice.');
    } finally {
      setBusy(false);
    }
  }

  async function voidReceiptHandler(receiptId: string) {
    setBusy(true);
    setError('');
    try {
      await voidReceipt({ receiptId });
      setToast('Receipt voided.');
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not void receipt.');
    } finally {
      setBusy(false);
    }
  }

  async function cancelInvoiceHandler(invoiceId: string) {
    setBusy(true);
    setError('');
    try {
      await cancelInvoice({ invoiceId });
      setToast('Invoice cancelled.');
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not cancel invoice.');
    } finally {
      setBusy(false);
    }
  }

  async function requestRefund(
    amount: string,
    reason: string,
    method: string,
    reference: string,
    paymentId: string,
  ) {
    setBusy(true);
    setError('');
    try {
      const result = await recordRefund({
        paymentId,
        amount,
        reason,
        method,
        reference,
      });
      setToast(`Refund requested (${result.id}).`);
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not request refund.');
    } finally {
      setBusy(false);
    }
  }

  async function decideRefund(refundId: string, approve: boolean) {
    setBusy(true);
    setError('');
    try {
      await approveRefund({ refundId, approve });
      setToast(approve ? 'Refund approved.' : 'Refund rejected.');
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not decide refund.');
    } finally {
      setBusy(false);
    }
  }

  async function completeRefundHandler(refundId: string) {
    setBusy(true);
    setError('');
    try {
      await completeRefund({ refundId });
      setToast('Refund completed.');
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not complete refund.');
    } finally {
      setBusy(false);
    }
  }

  async function saveBusinessSettings() {
    if (!businessEdit) return;
    setBusy(true);
    setError('');
    try {
      await updateBusiness(businessEdit);
      setToast('Business profile updated.');
      setBusinessEdit(null);
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not update business profile.');
    } finally {
      setBusy(false);
    }
  }

  async function downloadReceiptPdf(receiptId: string) {
    try {
      const res = await fetch(`/api/documents/receipt/${receiptId}`);
      if (!res.ok) throw new Error('Failed to download receipt PDF');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'receipt.pdf';
      a.click();
      URL.revokeObjectURL(url);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not download receipt PDF.');
    }
  }

  async function downloadThermalReceipt(receiptId: string, widthMm: 58 | 80) {
    try {
      const res = await fetch(`/api/documents/receipt/thermal/${receiptId}?width=${widthMm}`);
      if (!res.ok) throw new Error('Failed to download thermal receipt');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `receipt-${widthMm}mm.txt`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not download thermal receipt.');
    }
  }

  async function submitForm(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError('');
    try {
      if (modal === 'customer') {
        const customerInput = {
          name: String(form.get('name')),
          email: String(form.get('email')),
          phone: String(form.get('phone')),
          address: String(form.get('address')),
        };
        if (selectedCustomer) {
          await updateCustomer({ id: selectedCustomer.id, ...customerInput });
          setToast('Customer details updated.');
        } else {
          await createCustomer(customerInput);
          setToast('Customer added to your directory.');
        }
        setSelectedCustomer(null);
      } else if (modal === 'invoice') {
        const dueDate = String(form.get('dueDate'));
        if (!isValidFormDate(dueDate)) {
          setError('Choose a valid due date. Use the date picker or a DD/MM/YYYY date.');
          return;
        }
        const status = form.get('invoiceStatus') === 'draft' ? 'draft' : 'issued';
        const result = await createInvoice({
          customerId: String(form.get('customerId')),
          dueDate,
          status,
          lines: [
            {
              description: String(form.get('description')),
              quantity: String(form.get('quantity')),
              unitPrice: String(form.get('unitPrice')),
              taxType: 'standard',
              taxRate: String(form.get('taxRate')),
            },
          ],
        });
        setToast(
          status === 'draft'
            ? `${result.number} saved as a draft.`
            : `${result.number} issued successfully.`,
        );
      } else if (modal === 'payment') {
        const result = await recordPayment({
          invoiceId: String(form.get('invoiceId')),
          amount: String(form.get('amount')),
          method: String(form.get('method')),
          reference: String(form.get('reference')),
          paidAt: String(form.get('paidAt')),
        });
        setToast(`Payment recorded. Receipt ${result.receiptNumber} is ready.`);
      } else if (modal === 'expense') {
        await recordExpense({
          category: String(form.get('category')),
          payee: String(form.get('payee')),
          description: String(form.get('description')),
          method: String(form.get('method')),
          paidAt: String(form.get('paidAt')),
          amount: String(form.get('amount')),
        });
        setToast('Expense recorded in your business ledger.');
      } else if (modal === 'catalogue') {
        await saveCatalogueItem({
          id: selectedCatalogue?.id,
          name: String(form.get('name')),
          description: String(form.get('description')),
          unitPrice: String(form.get('unitPrice')),
        });
        setToast(selectedCatalogue ? 'Catalogue item updated.' : 'Catalogue item added.');
        setSelectedCatalogue(null);
      }
      setModal(null);
      setSelectedInvoiceId('');
      router.refresh();
      window.setTimeout(() => setToast(''), 4500);
    } catch (cause) {
      setError(readableError(cause));
    } finally {
      setBusy(false);
    }
  }

  const sectionDescription: Record<Section, string> = {
    Dashboard: 'A clear view of your business finances.',
    Invoices: 'Create, issue and follow up on customer invoices.',
    Payments: 'Record incoming funds against outstanding invoices.',
    Receipts: 'Payment receipts are created automatically when you record funds.',
    Refunds: 'Review and approve customer refund requests.',
    Customers: 'Keep customer details and account history in one place.',
    Suppliers: 'Manage business suppliers and purchase terms.',
    'Purchase Orders': 'Create and track purchase orders to suppliers.',
    'Goods Receipts': 'Record goods received from suppliers.',
    'Stock Movements': 'Track inventory movements across warehouses.',
    'Products & services': 'Your business catalogue, ready for the next invoice.',
    Expenses: 'Track outgoing business payments separately from customer receipts.',
    Reports: 'Financial reporting grounded in your recorded transactions.',
    'Service Desk': 'Manage service tickets, clients, and SLA policies.',
    'Client Portal': 'Client-facing portal for service requests and support.',
    Notifications: 'Important updates about your financial workspace.',
    'User management': 'Manage the people who can access your business.',
    'Audit logs': 'A traceable record of financial activity.',
    Settings: 'Configure the way your business uses JITHUB-TEQ.',
  };

  // Function selection cards for Dashboard view
  const [selectedFunction, setSelectedFunction] = useState<string | null>(null);

  // Map function IDs to Section types
  const functionToSection: Record<string, Section> = {
    invoices: 'Invoices',
    payments: 'Payments',
    customers: 'Customers',
    receipts: 'Receipts',
    'purchase-orders': 'Purchase Orders',
    'goods-receipts': 'Goods Receipts',
    'stock-movements': 'Stock Movements',
    suppliers: 'Suppliers',
    reports: 'Reports',
    expenses: 'Expenses',
    settings: 'Settings',
  };

  const FUNCTIONS: FunctionItem[] = [
    {
      id: 'invoices',
      label: 'Invoices',
      description: 'Create, issue and track customer invoices',
      icon: <FileText size={20} />,
      keyboardHint: '⌘I',
    },
    {
      id: 'payments',
      label: 'Payments',
      description: 'Record and reconcile incoming payments',
      icon: <CreditCard size={20} />,
      keyboardHint: '⌘P',
    },
    {
      id: 'customers',
      label: 'Customers',
      description: 'Manage customer directory and accounts',
      icon: <Users size={20} />,
      keyboardHint: '⌘U',
    },
    {
      id: 'receipts',
      label: 'Receipts',
      description: 'View and manage payment receipts',
      icon: <ReceiptText size={20} />,
    },
    {
      id: 'purchase-orders',
      label: 'Purchase Orders',
      description: 'Create and track supplier orders',
      icon: <ClipboardList size={20} />,
      badge: 'beta',
    },
    {
      id: 'goods-receipts',
      label: 'Goods Receipts',
      description: 'Record goods received from suppliers',
      icon: <Package size={20} />,
    },
    {
      id: 'stock-movements',
      label: 'Stock Movements',
      description: 'Track inventory across warehouses',
      icon: <WalletCards size={20} />,
    },
    {
      id: 'suppliers',
      label: 'Suppliers',
      description: 'Manage supplier relationships and terms',
      icon: <Building2 size={20} />,
    },
    {
      id: 'reports',
      label: 'Reports',
      description: 'Financial reporting and analytics',
      icon: <Activity size={20} />,
      keyboardHint: '⌘R',
    },
    {
      id: 'expenses',
      label: 'Expenses',
      description: 'Track outgoing business payments',
      icon: <WalletCards size={20} />,
    },
    {
      id: 'settings',
      label: 'Settings',
      description: 'Configure your business workspace',
      icon: <Settings2 size={20} />,
      keyboardHint: '⌘,',
    },
  ];

  return (
    <div className="app-shell">
      <aside className={`app-sidebar ${sidebarOpen ? 'sidebar-open' : ''}`}>
        <a className="brand-lockup" href="/" aria-label="JITHUB-TEQ dashboard">
          <span className="brand-mark">J</span>
          <span>
            JITHUB<span className="brand-dash">-</span>TEQ
          </span>
        </a>
        <div className="workspace-switch">
          <span className="workspace-emblem">J</span>
          <span className="workspace-label">
            <strong>
              {data.business?.name ||
                `${user.name ? `${user.name.split(' ')[0]}'s workspace` : 'My workspace'}`}
            </strong>
            <small>
              {data.business?.city
                ? `${data.business.city}, ${data.business.country}`
                : 'Business account'}
            </small>
          </span>
          {businesses.length > 1 ? (
            <button
              className="workspace-switcher"
              onClick={() => setBusinessSwitcherOpen(true)}
              aria-label="Switch business"
            >
              <ChevronDown size={14} />
            </button>
          ) : (
            <ChevronDown size={15} />
          )}
        </div>
        {businessSwitcherOpen && businesses.length > 1 && (
          <div className="business-switcher-menu">
            <span className="switcher-menu-header">Switch business</span>
            {businesses.map((b) => (
              <button
                key={b.id}
                className={`switcher-menu-item ${data.business?.id === b.id ? 'switcher-menu-item-active' : ''}`}
                onClick={() => {
                  setActiveBusiness({ businessId: b.id }).then(() => {
                    router.refresh();
                    setBusinessSwitcherOpen(false);
                  });
                }}
              >
                <span>{b.name}</span>
                <span className="switcher-menu-role">{b.role}</span>
                {data.business?.id === b.id && <span className="switcher-menu-active">Active</span>}
              </button>
            ))}
          </div>
        )}
        <nav className="side-navigation" aria-label="Main navigation">
          {['WORKSPACE', 'MANAGE', 'ADMINISTRATION'].map((group) => (
            <div className="nav-group" key={group}>
              <span className="nav-group-label">{group}</span>
              {navigation
                .filter((item) => item.group === group)
                .map(({ label, icon: Icon }) => (
                  <button
                    key={label}
                    className={`nav-item ${section === label ? 'nav-item-active' : ''}`}
                    aria-current={section === label ? 'page' : undefined}
                    onClick={() => {
                      setSection(label);
                      setQuery('');
                      setSidebarOpen(false);
                    }}
                  >
                    <Icon size={17} strokeWidth={1.8} />
                    <span>{label}</span>
                    {label === 'Invoices' && data.invoices.length > 0 && (
                      <small className="nav-count">{data.invoices.length}</small>
                    )}
                  </button>
                ))}
            </div>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="help-card">
            <span className="help-icon">
              <CircleHelp size={16} />
            </span>
            <div>
              <strong>Need a hand?</strong>
              <p>We&apos;re here to help you get started.</p>
              <button
                onClick={() =>
                  setToast('Support resources will be available in your workspace shortly.')
                }
              >
                Visit help centre <ArrowRight size={12} />
              </button>
            </div>
          </div>
          <div className="profile-row">
            <span className="profile-avatar">
              {user.name
                ?.split(' ')
                .map((part) => part[0])
                .join('')
                .slice(0, 2)
                .toUpperCase() || 'JT'}
            </span>
            <span className="profile-copy">
              <strong>{user.name || 'Account owner'}</strong>
              <small>{user.email}</small>
            </span>
            <button
              className="icon-button profile-more"
              aria-label="Sign out"
              onClick={async () => {
                await authClient.signOut();
                router.push('/sign-in');
                router.refresh();
              }}
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>
      {sidebarOpen && (
        <button
          className="sidebar-scrim"
          aria-label="Close navigation"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      <main className="app-main">
        <header className="topbar">
          <button
            className="icon-button mobile-menu"
            aria-label="Open navigation"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu size={20} />
          </button>
          <div className="breadcrumbs">
            <span>JITHUB-TEQ</span>
            <span className="breadcrumb-slash">/</span>
            <strong>{section}</strong>
          </div>
          <div className="topbar-actions">
            <span className="secure-indicator">
              <span /> Workspace secure
            </span>
            <button
              className="icon-button notification-button"
              aria-label="Notifications"
              onClick={() => setSection('Notifications')}
            >
              <Bell size={18} />
              <i />
            </button>
            <span className="topbar-divider" />
            <button className="topbar-user" onClick={() => setSection('Settings')}>
              <span className="profile-avatar small-avatar">
                {user.name?.[0]?.toUpperCase() || 'J'}
              </span>
              <ChevronDown size={14} />
            </button>
          </div>
        </header>
        <div className="page-content">
          <div className="page-heading">
            <div>
              <div className="page-kicker">
                <Building2 size={13} /> {data.business?.name || 'JITHUB-TEQ LTD'} <span>·</span>{' '}
                {data.business?.currency || 'UGX'}
              </div>
              <h1>{section === 'Dashboard' ? 'Good morning' : section}</h1>
              <p>
                {section === 'Dashboard'
                  ? 'Here’s what’s happening with your business today.'
                  : sectionDescription[section]}
              </p>
            </div>
            <div className="heading-actions">
              {section === 'Dashboard' && (
                <button
                  className="button-secondary"
                  onClick={() => setToast('Your latest financial figures are up to date.')}
                >
                  <CalendarDays size={15} /> This month <ChevronDown size={14} />
                </button>
              )}
              {(section === 'Dashboard' || section === 'Invoices') && (
                <button className="primary-button" onClick={() => setModal('invoice')}>
                  <Plus size={16} /> New invoice
                </button>
              )}
            </div>
          </div>
          {section === 'Dashboard' && (
            <>
              <section aria-labelledby="functions-heading" className="mb-8">
                <header className="mb-6">
                  <h2 id="functions-heading" className="text-2xl font-semibold text-jt-text">
                    Choose a workspace
                  </h2>
                  <p className="mt-1 text-jt-muted">
                    Select a module to start working. Your last selection is remembered.
                  </p>
                </header>
                <FunctionGrid
                  items={FUNCTIONS}
                  selectedId={selectedFunction}
                  onSelect={(id) => {
                    setSelectedFunction(id);
                    const targetSection = functionToSection[id];
                    if (targetSection) {
                      setSection(targetSection);
                    }
                  }}
                />
              </section>
              <section className="metric-grid" aria-label="Financial overview">
                <Metric
                  label="Total invoiced"
                  value={money(data.summary?.invoiced ?? 0)}
                  icon={FileText}
                  note={`${data.invoices.length} invoices recorded`}
                  tone="teal"
                />
                <Metric
                  label="Payments received"
                  value={money(data.summary?.received ?? 0)}
                  icon={ArrowDownLeft}
                  note="Across all recorded payments"
                  tone="green"
                />
                <Metric
                  label="Outstanding"
                  value={money(data.summary?.outstanding ?? 0)}
                  icon={WalletCards}
                  note={`${data.summary?.overdue ?? 0} overdue invoices`}
                  tone="amber"
                />
                <Metric
                  label="Customers"
                  value={String(data.customerCount)}
                  icon={Users}
                  note="In your customer directory"
                  tone="blue"
                />
              </section>
              <section className="dashboard-grid">
                <article className="panel trend-panel">
                  <div className="panel-heading">
                    <div>
                      <span className="panel-eyebrow">CASH FLOW</span>
                      <h2>Revenue overview</h2>
                    </div>
                    <button className="subtle-select" onClick={() => setSection('Reports')}>
                      Last 6 months <ChevronDown size={14} />
                    </button>
                  </div>
                  <div className="trend-summary">
                    <strong>{money(data.summary?.received ?? 0)}</strong>
                    <span>
                      <ArrowUpRight size={14} /> Total collected
                    </span>
                  </div>
                  <RevenueChart values={data.trend} />
                  <div className="chart-foot">
                    <span>
                      <i className="legend-dot" />
                      Payments received
                    </span>
                    <span>Monthly totals · UGX</span>
                  </div>
                </article>
                <article className="panel action-panel">
                  <div className="panel-heading">
                    <div>
                      <span className="panel-eyebrow">GET THINGS DONE</span>
                      <h2>Quick actions</h2>
                    </div>
                    <MoreHorizontal size={18} className="muted-icon" />
                  </div>
                  <div className="quick-actions">
                    <QuickAction
                      icon={FilePlus2}
                      title="Create an invoice"
                      detail="Bill a customer"
                      onClick={() => setModal('invoice')}
                    />
                    <QuickAction
                      icon={CreditCard}
                      title="Record a payment"
                      detail="Log incoming funds"
                      onClick={() => openPayment()}
                    />
                    <QuickAction
                      icon={Users}
                      title="Add a customer"
                      detail="Grow your directory"
                      onClick={() => {
                        setSelectedCustomer(null);
                        setModal('customer');
                      }}
                    />
                    <QuickAction
                      icon={ClipboardList}
                      title="View reports"
                      detail="Review your numbers"
                      onClick={() => setSection('Reports')}
                    />
                  </div>
                </article>
              </section>
              <RecentInvoices
                invoices={visibleInvoices}
                onView={() => setSection('Invoices')}
                onPayment={openPayment}
              />
              <div className="bottom-grid">
                <article className="panel customer-panel">
                  <div className="panel-heading">
                    <div>
                      <span className="panel-eyebrow">YOUR RELATIONSHIPS</span>
                      <h2>Recent customers</h2>
                    </div>
                    <button className="panel-link" onClick={() => setSection('Customers')}>
                      View all <ArrowRight size={14} />
                    </button>
                  </div>
                  <CustomerList customers={data.customers.slice(0, 4)} />
                </article>
                <article className="trust-panel">
                  <span className="trust-shield">
                    <ShieldCheck size={19} />
                  </span>
                  <div>
                    <h3>Trust built into every transaction</h3>
                    <p>
                      Payments are recorded in a permanent ledger. Corrections are made through
                      reversals, not deletion.
                    </p>
                    <button onClick={() => setSection('Audit logs')}>
                      Explore audit trail <ArrowRight size={13} />
                    </button>
                  </div>
                </article>
              </div>
            </>
          )}
          {section === 'Invoices' && (
            <>
              <div className="table-toolbar">
                <label className="search-box">
                  <Search size={16} />
                  <input
                    aria-label="Search invoices or customers"
                    placeholder="Search invoices or customers"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                  />
                </label>
                <label className="sr-only" htmlFor="invoice-status-filter">
                  Filter invoices by status
                </label>
                <select
                  id="invoice-status-filter"
                  className="filter-select"
                  value={invoiceStatusFilter}
                  onChange={(event) => setInvoiceStatusFilter(event.target.value)}
                >
                  <option value="all">All statuses</option>
                  <option value="draft">Draft</option>
                  <option value="issued">Issued</option>
                  <option value="partially_paid">Partially paid</option>
                  <option value="paid">Paid</option>
                  <option value="overdue">Overdue</option>
                </select>
              </div>
              <InvoiceTable
                invoices={visibleInvoices}
                onPayment={openPayment}
                onIssue={(id) => void issueInvoice(id)}
                onCancel={cancelInvoiceHandler}
              />
            </>
          )}
          {section === 'Customers' && (
            <>
              <div className="table-toolbar">
                <label className="search-box">
                  <Search size={16} />
                  <input
                    aria-label="Search customers"
                    placeholder="Search customers"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                  />
                </label>
                <button
                  className="primary-button"
                  onClick={() => {
                    setSelectedCustomer(null);
                    setModal('customer');
                  }}
                >
                  <Plus size={16} /> Add customer
                </button>
              </div>
              <div className="panel data-panel">
                <CustomerTable
                  customers={visibleCustomers}
                  onEdit={(customer) => {
                    setSelectedCustomer(customer);
                    setModal('customer');
                  }}
                />
              </div>
            </>
          )}
          {section === 'Payments' && (
            <>
              <div className="module-banner">
                <span className="module-icon">
                  <CreditCard size={20} />
                </span>
                <div>
                  <strong>Keep your books balanced</strong>
                  <p>
                    Record full or partial customer payments and match them to an invoice. Every
                    confirmed payment creates a numbered receipt.
                  </p>
                </div>
                <button className="primary-button" onClick={() => openPayment()}>
                  <Plus size={16} /> Record payment
                </button>
              </div>
              <RecentInvoices
                invoices={visibleInvoices}
                onView={() => setSection('Invoices')}
                onPayment={openPayment}
              />
            </>
          )}
          {section === 'Receipts' && (
            <section className="panel data-panel receipt-register">
              <div className="panel-heading receipt-heading">
                <div>
                  <span className="panel-eyebrow">CONFIRMED PAYMENTS</span>
                  <h2>Receipt register</h2>
                </div>
                <button
                  className="primary-button"
                  onClick={() => {
                    setSection('Payments');
                    openPayment();
                  }}
                >
                  <Plus size={16} /> Record payment
                </button>
              </div>
              <div className="table-toolbar">
                <label className="search-box">
                  <Search size={16} />
                  <input
                    aria-label="Search receipts"
                    placeholder="Search receipts"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                  />
                </label>
                <select
                  aria-label="Sort receipts"
                  className="filter-select"
                  value={receiptSort}
                  onChange={(event) => setReceiptSort(event.target.value as ReceiptSort)}
                >
                  <option value="newest">Newest first</option>
                  <option value="oldest">Oldest first</option>
                  <option value="amount-high">Highest amount</option>
                  <option value="amount-low">Lowest amount</option>
                </select>
              </div>
              <div className="invoice-table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>RECEIPT</th>
                      <th>CUSTOMER</th>
                      <th>PAYMENT DATE</th>
                      <th>METHOD</th>
                      <th className="amount-col">AMOUNT · UGX</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {visibleReceipts.map((receipt) => (
                      <tr key={receipt.id}>
                        <td>
                          <strong className="invoice-number">{receipt.number}</strong>
                        </td>
                        <td>{receipt.customer}</td>
                        <td>{formatReceiptDate(receipt.paidAt)}</td>
                        <td>{receipt.method}</td>
                        <td className="amount-col">
                          <strong>{money(receipt.amount)}</strong>
                        </td>
                        <td>
                          <button
                            className="row-action receipt-view-button"
                            onClick={() => setSelectedReceipt(receipt)}
                            aria-label={`View receipt ${receipt.number}`}
                          >
                            <FileText size={15} />
                          </button>
                          {receipt.status === 'issued' && (
                            <button
                              className="row-action"
                              onClick={() => voidReceiptHandler(receipt.id)}
                              aria-label={`Void receipt ${receipt.number}`}
                            >
                              <X size={15} />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {visibleReceipts.length === 0 && (
                  <EmptyRows
                    label={
                      query
                        ? 'No receipts match your search.'
                        : 'Receipts will appear as you record customer payments.'
                    }
                  />
                )}
              </div>
            </section>
          )}
          {section === 'Refunds' && (
            <RefundsPanel
              refunds={data.refunds}
              onRequestRefund={requestRefund}
              onDecideRefund={decideRefund}
              onCompleteRefund={completeRefundHandler}
              busy={busy}
            />
          )}
          {section === 'Products & services' && (
            <CataloguePanel
              items={data.catalogue.filter((item) =>
                `${item.name} ${item.description || ''} ${item.status}`
                  .toLowerCase()
                  .includes(query.toLowerCase()),
              )}
              query={query}
              onQueryChange={setQuery}
              onCreate={() => {
                setSelectedCatalogue(null);
                setModal('catalogue');
              }}
              onEdit={(item) => {
                setSelectedCatalogue(item);
                setModal('catalogue');
              }}
              onToggle={async (item) => {
                setError('');
                try {
                  await setCatalogueItemStatus({
                    id: item.id,
                    status: item.status === 'active' ? 'inactive' : 'active',
                  });
                  setToast(
                    item.status === 'active'
                      ? 'Catalogue item archived.'
                      : 'Catalogue item reactivated.',
                  );
                  router.refresh();
                } catch (cause) {
                  setError(
                    cause instanceof Error ? cause.message : 'Could not update catalogue item.',
                  );
                }
              }}
            />
          )}
          {[
            'Expenses',
            'Reports',
            'Notifications',
            'User management',
            'Audit logs',
            'Settings',
            'Service Desk',
            'Client Portal',
          ].includes(section) && (
            <ModulePanel
              section={section}
              data={data}
              business={data.business}
              businessEdit={businessEdit}
              setBusinessEdit={setBusinessEdit}
              saveBusinessSettings={saveBusinessSettings}
              busy={busy}
              onCreateExpense={() => setModal('expense')}
            />
          )}
        </div>
      </main>
      {modal && (
        <div
          className="modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setModal(null);
              setError('');
            }
          }}
        >
          <section
            className="modal-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-title"
          >
            <div className="modal-heading">
              <div>
                <span className="panel-eyebrow">
                  JITHUB-TEQ ·{' '}
                  {modal === 'invoice'
                    ? 'BILLING'
                    : modal === 'payment'
                      ? 'RECEIVABLES'
                      : modal === 'expense'
                        ? 'OUTGOINGS'
                        : modal === 'catalogue'
                          ? 'CATALOGUE'
                          : 'DIRECTORY'}
                </span>
                <h2 id="modal-title">
                  {modal === 'invoice'
                    ? 'Create invoice'
                    : modal === 'payment'
                      ? 'Record a payment'
                      : modal === 'expense'
                        ? 'Record an expense'
                        : modal === 'catalogue'
                          ? selectedCatalogue
                            ? 'Edit catalogue item'
                            : 'Add catalogue item'
                          : selectedCustomer
                            ? 'Edit customer'
                            : 'Add a customer'}
                </h2>
              </div>
              <button
                className="icon-button"
                onClick={() => {
                  setModal(null);
                  setError('');
                }}
                aria-label="Close dialog"
              >
                <X size={18} />
              </button>
            </div>
            <form onSubmit={submitForm} className="modal-form">
              {modal === 'customer' && (
                <>
                  <label>
                    Customer name
                    <input
                      name="name"
                      defaultValue={selectedCustomer?.name || ''}
                      placeholder="e.g. Amina Enterprises"
                      required
                      minLength={2}
                    />
                  </label>
                  <div className="form-two">
                    <label>
                      Email address
                      <input
                        name="email"
                        type="email"
                        defaultValue={selectedCustomer?.email || ''}
                        placeholder="accounts@business.com"
                      />
                    </label>
                    <label>
                      Phone number
                      <input
                        name="phone"
                        defaultValue={selectedCustomer?.phone || ''}
                        placeholder="+256 700 000 000"
                      />
                    </label>
                  </div>
                  <label>
                    Business address
                    <input
                      name="address"
                      defaultValue={selectedCustomer?.address || ''}
                      placeholder="Street, city, country"
                    />
                  </label>
                </>
              )}
              {modal === 'invoice' && (
                <>
                  <label>
                    Customer
                    <select name="customerId" required defaultValue="">
                      <option value="" disabled>
                        Select a customer
                      </option>
                      {data.customers.map((customer) => (
                        <option key={customer.id} value={customer.id}>
                          {customer.name}
                        </option>
                      ))}
                    </select>
                    {data.customers.length === 0 && (
                      <small className="field-hint">
                        Add a customer before creating an invoice.
                      </small>
                    )}
                  </label>
                  <label>
                    Item description
                    <input name="description" placeholder="Consulting service" required />
                  </label>
                  <div className="form-three">
                    <label>
                      Quantity
                      <input
                        name="quantity"
                        type="number"
                        min="0.001"
                        step="0.001"
                        defaultValue="1"
                        required
                      />
                    </label>
                    <label>
                      Unit price · UGX
                      <input name="unitPrice" inputMode="decimal" placeholder="350000" required />
                    </label>
                    <label>
                      Tax rate · %
                      <input
                        name="taxRate"
                        type="number"
                        min="0"
                        max="100"
                        step="0.01"
                        defaultValue="0"
                        required
                      />
                    </label>
                  </div>
                  <label>
                    Due date
                    <input
                      name="dueDate"
                      type="date"
                      min={todayISO()}
                      max={maxDueDateISO()}
                      required
                    />
                  </label>
                  <p className="form-footnote">
                    <ShieldCheck size={14} /> Issued invoices preserve their original financial
                    history.
                  </p>
                </>
              )}
              {modal === 'payment' && (
                <>
                  <label>
                    Outstanding invoice
                    <select name="invoiceId" required defaultValue={selectedInvoiceId}>
                      <option value="" disabled>
                        Select an invoice
                      </option>
                      {data.invoices
                        .filter(
                          (invoice) =>
                            !['draft', 'cancelled'].includes(invoice.status) &&
                            Number(invoice.total) > Number(invoice.amountPaid),
                        )
                        .map((invoice) => (
                          <option key={invoice.id} value={invoice.id}>
                            {invoice.number} · {invoice.customer} ·{' '}
                            {money(Number(invoice.total) - Number(invoice.amountPaid))} due
                          </option>
                        ))}
                    </select>
                    {data.invoices.every(
                      (invoice) =>
                        ['draft', 'cancelled'].includes(invoice.status) ||
                        Number(invoice.total) <= Number(invoice.amountPaid),
                    ) && (
                      <small className="field-hint">
                        There are no outstanding invoices to collect.
                      </small>
                    )}
                  </label>
                  <div className="form-two">
                    <label>
                      Amount received · UGX
                      <input name="amount" inputMode="decimal" placeholder="250000" required />
                    </label>
                    <label>
                      Payment method
                      <select name="method" defaultValue="Mobile Money">
                        <option>Cash</option>
                        <option>Bank transfer</option>
                        <option>Mobile Money</option>
                        <option>Card</option>
                        <option>Cheque</option>
                        <option>Other</option>
                      </select>
                    </label>
                  </div>
                  <div className="form-two">
                    <label>
                      Payment date
                      <input name="paidAt" type="date" defaultValue={todayISO()} required />
                    </label>
                    <label>
                      Reference (optional)
                      <input name="reference" placeholder="Transaction reference" />
                    </label>
                  </div>
                  <p className="form-footnote">
                    <ShieldCheck size={14} /> Recording creates a permanent payment and receipt
                    record.
                  </p>
                </>
              )}
              {modal === 'expense' && (
                <>
                  <div className="form-two">
                    <label>
                      Category
                      <input name="category" placeholder="e.g. Transport" required minLength={2} />
                    </label>
                    <label>
                      Supplier / payee
                      <input name="payee" placeholder="Business name" required minLength={2} />
                    </label>
                  </div>
                  <label>
                    Description (optional)
                    <input name="description" placeholder="What was this expense for?" />
                  </label>
                  <div className="form-two">
                    <label>
                      Amount · UGX
                      <input name="amount" inputMode="decimal" placeholder="50000" required />
                    </label>
                    <label>
                      Payment method
                      <select name="method" defaultValue="Mobile Money">
                        <option>Cash</option>
                        <option>Bank transfer</option>
                        <option>Mobile Money</option>
                        <option>Card</option>
                        <option>Cheque</option>
                        <option>Other</option>
                      </select>
                    </label>
                  </div>
                  <label>
                    Payment date
                    <input name="paidAt" type="date" defaultValue={todayISO()} required />
                  </label>
                </>
              )}
              {modal === 'catalogue' && (
                <>
                  <label>
                    Product or service name
                    <input
                      name="name"
                      defaultValue={selectedCatalogue?.name || ''}
                      placeholder="e.g. Business consulting"
                      required
                      minLength={2}
                      maxLength={160}
                    />
                  </label>
                  <label>
                    Description
                    <input
                      name="description"
                      defaultValue={selectedCatalogue?.description || ''}
                      placeholder="What does this item include?"
                      maxLength={500}
                    />
                  </label>
                  <label>
                    Unit price · UGX
                    <input
                      name="unitPrice"
                      defaultValue={selectedCatalogue?.unitPrice || ''}
                      inputMode="decimal"
                      placeholder="350000.00"
                      required
                    />
                  </label>
                  <p className="form-footnote">
                    <ShieldCheck size={14} /> Archiving an item keeps it available on historical
                    invoices.
                  </p>
                </>
              )}
              {error && (
                <p className="form-error" role="alert">
                  {error}
                </p>
              )}
              <div className="modal-actions">
                <button
                  className="button-secondary"
                  type="button"
                  onClick={() => {
                    setModal(null);
                    setSelectedCatalogue(null);
                    setSelectedCustomer(null);
                  }}
                >
                  Cancel
                </button>
                {modal === 'invoice' ? (
                  <>
                    <button
                      className="button-secondary"
                      type="submit"
                      name="invoiceStatus"
                      value="draft"
                      disabled={busy || !data.customers.length}
                    >
                      {busy ? 'Saving…' : 'Save draft'}
                    </button>
                    <button
                      className="primary-button"
                      type="submit"
                      name="invoiceStatus"
                      value="issued"
                      disabled={busy || !data.customers.length}
                    >
                      {busy ? 'Saving…' : 'Issue invoice'}
                      <ArrowRight size={15} />
                    </button>
                  </>
                ) : (
                  <button
                    className="primary-button"
                    type="submit"
                    disabled={
                      busy ||
                      (modal === 'payment' &&
                        !data.invoices.some(
                          (invoice) =>
                            !['draft', 'cancelled'].includes(invoice.status) &&
                            Number(invoice.total) > Number(invoice.amountPaid),
                        ))
                    }
                  >
                    {busy
                      ? 'Saving…'
                      : modal === 'payment'
                        ? 'Record payment'
                        : modal === 'expense'
                          ? 'Save expense'
                          : modal === 'catalogue'
                            ? 'Save catalogue item'
                            : selectedCustomer
                              ? 'Save customer changes'
                              : 'Save customer'}
                    <ArrowRight size={15} />
                  </button>
                )}
              </div>
            </form>
          </section>
        </div>
      )}
      {selectedReceipt && (
        <ReceiptDialog
          receipt={selectedReceipt}
          business={data.business}
          onClose={() => setSelectedReceipt(null)}
          onDownloadPdf={() => downloadReceiptPdf(selectedReceipt.id)}
          onDownloadThermal={(width) => downloadThermalReceipt(selectedReceipt.id, width)}
        />
      )}
      {toast && (
        <div role="status" className="toast-message">
          <span>
            <Check size={14} />
          </span>
          {toast}
          <button onClick={() => setToast('')} aria-label="Dismiss">
            <X size={15} />
          </button>
        </div>
      )}
    </div>
  );
}

function ReceiptDialog({
  receipt,
  business,
  onClose,
  onDownloadPdf,
  onDownloadThermal,
}: {
  receipt: Data['receipts'][number];
  business: Data['business'] | undefined;
  onClose: () => void;
  onDownloadPdf: () => void;
  onDownloadThermal: (width: 58 | 80) => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (!dialog.open) dialog.showModal();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeButtonRef.current?.focus();

    const handleCancel = (event: Event) => {
      event.preventDefault();
      onCloseRef.current();
    };
    dialog.addEventListener('cancel', handleCancel);

    return () => {
      dialog.removeEventListener('cancel', handleCancel);
      document.body.style.overflow = previousOverflow;
      if (dialog.open) dialog.close();
    };
  }, []);

  return (
    <dialog
      ref={dialogRef}
      className="receipt-dialog"
      aria-labelledby="receipt-title"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section className="modal-card receipt-modal">
        <div className="receipt-toolbar">
          <span className="panel-eyebrow">PAYMENT CONFIRMATION</span>
          <div>
            <button className="button-secondary" onClick={() => window.print()}>
              <Download size={14} /> Print
            </button>
            <button className="button-secondary" onClick={onDownloadPdf}>
              <Download size={14} /> PDF
            </button>
            <button className="button-secondary" onClick={() => onDownloadThermal(58 as 58 | 80)}>
              58mm
            </button>
            <button className="button-secondary" onClick={() => onDownloadThermal(80 as 58 | 80)}>
              80mm
            </button>
            <button
              ref={closeButtonRef}
              className="icon-button"
              onClick={onClose}
              aria-label="Close receipt"
            >
              <X size={18} />
            </button>
          </div>
        </div>
        <article className="receipt-document">
          <div className="receipt-brand">
            <span className="brand-mark">J</span>
            <div>
              <strong>{business?.name || 'JITHUB-TEQ'}</strong>
              <small>Beyond Technology, We Build Trust.</small>
            </div>
          </div>
          <div className="receipt-title">
            <span>OFFICIAL RECEIPT</span>
            <h2 id="receipt-title">{receipt.number}</h2>
            <span className={`status-pill status-${receipt.status || 'issued'}`}>
              <i />
              {receipt.status === 'voided' ? 'Voided' : 'Payment confirmed'}
            </span>
          </div>
          <div className="receipt-amount">
            <small>AMOUNT RECEIVED</small>
            <strong>{money(receipt.amount)}</strong>
          </div>
          <dl className="receipt-details">
            <div>
              <dt>Received from</dt>
              <dd>{receipt.customer}</dd>
            </div>
            <div>
              <dt>Payment date</dt>
              <dd>{formatReceiptDate(receipt.paidAt)}</dd>
            </div>
            <div>
              <dt>Payment method</dt>
              <dd>{receipt.method}</dd>
            </div>
            <div>
              <dt>Payment reference</dt>
              <dd>{receipt.reference || 'Not provided'}</dd>
            </div>
          </dl>
          <p className="receipt-thanks">Thank you for your payment.</p>
          <div className="receipt-foot">
            {business?.name || 'JITHUB-TEQ LTD'} <span>·</span> {business?.city || 'Kampala'},{' '}
            {business?.country || 'UGANDA'} <span>·</span> {business?.currency || 'UGX'}
          </div>
        </article>
      </section>
    </dialog>
  );
}

function CataloguePanel({
  items,
  query,
  onQueryChange,
  onCreate,
  onEdit,
  onToggle,
}: {
  items: CatalogueItem[];
  query: string;
  onQueryChange: (value: string) => void;
  onCreate: () => void;
  onEdit: (item: CatalogueItem) => void;
  onToggle: (item: CatalogueItem) => void;
}) {
  return (
    <>
      <div className="table-toolbar">
        <label className="search-box">
          <Search size={16} />
          <input
            aria-label="Search catalogue"
            placeholder="Search catalogue"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
          />
        </label>
        <button className="primary-button" onClick={onCreate}>
          <Plus size={16} /> Add item
        </button>
      </div>
      <div className="panel data-panel">
        <div className="invoice-table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>ITEM</th>
                <th>DESCRIPTION</th>
                <th className="amount-col">UNIT PRICE · UGX</th>
                <th>STATUS</th>
                <th className="catalogue-actions-heading">ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td>
                    <strong className="invoice-number">{item.name}</strong>
                  </td>
                  <td>{item.description || '—'}</td>
                  <td className="amount-col">
                    <strong>{money(item.unitPrice)}</strong>
                  </td>
                  <td>
                    <Status status={item.status} />
                  </td>
                  <td className="catalogue-actions">
                    <button
                      className="row-action"
                      onClick={() => onEdit(item)}
                      aria-label={`Edit ${item.name}`}
                    >
                      <FileText size={15} />
                    </button>
                    <button
                      className="row-action"
                      onClick={() => onToggle(item)}
                      aria-label={`${item.status === 'active' ? 'Archive' : 'Reactivate'} ${item.name}`}
                    >
                      <X size={15} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!items.length && (
            <EmptyRows
              label={
                query
                  ? 'No catalogue items match your search.'
                  : 'Add products and services to reuse their pricing on future invoices.'
              }
            />
          )}
        </div>
      </div>
    </>
  );
}

function Metric({
  label,
  value,
  icon: Icon,
  note,
  tone,
}: {
  label: string;
  value: string;
  icon: typeof FileText;
  note: string;
  tone: string;
}) {
  return (
    <article className="metric-card">
      <div className="metric-top">
        <span>{label}</span>
        <span className={`metric-icon metric-${tone}`}>
          <Icon size={17} />
        </span>
      </div>
      <strong className="metric-value">{value}</strong>
      <span className="metric-note">{note}</span>
    </article>
  );
}
function QuickAction({
  icon: Icon,
  title,
  detail,
  onClick,
}: {
  icon: typeof FileText;
  title: string;
  detail: string;
  onClick: () => void;
}) {
  return (
    <button className="quick-action" onClick={onClick}>
      <span className="quick-icon">
        <Icon size={16} />
      </span>
      <span className="quick-copy">
        <strong>{title}</strong>
        <small>{detail}</small>
      </span>
      <ArrowRight className="quick-arrow" size={15} />
    </button>
  );
}
function RevenueChart({ values }: { values: Data['trend'] }) {
  const months = useMemo(() => {
    const result = [];
    const now = new Date();
    for (let index = 5; index >= 0; index--) {
      const date = new Date(now.getFullYear(), now.getMonth() - index, 1);
      const label = new Intl.DateTimeFormat('en', { month: 'short' }).format(date);
      const found = values.find((item) => item.month.toLowerCase() === label.toLowerCase());
      result.push({ label, amount: Number(found?.amount || 0) });
    }
    return result;
  }, [values]);
  const max = Math.max(...months.map((month) => month.amount), 1);
  return (
    <div className="chart-area">
      <div className="chart-y-labels">
        <span>{money(max)}</span>
        <span>{money(max * 0.66)}</span>
        <span>{money(max * 0.33)}</span>
        <span>UGX 0</span>
      </div>
      <div className="chart-bars">
        {[0, 1, 2, 3].map((line) => (
          <span className="chart-gridline" key={line} style={{ bottom: `${line * 33.333}%` }} />
        ))}
        {months.map((month, index) => (
          <div className="chart-column" key={`${month.label}-${index}`}>
            <div
              className={`chart-bar ${month.amount ? '' : 'chart-bar-empty'}`}
              style={{ height: `${Math.max((month.amount / max) * 100, 3)}%` }}
              title={`${month.label}: ${money(month.amount)}`}
            />
            <span>{month.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
function RecentInvoices({
  invoices,
  onView,
  onPayment,
}: {
  invoices: Data['invoices'];
  onView: () => void;
  onPayment: (invoiceId: string) => void;
}) {
  return (
    <section className="panel invoice-panel">
      <div className="panel-heading">
        <div>
          <span className="panel-eyebrow">YOUR LATEST ACTIVITY</span>
          <h2>Recent invoices</h2>
        </div>
        <button className="panel-link" onClick={onView}>
          All invoices <ArrowRight size={14} />
        </button>
      </div>
      {invoices.length ? (
        <div className="invoice-table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>INVOICE</th>
                <th>CUSTOMER</th>
                <th>STATUS</th>
                <th>DUE DATE</th>
                <th className="amount-col">TOTAL · UGX</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {invoices.slice(0, 6).map((invoice) => (
                <tr key={invoice.id}>
                  <td>
                    <strong className="invoice-number">{invoice.number}</strong>
                  </td>
                  <td>{invoice.customer}</td>
                  <td>
                    <Status status={invoice.status} />
                  </td>
                  <td>
                    {new Date(`${invoice.dueDate}T12:00:00`).toLocaleDateString('en-GB', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </td>
                  <td className="amount-col">
                    <strong>{money(invoice.total)}</strong>
                  </td>
                  <td>
                    {invoice.status !== 'draft' &&
                    !['paid', 'cancelled'].includes(invoice.status) &&
                    Number(invoice.total) > Number(invoice.amountPaid) ? (
                      <button
                        className="row-action"
                        onClick={() => onPayment(invoice.id)}
                        aria-label={`Record payment for ${invoice.number}`}
                      >
                        <MoreHorizontal size={17} />
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyRows label="No invoices yet. Create an invoice to see your activity here." />
      )}
    </section>
  );
}
function InvoiceTable({
  invoices,
  onPayment,
  onIssue,
  onCancel,
}: {
  invoices: Data['invoices'];
  onPayment: (invoiceId: string) => void;
  onIssue: (invoiceId: string) => void;
  onCancel: (invoiceId: string) => void;
}) {
  return (
    <div className="panel data-panel">
      <div className="invoice-table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>INVOICE</th>
              <th>CUSTOMER</th>
              <th>ISSUED</th>
              <th>DUE DATE</th>
              <th>STATUS</th>
              <th className="amount-col">TOTAL · UGX</th>
              <th>ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            {invoices.map((invoice) => (
              <tr key={invoice.id}>
                <td>
                  <strong className="invoice-number">{invoice.number}</strong>
                </td>
                <td>{invoice.customer}</td>
                <td>{new Date(`${invoice.issueDate}T12:00:00`).toLocaleDateString('en-GB')}</td>
                <td>{new Date(`${invoice.dueDate}T12:00:00`).toLocaleDateString('en-GB')}</td>
                <td>
                  <Status status={invoice.status} />
                </td>
                <td className="amount-col">
                  <strong>{money(invoice.total)}</strong>
                </td>
                <td>
                  {invoice.status === 'draft' ? (
                    <>
                      <button
                        className="row-action"
                        onClick={() => onIssue(invoice.id)}
                        aria-label={`Issue invoice ${invoice.number}`}
                      >
                        <Check size={15} />
                      </button>
                      <button
                        className="row-action"
                        onClick={() => onCancel(invoice.id)}
                        aria-label={`Cancel invoice ${invoice.number}`}
                      >
                        <X size={15} />
                      </button>
                    </>
                  ) : !['paid', 'cancelled'].includes(invoice.status) &&
                    Number(invoice.total) > Number(invoice.amountPaid) ? (
                    Number(invoice.amountPaid) > 0 ? (
                      <button
                        className="row-action"
                        onClick={() => onPayment(invoice.id)}
                        aria-label={`Record payment for ${invoice.number}`}
                      >
                        <CreditCard size={15} />
                      </button>
                    ) : (
                      <button
                        className="row-action"
                        onClick={() => onCancel(invoice.id)}
                        aria-label={`Cancel invoice ${invoice.number}`}
                      >
                        <X size={15} />
                      </button>
                    )
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!invoices.length && <EmptyRows label="No invoices match your search." />}
      </div>
    </div>
  );
}
function CustomerList({ customers }: { customers: Data['customers'] }) {
  return customers.length ? (
    <div className="customer-list">
      {customers.map((customer) => (
        <div className="customer-list-item" key={customer.id}>
          <span className="customer-avatar">{customer.name.slice(0, 1).toUpperCase()}</span>
          <span>
            <strong>{customer.name}</strong>
            <small>{customer.email || customer.phone || 'Customer account'}</small>
          </span>
          <ArrowRight size={15} />
        </div>
      ))}
    </div>
  ) : (
    <EmptyRows label="Customers you add will appear here." />
  );
}
function CustomerTable({
  customers,
  onEdit,
}: {
  customers: Data['customers'];
  onEdit: (customer: Data['customers'][number]) => void;
}) {
  return (
    <div className="invoice-table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            <th>CUSTOMER</th>
            <th>EMAIL</th>
            <th>PHONE</th>
            <th>ADDED</th>
            <th>STATUS</th>
            <th>
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {customers.map((customer) => (
            <tr key={customer.id}>
              <td>
                <span className="customer-cell">
                  <span className="customer-avatar">{customer.name.slice(0, 1).toUpperCase()}</span>
                  <strong>{customer.name}</strong>
                </span>
              </td>
              <td>{customer.email || '—'}</td>
              <td>{customer.phone || '—'}</td>
              <td>{new Date(customer.createdAt).toLocaleDateString('en-GB')}</td>
              <td>
                <Status status="active" />
              </td>
              <td>
                <button
                  type="button"
                  className="row-action"
                  onClick={() => onEdit(customer)}
                  aria-label={`Edit ${customer.name}`}
                >
                  <Settings2 size={15} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {!customers.length && <EmptyRows label="Your customer directory is ready when you are." />}
    </div>
  );
}
function Status({ status }: { status: string }) {
  return (
    <span className={`status-pill status-${status.replaceAll('_', '-')}`}>
      <i />
      {titleCase(status)}
    </span>
  );
}
function EmptyRows({ label }: { label: string }) {
  return (
    <div className="empty-rows">
      <span className="empty-dot">
        <BookOpenCheck size={17} />
      </span>
      <p>{label}</p>
    </div>
  );
}
function ModulePanel({
  section,
  data,
  business,
  businessEdit,
  setBusinessEdit,
  saveBusinessSettings,
  busy,
  onCreateExpense,
}: {
  section: Section;
  data: Data;
  business: Data['business'] | undefined;
  businessEdit: {
    name: string;
    email: string;
    phone: string;
    address: string;
    city: string;
    country: string;
    currency: string;
    receiptPrefix: string;
    invoicePrefix: string;
  } | null;
  setBusinessEdit: (
    value: {
      name: string;
      email: string;
      phone: string;
      address: string;
      city: string;
      country: string;
      currency: string;
      receiptPrefix: string;
      invoicePrefix: string;
    } | null,
  ) => void;
  saveBusinessSettings: () => void;
  busy: boolean;
  onCreateExpense: () => void;
}) {
  const [reportDays, setReportDays] = useState<'30' | '90' | '365' | 'all'>('all');
  const [reportData, setReportData] = useState<Awaited<
    ReturnType<typeof getFinancialReport>
  > | null>(null);
  const [reportError, setReportError] = useState('');
  const [reportLoading, setReportLoading] = useState(false);
  const reports = [
    {
      label: 'Total invoiced',
      value: money(reportData?.invoiced ?? data.summary?.invoiced ?? 0),
      icon: FileText,
    },
    {
      label: 'Payments received',
      value: money(reportData?.received ?? data.summary?.received ?? 0),
      icon: ArrowDownLeft,
    },
    {
      label: 'Outstanding balance',
      value: money(reportData?.outstanding ?? data.summary?.outstanding ?? 0),
      icon: WalletCards,
    },
  ];
  const reportInvoices = reportData
    ? reportData.invoices.map((item) => ({
        number: item.number,
        customer: item.customer,
        status: item.status,
        issueDate: item.date,
        total: item.total,
      }))
    : data.invoices.map((item) => ({
        number: item.number,
        customer: item.customer,
        status: item.status,
        issueDate: item.issueDate,
        total: item.total,
      }));

  async function loadReport(period: '30' | '90' | '365' | 'all') {
    setReportDays(period);
    setReportLoading(true);
    setReportError('');
    try {
      setReportData(await getFinancialReport(period));
    } catch (cause) {
      setReportError(cause instanceof Error ? cause.message : 'Could not load this report.');
    } finally {
      setReportLoading(false);
    }
  }

  async function exportReport() {
    setReportLoading(true);
    setReportError('');
    try {
      const result = reportData || (await getFinancialReport(reportDays));
      setReportData(result);
      const rows: (string | number | null)[][] = [
        [
          'Record type',
          'Document',
          'Customer or payee',
          'Date',
          'Status or method',
          'Reference',
          'Amount UGX',
          'Paid UGX',
          'Outstanding UGX',
        ],
        ...result.invoices.map((item) => [
          'Invoice',
          item.number,
          item.customer,
          item.date,
          item.status,
          '',
          item.total,
          item.paid,
          (Number(item.total) - Number(item.paid)).toFixed(2),
        ]),
        ...result.payments.map((item) => [
          'Receipt',
          item.receipt,
          item.customer,
          item.date,
          item.method,
          item.reference,
          item.amount,
          '',
          '',
        ]),
        ...result.expenses.map((item) => [
          'Expense',
          item.category,
          item.payee,
          item.date,
          item.method,
          '',
          item.amount,
          '',
          '',
        ]),
      ];
      const csv = rows
        .map((row) => row.map((cell) => `"${String(cell ?? '').replaceAll('"', '""')}"`).join(','))
        .join('\n');
      const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = `jithub-teq-financial-report-${reportDays}-days.csv`;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 0);
    } catch (cause) {
      setReportError(cause instanceof Error ? cause.message : 'Could not export this report.');
    } finally {
      setReportLoading(false);
    }
  }
  if (section === 'Reports')
    return (
      <>
        <div className="report-filter">
          <label htmlFor="report-period">
            Reporting period
            <select
              id="report-period"
              value={reportDays}
              onChange={(event) =>
                void loadReport(event.target.value as '30' | '90' | '365' | 'all')
              }
            >
              <option value="all">All time</option>
              <option value="30">Last 30 days</option>
              <option value="90">Last 90 days</option>
              <option value="365">Last 12 months</option>
            </select>
          </label>
          <button
            className="button-secondary"
            onClick={() => void exportReport()}
            disabled={reportLoading}
          >
            <Download size={15} />
            {reportLoading ? 'Preparing…' : 'Export CSV'}
          </button>
        </div>
        {reportError && (
          <p className="form-error" role="alert">
            {reportError}
          </p>
        )}
        <div className="report-card-grid">
          {reports.map((item) => (
            <Metric
              key={item.label}
              {...item}
              note={
                reportData?.summary?.startDate
                  ? `Since ${reportData.summary.startDate}`
                  : 'All recorded transactions'
              }
              tone="teal"
            />
          ))}
        </div>
        <div className="panel data-panel">
          <div className="invoice-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>INVOICE</th>
                  <th>CUSTOMER</th>
                  <th>STATUS</th>
                  <th>ISSUED</th>
                  <th className="amount-col">TOTAL · UGX</th>
                </tr>
              </thead>
              <tbody>
                {reportInvoices.map((invoice) => (
                  <tr key={invoice.number}>
                    <td>
                      <strong className="invoice-number">{invoice.number}</strong>
                    </td>
                    <td>{invoice.customer}</td>
                    <td>
                      <Status status={invoice.status} />
                    </td>
                    <td>{new Date(`${invoice.issueDate}T12:00:00`).toLocaleDateString('en-GB')}</td>
                    <td className="amount-col">
                      <strong>{money(invoice.total)}</strong>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {reportData && !reportData.invoices.length && (
              <EmptyRows label="No issued invoices were found in this period." />
            )}
          </div>
        </div>
      </>
    );
  if (section === 'Expenses')
    return (
      <>
        <div className="module-banner">
          <span className="module-icon">
            <WalletCards size={20} />
          </span>
          <div>
            <strong>Business expense ledger</strong>
            <p>Outgoing payments stay separate from customer receipts.</p>
          </div>
          <button className="primary-button" onClick={onCreateExpense}>
            <Plus size={16} /> Record expense
          </button>
        </div>
        <div className="panel data-panel">
          <div className="invoice-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>DATE</th>
                  <th>CATEGORY</th>
                  <th>SUPPLIER / PAYEE</th>
                  <th>PAYMENT METHOD</th>
                  <th className="amount-col">AMOUNT · UGX</th>
                </tr>
              </thead>
              <tbody>
                {data.expenses.map((expense) => (
                  <tr key={expense.id}>
                    <td>{new Date(`${expense.paidAt}T12:00:00`).toLocaleDateString('en-GB')}</td>
                    <td>{expense.category}</td>
                    <td>
                      <strong className="invoice-number">{expense.payee}</strong>
                    </td>
                    <td>{expense.method}</td>
                    <td className="amount-col">
                      <strong>{money(expense.amount)}</strong>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!data.expenses.length && (
              <EmptyRows label="Expenses appear here after you record them." />
            )}
          </div>
        </div>
      </>
    );
  if (section === 'Audit logs')
    return (
      <div className="panel data-panel">
        <div className="invoice-table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>DATE & TIME</th>
                <th>ACTION</th>
                <th>RECORD TYPE</th>
                <th>RECORD ID</th>
              </tr>
            </thead>
            <tbody>
              {data.auditTrail.map((entry) => (
                <tr key={entry.id}>
                  <td>{new Date(entry.createdAt).toLocaleString('en-GB')}</td>
                  <td>
                    <strong className="invoice-number">{titleCase(entry.action)}</strong>
                  </td>
                  <td>{titleCase(entry.entityType)}</td>
                  <td>{entry.entityId}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!data.auditTrail.length && (
            <EmptyRows label="Financial and customer activity will be recorded here." />
          )}
        </div>
      </div>
    );
  const copy: Record<string, [typeof Package, string, string]> = {
    Notifications: [
      Bell,
      'You’re all caught up',
      'Payment, receipt and invoice activity will surface here as it happens.',
    ],
    'User management': [
      ShieldCheck,
      'Your workspace is protected',
      'You are signed in as the workspace owner. Role-based invitations can be added as your team grows.',
    ],
    Settings: [
      BriefcaseBusiness,
      'Business profile',
      'Configure your business identity, branding and document numbering.',
    ],
    'Service Desk': [Headset, 'Service Desk', 'Manage service tickets, clients, and SLA policies.'],
    'Client Portal': [
      BriefcaseBusiness,
      'Client Portal',
      'Client-facing portal for service requests and support.',
    ],
  };
  const [Icon, title, description] = copy[section] || [
    Package,
    section,
    'Keep your business operations organized.',
  ];
  return (
    <div className="module-card">
      <span className="module-icon">
        <Icon size={21} />
      </span>
      <div>
        <span className="panel-eyebrow">BUSINESS WORKSPACE</span>
        <h2>{title}</h2>
        <p>{description}</p>
        {section === 'Settings' && (
          <div className="settings-section">
            <BusinessSettingsForm
              business={business}
              onEdit={() =>
                setBusinessEdit({
                  name: business?.name || '',
                  email: business?.email || '',
                  phone: business?.phone || '',
                  address: business?.address || '',
                  city: business?.city || '',
                  country: business?.country || 'Uganda',
                  currency: business?.currency || 'UGX',
                  receiptPrefix: business?.receiptPrefix || 'RCP',
                  invoicePrefix: business?.invoicePrefix || 'INV',
                })
              }
              editing={businessEdit}
              onSave={saveBusinessSettings}
              onCancel={() => setBusinessEdit(null)}
              busy={busy}
            />
            <div className="members-link" style={{ marginTop: 20 }}>
              <a href={`/business/members/${business?.id}`} className="button-secondary">
                <Plus size={15} /> Manage business members
              </a>
            </div>
          </div>
        )}
        {section === 'Service Desk' && (
          <div className="settings-section" style={{ marginTop: 20 }}>
            <a href="/service-desk" className="button-secondary">
              <Headset size={15} /> Open Service Desk
            </a>
            <a href="/service-desk/tickets" className="button-secondary">
              <FileText size={15} /> View Tickets
            </a>
            <a href="/service-desk/clients" className="button-secondary">
              <Users size={15} /> Manage Clients
            </a>
            <a href="/service-desk/settings" className="button-secondary">
              <Settings2 size={15} /> SLA Policies
            </a>
          </div>
        )}
        {section === 'Client Portal' && (
          <div className="settings-section" style={{ marginTop: 20 }}>
            <a href="/portal" className="button-secondary">
              <BriefcaseBusiness size={15} /> Open Client Portal
            </a>
            <a href="/portal/tickets" className="button-secondary">
              <FileText size={15} /> Client Tickets
            </a>
          </div>
        )}
      </div>
      <span className="module-decoration">
        <Building2 size={90} />
      </span>
    </div>
  );
}

function BusinessSettingsForm({
  business,
  onEdit,
  editing,
  onSave,
  onCancel,
  busy,
}: {
  business: Data['business'] | undefined;
  onEdit: () => void;
  editing: {
    name: string;
    email: string;
    phone: string;
    address: string;
    city: string;
    country: string;
    currency: string;
    receiptPrefix: string;
    invoicePrefix: string;
  } | null;
  onSave: () => void;
  onCancel: () => void;
  busy: boolean;
}) {
  const [logoUploading, setLogoUploading] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string | null>(business?.logoUrl || null);

  async function handleLogoUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      alert('Logo must be 2 MB or smaller.');
      return;
    }
    if (
      !['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/svg+xml'].includes(file.type)
    ) {
      alert('Unsupported file type. Use PNG, JPEG, WebP or SVG.');
      return;
    }
    setLogoUploading(true);
    try {
      const formData = new FormData();
      formData.append('logo', file);
      const res = await fetch('/api/upload/logo', {
        method: 'POST',
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Logo upload failed');
      }
      const data = await res.json();
      setLogoUrl(data.logoUrl);
    } catch (cause) {
      alert(cause instanceof Error ? cause.message : 'Logo upload failed');
    } finally {
      setLogoUploading(false);
    }
  }
  const initial = {
    name: business?.name || '',
    email: business?.email || '',
    phone: business?.phone || '',
    address: business?.address || '',
    city: business?.city || '',
    country: business?.country || 'Uganda',
    currency: business?.currency || 'UGX',
    receiptPrefix: business?.receiptPrefix || 'RCP',
    invoicePrefix: business?.invoicePrefix || 'INV',
  };
  const values = editing ?? initial;
  return (
    <div className="panel data-panel">
      <div className="panel-heading">
        <div>
          <span className="panel-eyebrow">BUSINESS PROFILE</span>
          <h2>Business Settings</h2>
        </div>
        {editing ? (
          <button className="primary-button" onClick={onCancel}>
            <X size={15} /> Cancel
          </button>
        ) : (
          <button className="primary-button" onClick={onEdit}>
            <Plus size={15} /> Edit profile
          </button>
        )}
      </div>
      {editing && (
        <div className="setting-rows">
          <label className="logo-upload">
            <span>Business logo</span>
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              onChange={handleLogoUpload}
              disabled={logoUploading}
            />
            {logoUploading ? <span>Uploading…</span> : null}
          </label>
          {logoUrl && (
            <div className="logo-preview">
              <img
                src={logoUrl}
                alt="Business logo"
                style={{ maxWidth: 120, maxHeight: 60, marginTop: 8 }}
              />
              <button
                className="button-secondary"
                type="button"
                onClick={() => setLogoUrl(null)}
                style={{ marginTop: 6 }}
              >
                Remove
              </button>
            </div>
          )}
        </div>
      )}
      <form
        onSubmit={(event) => {
          event.preventDefault();
          onSave();
        }}
        className="modal-form"
      >
        <div className="form-two">
          <label>
            Business name
            <input
              name="name"
              defaultValue={values.name}
              required
              minLength={2}
              maxLength={160}
              disabled={!editing}
            />
          </label>
          <label>
            Legal name
            <input name="legalName" defaultValue={business?.legalName || ''} disabled={!editing} />
          </label>
        </div>
        <div className="form-two">
          <label>
            Email
            <input name="email" type="email" defaultValue={values.email} disabled={!editing} />
          </label>
          <label>
            Phone
            <input name="phone" defaultValue={values.phone} disabled={!editing} />
          </label>
        </div>
        <div className="form-two">
          <label>
            Address
            <input name="address" defaultValue={values.address} disabled={!editing} />
          </label>
          <label>
            City
            <input name="city" defaultValue={values.city} disabled={!editing} />
          </label>
        </div>
        <div className="form-two">
          <label>
            Country
            <input name="country" defaultValue={values.country} disabled={!editing} />
          </label>
          <label>
            Currency
            <input name="currency" defaultValue={values.currency} disabled={!editing} />
          </label>
        </div>
        <div className="form-two">
          <label>
            Receipt prefix
            <input
              name="receiptPrefix"
              defaultValue={values.receiptPrefix}
              maxLength={10}
              disabled={!editing}
            />
          </label>
          <label>
            Invoice prefix
            <input
              name="invoicePrefix"
              defaultValue={values.invoicePrefix}
              maxLength={10}
              disabled={!editing}
            />
          </label>
        </div>
        {editing && (
          <div className="modal-actions">
            <button className="button-secondary" type="button" onClick={onCancel}>
              Cancel
            </button>
            <button className="primary-button" type="submit">
              {busy ? 'Saving…' : 'Save profile'}
            </button>
          </div>
        )}
      </form>
    </div>
  );
}

function RefundsPanel({
  refunds,
  onRequestRefund,
  onDecideRefund,
  onCompleteRefund,
  busy,
}: {
  refunds: Data['refunds'];
  onRequestRefund: (
    amount: string,
    reason: string,
    method: string,
    reference: string,
    paymentId: string,
  ) => void;
  onDecideRefund: (refundId: string, approve: boolean) => void;
  onCompleteRefund: (refundId: string) => void;
  busy: boolean;
}) {
  const [refundForm, setRefundForm] = useState<{
    paymentId: string;
    amount: string;
    reason: string;
    method: string;
    reference: string;
  } | null>(null);
  return (
    <div className="panel data-panel">
      <div className="panel-heading">
        <div>
          <span className="panel-eyebrow">REFUNDS</span>
          <h2>Refund Management</h2>
        </div>
        <button
          className="primary-button"
          onClick={() =>
            setRefundForm(
              refundForm
                ? null
                : {
                    paymentId: '',
                    amount: '',
                    reason: '',
                    method: '',
                    reference: '',
                  },
            )
          }
        >
          {refundForm ? (
            'Close'
          ) : (
            <>
              <Plus size={15} /> Request refund
            </>
          )}
        </button>
      </div>
      {refundForm && (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            onRequestRefund(
              refundForm.amount,
              refundForm.reason,
              refundForm.method,
              refundForm.reference,
              refundForm.paymentId,
            );
          }}
          className="modal-form"
        >
          <div className="form-two">
            <label>
              Payment ID
              <input name="paymentId" defaultValue={refundForm.paymentId} required />
            </label>
            <label>
              Amount · UGX
              <input name="amount" inputMode="decimal" required />
            </label>
          </div>
          <label>
            Reason
            <input name="reason" required minLength={2} />
          </label>
          <div className="form-two">
            <label>
              Method
              <select name="method" required>
                <option value="">Select method</option>
                <option>Cash</option>
                <option>Bank transfer</option>
                <option>Mobile Money</option>
                <option>Card</option>
                <option>Cheque</option>
                <option>Other</option>
              </select>
            </label>
            <label>
              Reference
              <input name="reference" />
            </label>
          </div>
          <div className="modal-actions">
            <button className="button-secondary" type="button" onClick={() => setRefundForm(null)}>
              Cancel
            </button>
            <button className="primary-button" type="submit">
              {busy ? 'Requesting…' : 'Request refund'}
            </button>
          </div>
        </form>
      )}
      <div className="invoice-table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>REFUND ID</th>
              <th>AMOUNT · UGX</th>
              <th>REASON</th>
              <th>METHOD</th>
              <th>STATUS</th>
              <th>ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            {refunds.map((refund) => (
              <tr key={refund.id}>
                <td>
                  <strong className="invoice-number">{refund.id}</strong>
                </td>
                <td className="amount-col">
                  <strong>{money(refund.amount)}</strong>
                </td>
                <td>{refund.reason || '—'}</td>
                <td>{refund.method || '—'}</td>
                <td>
                  <Status status={refund.status} />
                </td>
                <td>
                  {refund.status === 'pending' ? (
                    <>
                      <button
                        className="row-action"
                        onClick={() => onDecideRefund(refund.id, true)}
                      >
                        Approve
                      </button>
                      <button
                        className="row-action"
                        onClick={() => onDecideRefund(refund.id, false)}
                      >
                        Reject
                      </button>
                    </>
                  ) : refund.status === 'approved' ? (
                    <button className="row-action" onClick={() => onCompleteRefund(refund.id)}>
                      Complete
                    </button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!refunds.length && <EmptyRows label="No refund requests have been made." />}
      </div>
    </div>
  );
}
