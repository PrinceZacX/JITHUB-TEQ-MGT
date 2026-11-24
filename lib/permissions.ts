export type BusinessRole = 'owner' | 'administrator' | 'finance_manager' | 'accountant' | 'sales_officer' | 'cashier' | 'viewer'

export type BusinessPermission =
  | 'business.read'
  | 'business.manage'
  | 'business.settings'
  | 'membership.manage'
  | 'customer.manage'
  | 'catalogue.manage'
  | 'supplier.manage'
  | 'invoice.create'
  | 'invoice.issue'
  | 'invoice.cancel'
  | 'invoice.update'
  | 'invoice.credit'
  | 'invoice.remind'
  | 'purchase_order.create'
  | 'purchase_order.approve'
  | 'goods_receipt.receive'
  | 'stock.adjust'
  | 'payment.record'
  | 'refund.create'
  | 'refund.approve'
  | 'receipt.void'
  | 'expense.record'
  | 'reports.read'
  | 'audit.read'
  | 'tax.manage'
  | 'service_ticket.create'
  | 'service_ticket.read'
  | 'service_ticket.update'
  | 'service_ticket.assign'
  | 'service_ticket.resolve'
  | 'service_ticket.close'
  | 'service_ticket.comment_internal'

export type PlatformPermission =
  | 'platform.manage_users'
  | 'platform.manage_roles'
  | 'platform.manage_businesses'
  | 'platform.view_audit'
  | 'platform.manage_settings'

export type PlatformRole = 'platform_owner'

type RolePermissions = Record<BusinessRole, BusinessPermission[]>

const rolePermissions: RolePermissions = {
  owner: [
    'business.read', 'business.manage', 'business.settings', 'membership.manage',
    'customer.manage', 'catalogue.manage', 'supplier.manage',
    'invoice.create', 'invoice.issue', 'invoice.cancel', 'invoice.update', 'invoice.credit', 'invoice.remind',
    'purchase_order.create', 'purchase_order.approve',
    'goods_receipt.receive', 'stock.adjust',
    'payment.record', 'refund.create', 'refund.approve', 'receipt.void', 'expense.record',
    'reports.read', 'audit.read', 'tax.manage',
    'service_ticket.create', 'service_ticket.read', 'service_ticket.update',
    'service_ticket.assign', 'service_ticket.resolve', 'service_ticket.close',
    'service_ticket.comment_internal',
  ],
  administrator: [
    'business.read', 'business.manage', 'business.settings',
    'customer.manage', 'catalogue.manage', 'supplier.manage',
    'invoice.create', 'invoice.issue', 'invoice.cancel', 'invoice.update', 'invoice.credit', 'invoice.remind',
    'purchase_order.create', 'purchase_order.approve',
    'goods_receipt.receive', 'stock.adjust',
    'payment.record', 'refund.create', 'refund.approve', 'receipt.void', 'expense.record',
    'reports.read', 'audit.read', 'tax.manage',
    'service_ticket.create', 'service_ticket.read', 'service_ticket.update',
    'service_ticket.assign', 'service_ticket.resolve', 'service_ticket.close',
    'service_ticket.comment_internal',
  ],
  finance_manager: [
    'business.read', 'customer.manage', 'catalogue.manage', 'supplier.manage',
    'invoice.create', 'invoice.issue', 'invoice.update', 'invoice.credit', 'invoice.remind',
    'purchase_order.create', 'purchase_order.approve',
    'goods_receipt.receive', 'stock.adjust',
    'payment.record', 'refund.create', 'refund.approve', 'receipt.void', 'expense.record',
    'reports.read', 'audit.read', 'tax.manage',
    'service_ticket.create', 'service_ticket.read', 'service_ticket.update',
    'service_ticket.assign', 'service_ticket.resolve',
    'service_ticket.comment_internal',
  ],
  accountant: [
    'business.read', 'customer.manage', 'catalogue.manage', 'supplier.manage',
    'invoice.create', 'invoice.issue', 'invoice.update', 'invoice.credit', 'invoice.remind',
    'payment.record', 'refund.create', 'expense.record', 'reports.read', 'audit.read',
    'tax.manage',
    'service_ticket.read', 'service_ticket.comment_internal',
  ],
  sales_officer: [
    'business.read', 'customer.manage', 'catalogue.manage', 'supplier.manage',
    'invoice.create', 'invoice.issue', 'invoice.update', 'invoice.remind',
    'payment.record', 'expense.record', 'reports.read',
    'service_ticket.create', 'service_ticket.read', 'service_ticket.update',
    'service_ticket.resolve', 'service_ticket.comment_internal',
  ],
  cashier: [
    'business.read', 'payment.record', 'receipt.void', 'expense.record', 'reports.read',
    'service_ticket.read',
  ],
  viewer: ['business.read', 'reports.read', 'audit.read', 'service_ticket.read'],
}

export function roleHasPermission(role: BusinessRole, permission: BusinessPermission): boolean {
  return rolePermissions[role]?.includes(permission) ?? false
}

export function requirePermission(role: BusinessRole, permission: BusinessPermission): void {
  if (!roleHasPermission(role, permission)) {
    throw new Error(`This role (${role}) is not permitted to ${permission}.`)
  }
}

export const platformRolePermissions: Record<PlatformRole, PlatformPermission[]> = {
  platform_owner: [
    'platform.manage_users',
    'platform.manage_roles',
    'platform.manage_businesses',
    'platform.view_audit',
    'platform.manage_settings',
  ],
}

export function platformHasPermission(role: PlatformRole, permission: PlatformPermission): boolean {
  return platformRolePermissions[role]?.includes(permission) ?? false
}

export function requirePlatformPermission(role: PlatformRole, permission: PlatformPermission): void {
  if (!platformHasPermission(role, permission)) {
    throw new Error(`Platform role (${role}) is not permitted to ${permission}.`)
  }
}

export const defaultRole: BusinessRole = 'viewer'
