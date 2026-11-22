export type BusinessRole = 'owner' | 'administrator' | 'finance_manager' | 'accountant' | 'sales_officer' | 'cashier' | 'viewer'

export type BusinessPermission =
  | 'business.read'
  | 'business.manage'
  | 'business.settings'
  | 'membership.manage'
  | 'customer.manage'
  | 'catalogue.manage'
  | 'invoice.create'
  | 'invoice.issue'
  | 'invoice.cancel'
  | 'payment.record'
  | 'refund.create'
  | 'refund.approve'
  | 'receipt.void'
  | 'expense.record'
  | 'reports.read'
  | 'audit.read'

type RolePermissions = Record<BusinessRole, BusinessPermission[]>

const rolePermissions: RolePermissions = {
  owner: [
    'business.read', 'business.manage', 'business.settings', 'membership.manage',
    'customer.manage', 'catalogue.manage', 'invoice.create', 'invoice.issue', 'invoice.cancel',
    'payment.record', 'refund.create', 'refund.approve', 'receipt.void', 'expense.record',
    'reports.read', 'audit.read',
  ],
  administrator: [
    'business.read', 'business.manage', 'business.settings',
    'customer.manage', 'catalogue.manage', 'invoice.create', 'invoice.issue', 'invoice.cancel',
    'payment.record', 'refund.create', 'refund.approve', 'receipt.void', 'expense.record',
    'reports.read', 'audit.read',
  ],
  finance_manager: [
    'business.read', 'customer.manage', 'catalogue.manage', 'invoice.create', 'invoice.issue',
    'payment.record', 'refund.create', 'refund.approve', 'receipt.void', 'expense.record',
    'reports.read', 'audit.read',
  ],
  accountant: [
    'business.read', 'customer.manage', 'catalogue.manage', 'invoice.create', 'invoice.issue',
    'payment.record', 'refund.create', 'expense.record', 'reports.read', 'audit.read',
  ],
  sales_officer: [
    'business.read', 'customer.manage', 'catalogue.manage', 'invoice.create', 'invoice.issue',
    'payment.record', 'expense.record', 'reports.read',
  ],
  cashier: [
    'business.read', 'payment.record', 'receipt.void', 'expense.record', 'reports.read',
  ],
  viewer: ['business.read', 'reports.read', 'audit.read'],
}

export function roleHasPermission(role: BusinessRole, permission: BusinessPermission): boolean {
  return rolePermissions[role]?.includes(permission) ?? false
}

export function requirePermission(role: BusinessRole, permission: BusinessPermission): void {
  if (!roleHasPermission(role, permission)) {
    throw new Error(`This role (${role}) is not permitted to ${permission}.`)
  }
}

export const defaultRole: BusinessRole = 'viewer'
