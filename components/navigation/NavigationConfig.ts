/**
 * Unified Navigation Configuration for JITHUB-TEQ
 * Single source of truth for all navigation items, permissions, and responsive behavior
 */

import type { Section } from '@/components/dashboard'
import {
  LayoutDashboard,
  FileText,
  CreditCard,
  ReceiptText,
  Users,
  Building2,
  ClipboardList,
  Package,
  WalletCards,
  Activity,
  Bell,
  ShieldCheck,
  FileClock,
  Settings2,
  MoreHorizontal,
  Search,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  X,
  Menu,
  Grid,
  List,
  Filter,
  ArrowLeft,
  ArrowRight,
  TicketPlus,
  Headset,
  BriefcaseBusiness,
  FileText as FileTextIcon,
} from 'lucide-react'

export interface NavigationItem {
  id: Section
  label: string
  icon: typeof LayoutDashboard
  group: 'WORKSPACE' | 'MANAGE' | 'ADMINISTRATION'
  href: string
  requiresPermission?: string
  badge?: string
  keyboardShortcut?: string
  mobilePriority: 'primary' | 'secondary' | 'more' // For bottom nav: primary=always visible, secondary=in More, more=only in More
  searchable: boolean
  searchKeywords: string[]
}

export const NAVIGATION_CONFIG: NavigationItem[] = [
  // WORKSPACE GROUP - Primary on mobile
  {
    id: 'Dashboard',
    label: 'Dashboard',
    icon: LayoutDashboard,
    group: 'WORKSPACE',
    href: '/',
    mobilePriority: 'primary',
    searchable: false,
    searchKeywords: ['overview', 'home', 'finances', 'summary'],
  },
  {
    id: 'Invoices',
    label: 'Invoices',
    icon: FileText,
    group: 'WORKSPACE',
    href: '/invoices',
    requiresPermission: 'invoice.create',
    badge: 'count',
    mobilePriority: 'primary',
    keyboardShortcut: 'âŒ˜I',
    searchable: true,
    searchKeywords: ['invoice', 'bill', 'billing', 'draft', 'issued', 'paid', 'overdue'],
  },
  {
    id: 'Payments',
    label: 'Payments',
    icon: CreditCard,
    group: 'WORKSPACE',
    href: '/payments',
    requiresPermission: 'payment.record',
    mobilePriority: 'primary',
    keyboardShortcut: 'âŒ˜P',
    searchable: true,
    searchKeywords: ['payment', 'receipt', 'collect', 'reconcile', 'incoming'],
  },
  {
    id: 'Receipts',
    label: 'Receipts',
    icon: ReceiptText,
    group: 'WORKSPACE',
    href: '/receipts',
    requiresPermission: 'receipt.void',
    mobilePriority: 'primary',
    searchable: true,
    searchKeywords: ['receipt', 'confirmation', 'proof', 'payment'],
  },
  {
    id: 'Customers',
    label: 'Customers',
    icon: Users,
    group: 'WORKSPACE',
    href: '/customers',
    requiresPermission: 'customer.manage',
    mobilePriority: 'primary',
    keyboardShortcut: 'âŒ˜U',
    searchable: true,
    searchKeywords: ['customer', 'client', 'directory', 'contact', 'accounts'],
  },

  // MANAGE GROUP - Secondary on mobile
  {
    id: 'Suppliers',
    label: 'Suppliers',
    icon: Building2,
    group: 'MANAGE',
    href: '/suppliers',
    requiresPermission: 'supplier.manage',
    mobilePriority: 'secondary',
    searchable: true,
    searchKeywords: ['supplier', 'vendor', 'procurement', 'purchase'],
  },
  {
    id: 'Purchase Orders',
    label: 'Purchase Orders',
    icon: ClipboardList,
    group: 'MANAGE',
    href: '/purchase-orders',
    requiresPermission: 'purchase_order.create',
    badge: 'beta',
    mobilePriority: 'secondary',
    searchable: true,
    searchKeywords: ['purchase order', 'po', 'supplier order', 'procurement'],
  },
  {
    id: 'Goods Receipts',
    label: 'Goods Receipts',
    icon: Package,
    group: 'MANAGE',
    href: '/goods-receipts',
    requiresPermission: 'goods_receipt.receive',
    mobilePriority: 'secondary',
    searchable: true,
    searchKeywords: ['goods receipt', 'receive', 'inventory', 'stock in', 'warehouse'],
  },
  {
    id: 'Stock Movements',
    label: 'Stock Movements',
    icon: WalletCards,
    group: 'MANAGE',
    href: '/stock-movements',
    requiresPermission: 'stock.adjust',
    mobilePriority: 'secondary',
    searchable: true,
    searchKeywords: ['stock', 'inventory', 'movement', 'adjustment', 'warehouse'],
  },
  {
    id: 'Products & services',
    label: 'Products & services',
    icon: Package,
    group: 'MANAGE',
    href: '/products-services',
    requiresPermission: 'catalogue.manage',
    mobilePriority: 'secondary',
    searchable: true,
    searchKeywords: ['product', 'service', 'catalogue', 'item', 'pricing'],
  },
  {
    id: 'Expenses',
    label: 'Expenses',
    icon: WalletCards,
    group: 'MANAGE',
    href: '/expenses',
    requiresPermission: 'expense.record',
    mobilePriority: 'secondary',
    keyboardShortcut: 'âŒ˜E',
    searchable: true,
    searchKeywords: ['expense', 'outgoing', 'payment', 'spend', 'cost'],
  },
  {
    id: 'Reports',
    label: 'Reports',
    icon: Activity,
    group: 'MANAGE',
    href: '/reports',
    requiresPermission: 'reports.read',
    mobilePriority: 'secondary',
    keyboardShortcut: 'âŒ˜R',
    searchable: true,
    searchKeywords: ['report', 'analytics', 'financial', 'summary', 'export', 'csv'],
  },
  {
    id: 'Service Desk',
    label: 'Service Desk',
    icon: Headset,
    group: 'MANAGE',
    href: '/service-desk',
    requiresPermission: 'service_ticket.read',
    mobilePriority: 'secondary',
    searchable: true,
    searchKeywords: ['service desk', 'support', 'ticket', 'helpdesk', 'sla', 'client portal'],
  },
  {
    id: 'Client Portal',
    label: 'Client Portal',
    icon: BriefcaseBusiness,
    group: 'MANAGE',
    href: '/portal',
    requiresPermission: 'service_ticket.read',
    mobilePriority: 'secondary',
    badge: 'external',
    searchable: true,
    searchKeywords: ['client portal', 'client', 'service request', 'support', 'ticket'],
  },

  // ADMINISTRATION GROUP - In "More" on mobile
  {
    id: 'Notifications',
    label: 'Notifications',
    icon: Bell,
    group: 'ADMINISTRATION',
    href: '/notifications',
    mobilePriority: 'more',
    searchable: false,
    searchKeywords: ['notification', 'alert', 'update'],
  },
  {
    id: 'User management',
    label: 'User management',
    icon: ShieldCheck,
    group: 'ADMINISTRATION',
    href: '/user-management',
    requiresPermission: 'membership.manage',
    mobilePriority: 'more',
    searchable: true,
    searchKeywords: ['user', 'member', 'team', 'role', 'permission', 'access'],
  },
  {
    id: 'Audit logs',
    label: 'Audit logs',
    icon: FileClock,
    group: 'ADMINISTRATION',
    href: '/audit-logs',
    requiresPermission: 'audit.read',
    mobilePriority: 'more',
    searchable: true,
    searchKeywords: ['audit', 'log', 'history', 'activity', 'trail'],
  },
  {
    id: 'Settings',
    label: 'Settings',
    icon: Settings2,
    group: 'ADMINISTRATION',
    href: '/settings',
    mobilePriority: 'more',
    keyboardShortcut: 'âŒ˜,',
    searchable: false,
    searchKeywords: ['settings', 'configuration', 'preferences', 'profile', 'business'],
  },
]

// Responsive breakpoints
export const BREAKPOINTS = {
  mobile: 640,
  tablet: 768,
  tabletLandscape: 1024,
  desktop: 1280,
  wide: 1440,
} as const

// Navigation structure for each breakpoint
export const NAVIGATION_STRUCTURE = {
  mobile: {
    type: 'bottom-tab-bar',
    primaryItems: NAVIGATION_CONFIG.filter(n => n.mobilePriority === 'primary').map(n => n.id),
    secondaryItems: NAVIGATION_CONFIG.filter(n => n.mobilePriority === 'secondary').map(n => n.id),
    moreItems: NAVIGATION_CONFIG.filter(n => n.mobilePriority === 'more').map(n => n.id),
    maxPrimaryVisible: 5,
  },
  tablet: {
    type: 'navigation-rail',
    expanded: true,
    collapsible: true,
    showLabels: true,
    showBadges: true,
  },
  desktop: {
    type: 'sidebar',
    collapsible: true,
    defaultExpanded: true,
    showGroups: true,
    showBadges: true,
    showCounts: true,
  },
} as const

// Search configuration
export const SEARCH_CONFIG = {
  debounceMs: 250,
  minQueryLength: 1,
  maxRecentSearches: 10,
  maxResults: 50,
  searchableSections: NAVIGATION_CONFIG.filter(n => n.searchable).map(n => n.id),
  filters: {
    Invoices: ['status', 'dateRange', 'customer', 'amountRange'],
    Payments: ['method', 'dateRange', 'customer', 'amountRange', 'reference'],
    Receipts: ['status', 'dateRange', 'customer', 'amountRange', 'method'],
    Customers: ['status', 'dateRange', 'city', 'country'],
    Suppliers: ['status', 'category', 'city', 'country'],
    'Purchase Orders': ['status', 'dateRange', 'supplier', 'warehouse', 'amountRange'],
    'Goods Receipts': ['status', 'dateRange', 'supplier', 'warehouse'],
    'Stock Movements': ['type', 'dateRange', 'warehouse', 'item'],
    'Products & services': ['status', 'category'],
    Expenses: ['category', 'dateRange', 'payee', 'amountRange'],
    Reports: ['period', 'type'],
    'Audit logs': ['action', 'entityType', 'dateRange', 'user'],
    'Service Desk': ['status', 'priority', 'assignee', 'customer', 'dateRange'],
    'Client Portal': ['status', 'priority', 'dateRange'],
  } as Record<string, string[]>,
} as const

// Empty state configurations
export const EMPTY_STATES: Record<string, { title: string; description: string; primaryAction?: { label: string; href: string }; secondaryAction?: { label: string; href: string } }> = {
  Invoices: {
    title: 'No invoices yet',
    description: 'Create your first invoice to start billing customers.',
    primaryAction: { label: 'Create invoice', href: '/invoices?new=true' },
  },
  Payments: {
    title: 'No payments recorded',
    description: 'Record a payment against an outstanding invoice to get started.',
    primaryAction: { label: 'Record payment', href: '/payments?new=true' },
  },
  Receipts: {
    title: 'No receipts yet',
    description: 'Receipts are created automatically when you record payments.',
    primaryAction: { label: 'Record payment', href: '/payments?new=true' },
  },
  Customers: {
    title: 'No customers yet',
    description: 'Add your first customer to start creating invoices.',
    primaryAction: { label: 'Add customer', href: '/customers?new=true' },
  },
  Suppliers: {
    title: 'No suppliers yet',
    description: 'Add suppliers to create purchase orders and track procurement.',
    primaryAction: { label: 'Add supplier', href: '/suppliers?new=true' },
  },
  'Purchase Orders': {
    title: 'No purchase orders',
    description: 'Create a purchase order to order goods from suppliers.',
    primaryAction: { label: 'Create order', href: '/purchase-orders?new=true' },
  },
  'Goods Receipts': {
    title: 'No goods receipts',
    description: 'Record goods received against a purchase order.',
    primaryAction: { label: 'Create receipt', href: '/goods-receipts?new=true' },
  },
  'Stock Movements': {
    title: 'No stock movements',
    description: 'Stock movements are recorded when you receive goods or adjust inventory.',
    primaryAction: { label: 'View stock', href: '/stock-movements' },
  },
  'Products & services': {
    title: 'No products or services',
    description: 'Add items to your catalogue to use them on invoices.',
    primaryAction: { label: 'Add item', href: '/products-services?new=true' },
  },
  Expenses: {
    title: 'No expenses recorded',
    description: 'Track your business expenses separately from customer receipts.',
    primaryAction: { label: 'Record expense', href: '/expenses?new=true' },
  },
  Reports: {
    title: 'No reports generated',
    description: 'Generate financial reports to analyze your business performance.',
    primaryAction: { label: 'Generate report', href: '/reports?new=true' },
  },
  'User management': {
    title: 'No team members',
    description: 'Invite team members to collaborate on your workspace.',
    primaryAction: { label: 'Invite member', href: '/user-management?invite=true' },
  },
  'Audit logs': {
    title: 'No audit activity',
    description: 'Audit logs will appear here as you and your team perform actions.',
  },
  'Service Desk': {
    title: 'No service tickets yet',
    description: 'Create your first service ticket to start tracking support requests.',
    primaryAction: { label: 'Create ticket', href: '/service-desk/tickets/new' },
    secondaryAction: { label: 'Invite client', href: '/service-desk/clients' },
  },
  'Client Portal': {
    title: 'No service requests yet',
    description: 'Submit your first service request to get support from our team.',
    primaryAction: { label: 'New request', href: '/portal/tickets/new' },
  },
  default: {
    title: 'No results',
    description: 'Try adjusting your search or filters.',
  },
}

// Progressive disclosure step configurations
export const WORKFLOW_STEPS: Record<string, { label: string; description: string; optional?: boolean }[]> = {
  'Invoice creation': [
    { label: 'Customer', description: 'Select or create a customer', optional: false },
    { label: 'Items', description: 'Add products or services', optional: false },
    { label: 'Details', description: 'Set due date, tax, and notes', optional: true },
    { label: 'Review', description: 'Preview and issue or save as draft', optional: false },
  ],
  'Receipt creation': [
    { label: 'Payment', description: 'Select invoice and amount', optional: false },
    { label: 'Method', description: 'Choose payment method', optional: false },
    { label: 'Reference', description: 'Add transaction reference', optional: true },
    { label: 'Confirm', description: 'Review and record payment', optional: false },
  ],
  'Refund processing': [
    { label: 'Payment', description: 'Select the payment to refund', optional: false },
    { label: 'Amount', description: 'Enter refund amount and reason', optional: false },
    { label: 'Approval', description: 'Submit for approval if required', optional: true },
    { label: 'Complete', description: 'Process the refund', optional: false },
  ],
  'Expense recording': [
    { label: 'Category', description: 'Select expense category', optional: false },
    { label: 'Details', description: 'Enter payee, amount, and date', optional: false },
    { label: 'Method', description: 'Select payment method', optional: false },
    { label: 'Review', description: 'Confirm and save expense', optional: false },
  ],
  'Customer registration': [
    { label: 'Basic info', description: 'Name, email, and phone', optional: false },
    { label: 'Address', description: 'Business address and contact', optional: true },
    { label: 'Settings', description: 'Payment terms and preferences', optional: true },
    { label: 'Confirm', description: 'Save customer to directory', optional: false },
  ],
}


export const NavigationConfig = NAVIGATION_CONFIG
