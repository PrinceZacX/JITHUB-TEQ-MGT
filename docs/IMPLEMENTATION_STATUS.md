# JITHUB-TEQ Wholesale & Distribution Implementation Plan

## Current State
- Multi-business workspace: ✅ Complete
- Customers, invoices, payments, receipts, refunds, expenses: ✅ Complete
- Catalogue items (basic): ✅ Complete
- **Missing**: Suppliers, warehouses, products/items with SKU/barcode, stock movements, purchase orders, goods receipts, tax configuration, purchase returns

## Phase 1: Database Migrations (additive)

### Migration 0003: Wholesale & Distribution Foundation
- suppliers table
- warehouses table  
- items table (product catalogue with SKU, barcode, UOM)
- stock_movements table (auditable ledger)
- purchase_orders table
- purchase_order_lines table
- goods_receipts table
- goods_receipt_lines table
- tax_rates table
- purchase_returns table
- purchase_return_lines table

### Phase 2: Server Actions
- Supplier CRUD + search/filter
- Purchase order CRUD + approval workflow
- Goods receipt (against PO)
- Stock movements (automatic from receipts/dispatches)
- Tax rates configuration
- Purchase returns

### Phase 3: UI Components
- Suppliers page
- Purchase orders page
- Goods receiving page
- Stock movements report
- Tax settings page
- Purchase returns page

### Phase 4: Tests
- Unit tests for money, calculations
- Integration tests for server actions
- Security tests for cross-business isolation
- E2E tests for wholesale workflows
