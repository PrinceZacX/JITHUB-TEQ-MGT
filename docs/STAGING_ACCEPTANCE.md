# JITHUB-TEQ Staging Acceptance

## Staging Environment
- **Neon Project:** restless-river-31420751
- **Staging Branch:** br-nameless-boat-bdgflyy6 (created from production main branch br-soft-king-bdlkr5e5)
- **Vercel Project:** prj_nGdtE8unIvC8Nkri6XAYasPpOybp (jithub-teq-mgt)
- **Preview Environment:** Connected to staging DATABASE_URL
- **Production Environment:** Connected to production DATABASE_URL (isolated)

## Staging Deployment Status
- **Deployment URL:** https://jithub-teq-2gdu85t03-prince-zacs-projects.vercel.app
- **Branch:** feat/jithub-teq-completion
- **Commit:** 0b092d0
- **Status:** READY (22s build)

## Acceptance Criteria

### Database Acceptance
- [ ] Production and staging are isolated (verified via Vercel env vars)
- [ ] Existing records are preserved (no records deleted/truncated)
- [ ] Financial relationships have database constraints (composite FKs)
- [ ] Duplicate receipts and invoices prevented (unique indexes)
- [ ] Financial operations are idempotent (idempotency keys)
- [ ] Migrations are documented (0001_multi_business.sql, 0002_receipt_verification.sql)

### Multi-Business Acceptance
- [ ] Multiple businesses are supported (schema supports it)
- [ ] Users have controlled business memberships (business_memberships table)
- [ ] Roles and permissions work (7 roles defined)
- [ ] Cross-business access tests pass (123 tests)
- [ ] Existing JITHUB-TEQ data remains intact (additive migration)

### Financial Acceptance
- [ ] Invoice calculations reconcile (integer-cent math)
- [ ] Partial payments work (recordPayment action)
- [ ] Multiple payments work (payment_allocations table)
- [ ] Refunds work (refunds table with approval workflow)
- [ ] Receipt voiding works (receipts.status = voided)
- [ ] Financial reports reconcile (getFinancialReport action)
- [ ] Audit records remain traceable (audit_logs table)

### Document Acceptance
- [ ] Business branding works (logoUrl, name displayed on receipts)
- [ ] A4 output works (generateInvoicePdfForBusiness, generateReceiptPdf)
- [ ] PDF downloads work (API routes return PDF)
- [ ] 58mm and 80mm layouts render correctly (generateThermalReceipt)
- [ ] Receipt verification works (/verify/[token] page)
- [ ] Browser printing works (window.print in receipt dialog)

### Security Acceptance
- [ ] Server-side permissions enforced (requireBusinessPermission on all actions)
- [ ] Authentication remains functional (Better Auth)
- [ ] File uploads validated (size, MIME type, magic bytes)
- [ ] Sensitive data stays out of logs (maskUrl function)
- [ ] Financial actions auditable (audit_logs table)

### Quality Acceptance
- [x] TypeScript checks pass (tsc --noEmit exit 0)
- [x] Unit tests pass (133 tests: 123 static + 10 real unit)
- [x] Production build passes (pnpm build)
- [ ] ESLint passes
- [ ] Integration tests pass
- [ ] Security tests pass
- [ ] End-to-end tests pass

### Deployment Acceptance
- [ ] Preview uses staging (DATABASE_URL split per environment)
- [ ] Production retains its own configuration (separate DATABASE_URL)
- [ ] Deployment instructions documented (this document)
- [ ] No unapproved production changes (only staging modified)

## Staging Acceptance Sign-off
- Owner acceptance testing: PENDING
- Staging migration verified: PASSED (Migration 0004, 0005 applied to staging branch)
- Financial reconciliation on staging: PENDING
- PDF output verified: PENDING
- Printing previews verified: PENDING

## Next Steps for Production Readiness
1. Owner reviews staging deployment at https://jithub-teq-2gdu85t03-prince-zacs-projects.vercel.app
2. Owner approves production migration (0001_multi_business.sql, 0002_receipt_verification.sql, 0003_wholesale_distribution.sql, 0004_data_retention.sql, 0005_fix_partial_unique_index.sql)
3. Production migration applied (requires explicit owner approval)
4. Production deployment approved (requires explicit owner approval)
5. Production environment variables configured
