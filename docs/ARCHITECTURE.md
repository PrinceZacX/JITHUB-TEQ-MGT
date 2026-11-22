# JITHUB-TEQ Architecture

## Technology Stack
- Next.js 16.4.6 (App Router)
- React 19
- TypeScript 5.7.3
- Tailwind CSS 4
- PostgreSQL on Neon (Lakebase)
- Drizzle ORM 0.45.4
- Better Auth 1.7.26
- Vercel (hosting)
- pnpm 12.3.4 (package manager)

## Database Schema

### Core Tables
- **user** - Better Auth user accounts (id, name, email, emailVerified, image, timestamps)
- **session** - Better Auth sessions (id, expiresAt, token, userId, timestamps)
- **account** - Better Auth accounts (id, accountId, providerId, userId, tokens, timestamps)
- **verification** - Better Auth email verification (id, identifier, value, expiresAt, timestamps)

### Multi-Business Workspace
- **businesses** - Business entity (id, name, legalName, registrationNumber, taxIdentificationNumber, email, phone, address, city, country, currency, timezone, logoUrl, website, receiptPrefix, invoicePrefix, footerText, paymentInstructions, taxDisplaySettings, status, timestamps)
- **business_memberships** - User-business membership (id, businessId, userId, role, createdAt) with unique (businessId, userId)
- **document_sequences** - Document number allocation (id, businessId, documentType, lastNumber, updatedAt) with unique (businessId, documentType)

### Financial Tables (all business-scoped)
- **customers** - Customer directory (id, businessId, userId, name, email, phone, address, taxId, status, timestamps)
- **catalogue_items** - Product/service catalogue (id, businessId, userId, name, description, unitPrice, status, timestamps)
- **invoices** - Invoices (id, businessId, userId, customerId, number, status, issueDate, dueDate, currency, subtotal, taxAmount, total, amountPaid, notes, timestamps)
- **invoice_items** - Invoice line items (id, businessId, invoiceId, catalogueItemId, description, quantity, unitPrice, taxRate, lineTotal, timestamps)
- **payments** - Customer payments (id, businessId, userId, customerId, reference, idempotencyKey, method, paidAt, amount, currency, notes, status, timestamps)
- **payment_allocations** - Payment-to-invoice allocation (id, businessId, paymentId, invoiceId, amount, timestamps)
- **receipts** - Payment receipts (id, businessId, userId, paymentId, number, status, voidedAt, voidedBy, verificationToken, issuedAt, timestamps)
- **refunds** - Refund/reversal records (id, businessId, paymentId, idempotencyKey, requestedBy, approvedBy, amount, reason, method, reference, status, createdAt, processedAt, timestamps)
- **expenses** - Business expenses (id, businessId, userId, category, payee, description, method, paidAt, amount, timestamps)
- **audit_logs** - Audit trail (id, businessId, userId, action, entityType, entityId, details, timestamps)

### Data Integrity
- Composite foreign keys on (businessId, userId) or (businessId, customerId) prevent cross-business relationships
- Unique indexes on (businessId, number) for invoices and receipts
- Unique indexes on (businessId, reference) and (businessId, idempotencyKey) for payments/refunds
- Check constraints for positive amounts, valid statuses, non-negative totals

## Server Actions (app/actions/finance.ts)
All server actions enforce business context via `requireBusiness()` and permission checks via `requireBusinessPermission(permission, businessId?)`:

- getDashboardData() - Dashboard metrics and recent records
- getFinancialReport(period) - Financial reporting by period
- createCustomer() / updateCustomer() - Customer CRUD
- createInvoice() / issueDraftInvoice() - Invoice creation and issuance
- recordPayment() - Payment recording with receipt generation
- saveCatalogueItem() / setCatalogueItemStatus() - Catalogue management
- recordExpense() - Expense recording
- recordRefund() / approveRefund() / completeRefund() - Refund workflow
- voidReceipt() - Receipt voiding
- cancelInvoice() - Invoice cancellation
- updateBusiness() - Business profile settings
- createBusiness() / listBusinesses() / setActiveBusiness() - Business management
- createSupplier() / listSuppliers() / updateSupplier() / suspendSupplier() / reactivateSupplier() - Supplier management
- createPurchaseOrder() / listPurchaseOrders() / approvePurchaseOrder() - Purchase orders
- createTaxRate() / listTaxRates() / updateTaxRate() - Tax configuration
- verifyReceipt() - Public receipt verification (no auth required)
- Membership: listBusinessMembers() / inviteMember() / updateMembershipRole() / suspendMembership() / removeMembership() - Soft-delete memberships

## API Routes
- app/api/auth/[...all]/route.ts - Better Auth authentication
- app/api/documents/invoice/[id]/route.ts - A4 invoice PDF download (calls loadEnv())
- app/api/documents/receipt/[id]/route.ts - A4 receipt PDF download (calls loadEnv())
- app/api/documents/receipt/thermal/[id]/route.ts - 58mm/80mm thermal receipt text (calls loadEnv())
- app/api/upload/logo/route.ts - Secure logo upload (no SVG, fixed WebP, audit logged)

## Public Pages
- app/verify/[token]/page.tsx - Public receipt verification (limited info only)
- app/sign-in/page.tsx - Authentication
- app/reset-password/page.tsx - Password reset

## Environment Configuration
- DATABASE_URL - Neon connection string (isolated per environment)
- BETTER_AUTH_SECRET - Session signing key (min 32 chars)
- BETTER_AUTH_URL - Auth base URL
- SMTP_HOST, SMTP_PORT, SMTP_FROM, SMTP_USER, SMTP_PASSWORD, SMTP_SECURE - Email delivery (optional)
- DATABASE_URL_TEST - Test database for integration tests (not configured)

## Key Design Decisions

1. **Business isolation**: All financial tables have businessId; all queries scope by businessId; composite FKs prevent cross-business relationships at the database level
2. **Immutable financial records**: Refunds and voids create new records rather than modifying existing ones
3. **Idempotency**: Payment and refund submission support idempotency keys to prevent duplicate execution
4. **Integer-cent money**: All monetary calculations use integer cents with BigInt arithmetic to avoid floating-point errors
5. **Lazy environment validation**: DATABASE_URL validated at request time, not build time, to allow builds without production credentials
6. **Soft-delete memberships**: Removing a membership sets status='removed' and deleted_at instead of hard-deleting, preserving all historical financial records
7. **Exact business authorization**: Membership operations validate that the caller belongs to the exact target businessId from the client request

## Known Limitations

- Persistent logo storage: Local filesystem not persistent on Vercel serverless; object storage credentials not provided
- Real database integration tests: DATABASE_URL_TEST not configured
- Browser-based E2E tests: No Playwright infrastructure
- QR code token stored but not rendered as image on receipts
- No tax configuration UI (tax rates server actions exist)
- No email delivery history
- No notification system
- CI workflow references drizzle-kit which is now installed

