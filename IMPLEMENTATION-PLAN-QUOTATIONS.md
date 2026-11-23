# JITHUB-TEQ Quotations & Inventory Implementation Plan

## Overview
This document outlines the implementation of the Quotations & Inventory module per the operational policy document.

## Phase 1: Database Schema Extensions (Migrations)

### New Tables Required:

1. **quotations** - Quotation headers
2. **quotation_items** - Quotation line items
3. **sales_orders** - Sales order headers (converted from accepted quotations)
4. **sales_order_items** - Sales order line items
5. **stock_reservations** - Stock reservations for sales orders
5. **costing_layers** - FIFO costing layers per item/warehouse
6. **valuation_groups** - Costing policy per item/business/warehouse

### Migration Files to Create:
1. `0007_quotations_sales_orders.sql` - Quotations, Sales Orders, Items
2. `0008_stock_reservations.sql` - Stock reservations
3. `0009_costing_layers.sql` - FIFO/Weighted Average costing layers
4. `0010_valuation_groups.sql` - Costing policy per item/warehouse

## Phase 2: Database Schema Updates

### New Tables:

```sql
-- Quotations
CREATE TABLE quotations (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id),
  customer_id TEXT NOT NULL REFERENCES customers(id),
  number TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft', -- draft, sent, accepted, expired, converted, cancelled
  issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
  valid_until DATE NOT NULL,
  subtotal NUMERIC(18,2) NOT NULL DEFAULT 0,
  tax_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
  total NUMERIC(18,2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'UGX',
  notes TEXT,
  terms TEXT,
  created_by TEXT NOT NULL REFERENCES "user"(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  accepted_at TIMESTAMPTZ,
  accepted_by TEXT REFERENCES "user"(id),
  converted_at TIMESTAMPTZ,
  converted_sales_order_id TEXT,
  CONSTRAINT quotations_status_valid CHECK (status IN ('draft','sent','accepted','expired','converted','cancelled')),
  CONSTRAINT quotations_number_business_uq UNIQUE (business_id, number)
);

-- Quotation Items
CREATE TABLE quotation_items (
  id TEXT PRIMARY KEY,
  quotation_id TEXT NOT NULL REFERENCES quotations(id) ON DELETE CASCADE,
  item_id TEXT NOT NULL REFERENCES items(id),
  description TEXT NOT NULL,
  quantity NUMERIC(18,3) NOT NULL,
  unit_price NUMERIC(18,2) NOT NULL,
  tax_rate NUMERIC(7,4) NOT NULL DEFAULT 0,
  tax_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
  line_total NUMERIC(18,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Sales Orders
CREATE TABLE sales_orders (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id),
  quotation_id TEXT REFERENCES quotations(id),
  customer_id TEXT NOT NULL REFERENCES customers(id),
  number TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft', -- draft, confirmed, partially_fulfilled, fulfilled, cancelled
  order_date DATE NOT NULL DEFAULT CURRENT_DATE,
  expected_date DATE,
  warehouse_id TEXT NOT NULL REFERENCES warehouses(id),
  subtotal NUMERIC(18,2) NOT NULL DEFAULT 0,
  tax_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
  total NUMERIC(18,2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'UGX',
  notes TEXT,
  created_by TEXT NOT NULL REFERENCES "user"(id),
  confirmed_by TEXT REFERENCES "user"(id),
  confirmed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT sales_orders_status_valid CHECK (status IN ('draft','confirmed','partially_fulfilled','fulfilled','cancelled')),
  CONSTRAINT sales_orders_number_business_uq UNIQUE (business_id, number),
  FOREIGN KEY (quotation_id) REFERENCES quotations(id) ON DELETE SET NULL
);

-- Sales Order Items
CREATE TABLE sales_order_items (
  id TEXT PRIMARY KEY,
  sales_order_id TEXT NOT NULL REFERENCES sales_orders(id) ON DELETE CASCADE,
  item_id TEXT NOT NULL REFERENCES items(id),
  description TEXT NOT NULL,
  quantity NUMERIC(18,3) NOT NULL,
  quantity_fulfilled NUMERIC(18,3) NOT NULL DEFAULT 0,
  unit_price NUMERIC(18,2) NOT NULL,
  tax_rate NUMERIC(7,4) NOT NULL DEFAULT 0,
  tax_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
  line_total NUMERIC(18,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Stock Reservations
CREATE TABLE stock_reservations (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id),
  sales_order_id TEXT NOT NULL REFERENCES sales_orders(id) ON DELETE CASCADE,
  sales_order_item_id TEXT NOT NULL REFERENCES sales_order_items(id) ON DELETE CASCADE,
  item_id TEXT NOT NULL REFERENCES items(id),
  warehouse_id TEXT NOT NULL REFERENCES warehouses(id),
  quantity_reserved NUMERIC(18,3) NOT NULL,
  quantity_fulfilled NUMERIC(18,3) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active', -- active, partially_fulfilled, fulfilled, released, cancelled
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  released_at TIMESTAMPTZ,
  released_by TEXT REFERENCES "user"(id),
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
  CONSTRAINT stock_reservations_status_valid CHECK (status IN ('active','partially_fulfilled','fulfilled','released','cancelled'))
);

-- Costing Layers (for FIFO)
CREATE TABLE costing_layers (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id),
  item_id TEXT NOT NULL REFERENCES items(id),
  warehouse_id TEXT NOT NULL REFERENCES warehouses(id),
  quantity_received NUMERIC(18,3) NOT NULL,
  quantity_remaining NUMERIC(18,3) NOT NULL,
  unit_cost NUMERIC(18,4) NOT NULL, -- Higher precision for costing
  unit_cost_currency TEXT NOT NULL DEFAULT 'UGX',
  received_date DATE NOT NULL,
  source_type TEXT NOT NULL, -- 'purchase', 'adjustment', 'return', 'transfer_in'
  source_reference_id TEXT, -- purchase_order_id, goods_receipt_id, etc.
  valuation_group_id TEXT REFERENCES valuation_groups(id),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
  INDEX costing_layers_item_warehouse_idx (item_id, warehouse_id),
  INDEX costing_layers_valuation_group_idx (valuation_group_id)
);

-- Valuation Groups (Costing Policy)
CREATE TABLE valuation_groups (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id),
  name TEXT NOT NULL,
  costing_method TEXT NOT NULL, -- 'fifo', 'weighted_average'
  description TEXT,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
  UNIQUE (business_id, name)
);

-- Assign items to valuation groups
ALTER TABLE items ADD COLUMN valuation_group_id TEXT REFERENCES valuation_groups(id) ON DELETE SET NULL;
ALTER TABLE items ADD COLUMN costing_method TEXT; -- override per item if needed

-- Add stock reservation fields to stock_levels
ALTER TABLE stock_levels ADD COLUMN quantity_reserved NUMERIC(18,3) NOT NULL DEFAULT 0;
-- quantity_available is now computed: quantity_on_hand - quantity_reserved - unavailable

-- Add quotation reference to sales_orders
ALTER TABLE sales_orders ADD COLUMN quotation_id TEXT REFERENCES quotations(id) ON DELETE SET NULL;

-- Add stock reservation fields to sales_order_items
ALTER TABLE sales_order_items ADD COLUMN quantity_reserved NUMERIC(18,3) NOT NULL DEFAULT 0;
```

## Phase 3: Server Actions (finance.ts extensions)

### New Actions Needed:

1. **Quotation Actions:**
   - `createQuotation()` - Create quotation from catalogue items
   - `getQuotation()` - Get quotation with items
   - `listQuotations()` - List with filters
   - `sendQuotation()` - Send to customer (email)
   - `acceptQuotation()` - Customer acceptance
   - `convertQuotationToSalesOrder()` - Convert accepted quotation to sales order
   - `expireQuotation()` - Mark expired quotations
   - `cancelQuotation()` - Cancel draft/sent quotation

2. **Sales Order Actions:**
   - `createSalesOrder()` - Manual sales order creation
   - `getSalesOrder()` - Get with items and reservations
   - `listSalesOrders()` - List with filters
   - `confirmSalesOrder()` - Confirm draft sales order
   - `reserveStockForSalesOrder()` - Reserve stock for confirmed order
   - `releaseStockReservation()` - Release reservation on cancellation
   - `fulfillSalesOrderItem()` - Fulfill quantity, update reservations
   - `cancelSalesOrder()` - Cancel and release reservations

3. **Stock Reservation Actions:**
   - `reserveStock()` - Reserve stock for sales order item
   - `releaseReservation()` - Release reservation
   - `getStockReservation()` - Get reservation details
   - `getAvailableStock()` - Check available stock (physical - reserved - unavailable)

4. **Quotation to Sales Order Conversion:**
   - `convertQuotationToSalesOrder()` - Atomic conversion with stock validation

5. **Stock Availability:**
   - `checkStockAvailability()` - Check available stock per item/warehouse
   - `getAvailableQuantity()` - Get available quantity for item/warehouse

6. **Costing & Valuation:**
   - `recordCostingLayer()` - Record new costing layer (FIFO)
   - `issueStockFIFO()` - Issue stock using FIFO
   - `calculateWeightedAverage()` - Calculate weighted average cost
   - `getInventoryValuation()` - Get inventory valuation report
   - `createValuationGroup()` - Create costing policy group
   - `assignItemToValuationGroup()` - Assign item to costing method

6. **Stock Movements (Extended):**
   - `recordStockMovement()` - Generic stock movement
   - `transferStock()` - Warehouse to warehouse transfer
   - `adjustStock()` - Stock adjustment with reason

7. **Inventory Reports:**
   - `getStockAvailabilityReport()` - Stock availability per item/warehouse
   - `getInventoryValuationReport()` - FIFO/WA valuation
   - `getStockMovementReport()` - Movement history
   - `getReorderReport()` - Items below reorder level

## Phase 4: UI Components

### New Pages:
1. `/quotations` - Quotations list and management
2. `/quotations/new` - Create quotation
3. `/quotations/[id]` - Quotation detail/view
4. `/sales-orders` - Sales orders list
5. `/sales-orders/new` - Create sales order
6. `/sales-orders/[id]` - Sales order detail/fulfillment
6. `/inventory/valuation` - Inventory valuation reports
7. `/inventory/reservations` - Stock reservations view
7. `/inventory/valuation-groups` - Costing policy management

### Components to Create/Extend:
1. `QuotationForm` - Create/edit quotation
2. `QuotationTable` - Quotations list
3. `QuotationDetail` - Quotation detail with convert action
4. `SalesOrderForm` - Sales order creation
7. `SalesOrderTable` - Sales orders list
8. `SalesOrderDetail` - Sales order with fulfillment
9. `StockReservationPanel` - View/edit reservations
10. `StockAvailabilityChecker` - Real-time availability
11. `InventoryValuationReport` - FIFO/WA valuation
12. `ValuationGroupManager` - Costing policy UI
13. `QuotationToSalesOrderConverter` - Conversion wizard

## Phase 5: Implementation Order

### Sprint 1: Database & Core Actions
1. Create migration files
2. Run migrations on staging
3. Implement core server actions (quotations, sales orders, stock reservations)
4. Implement stock availability checks
5. Implement quotation to sales order conversion

### Sprint 2: Costing & Valuation
1. Implement costing layers (FIFO)
2. Implement weighted average costing
3. Valuation groups management
3. Inventory valuation reports

### Sprint 3: UI Implementation
1. Quotations management page
2. Sales Orders management page
3. Stock reservations view
4. Inventory valuation reports
5. Quotation to Sales Order conversion wizard

### Sprint 4: Integration & Testing
1. End-to-end workflow testing
2. Concurrent reservation testing
15. Costing accuracy verification
16. Performance optimization

## Database Migration Order

1. `0007_quotations_sales_orders.sql` - Core tables
2. `0008_stock_reservations.sql` - Reservations
3. `0009_costing_layers.sql` - Costing layers
4. `0010_valuation_groups.sql` - Valuation groups
5. `0011_stock_levels_reserved.sql` - Add reserved to stock_levels
6. `0012_items_valuation_group.sql` - Items valuation group

## Key Business Logic Rules to Implement

### Stock Availability Check (Section A)
```typescript
async function checkStockAvailability(
  businessId: string,
  itemId: string,
  warehouseId: string,
  quantity: number
): Promise<{ available: boolean; availableQty: number; shortage: number }>
```

### Stock Reservation (Section D)
```typescript
async function reserveStock(
  salesOrderId: string,
  salesOrderItemId: string,
  itemId: string,
  warehouseId: string,
  quantity: number
): Promise<StockReservation>
```

### FIFO Costing (Section B)
```typescript
async function issueStockFIFO(
  businessId: string,
  itemId: string,
  warehouseId: string,
  quantity: number
): Promise<{ layersUsed: CostingLayer[]; totalCost: number }>
```

### Weighted Average (Section B)
```typescript
async function calculateWeightedAverage(
  businessId: string,
  itemId: string,
  warehouseId: string
): Promise<number>
```

### Stock Availability Calculation (Section E)
```typescript
function calculateAvailableStock(
  physical: number,
  reserved: number,
  unavailable: number // damaged, expired, quarantined
): number {
  return Math.max(0, physical - reserved - unavailable)
}
```

## Testing Requirements (Section I)

Each test scenario must pass:
1. Successful reservation when sufficient stock
2. Blocked reservation when insufficient stock
3. Prevention of double reservation (concurrent)
4. Reservation release on cancellation
5. Correct deduction after dispatch
6. Partial dispatch handling
7. Warehouse transfers
8. In-transit stock accounting
9. FIFO valuation accuracy
10. Weighted average accuracy
11. COGS accuracy
12. Customer returns
12. Supplier returns
13. Stock reconciliation
14. Availability after goods receipt
15. Quotation to sales order conversion
16. Audit trail completeness

## API Routes to Create

```
/api/quotations
  GET    /api/quotations              - List quotations
  POST   /api/quotations              - Create quotation
  GET    /api/quotations/[id]         - Get quotation
  PATCH  /api/quotations/[id]         - Update quotation
  POST   /api/quotations/[id]/send    - Send quotation
  POST   /api/quotations/[id]/accept  - Accept quotation
  POST   /api/quotations/[id]/convert - Convert to sales order
  POST   /api/quotations/[id]/cancel  - Cancel quotation

/api/sales-orders
  GET    /api/sales-orders            - List sales orders
  POST   /api/sales-orders            - Create sales order
  GET    /api/sales-orders/[id]       - Get sales order
  PATCH  /api/sales-orders/[id]       - Update sales order
  POST   /api/sales-orders/[id]/confirm      - Confirm order
  POST   /api/sales-orders/[id]/fulfill      - Fulfill items
  POST   /api/sales-orders/[id]/cancel       - Cancel order

/api/stock-reservations
  GET    /api/stock-reservations      - List reservations
  POST   /api/stock-reservations      - Create reservation
  GET    /api/stock-reservations/[id] - Get reservation
  POST   /api/stock-reservations/[id]/release - Release reservation

/api/stock-availability
  POST   /api/stock-availability/check - Check availability

/api/inventory-valuation
  GET    /api/inventory-valuation     - Valuation report
  GET    /api/inventory-valuation/fifo - FIFO layers
  GET    /api/inventory-valuation/weighted-average - WA cost

/api/valuation-groups
  GET    /api/valuation-groups        - List groups
  POST   /api/valuation-groups        - Create group
  PATCH  /api/valuation-groups/[id]   - Update group
  POST   /api/items/[id]/assign-valuation-group - Assign item

/api/warehouse-transfers
  POST   /api/warehouse-transfers     - Create transfer
  GET    /api/warehouse-transfers     - List transfers
  POST   /api/warehouse-transfers/[id]/receive - Receive transfer
```

## UI Components Priority

### High Priority (Core Workflows)
1. Quotation list page (`/quotations`)
2. Quotation detail with convert action (`/quotations/[id]`)
3. Create quotation page (`/quotations/new`)
4. Sales order list (`/sales-orders`)
6. Sales order detail with fulfillment (`/sales-orders/[id]`)
6. Stock reservations panel
7. Stock availability checker component

### Medium Priority (Reports & Config)
1. Inventory valuation report page
2. Valuation groups management
3. Stock availability checker component
7. Quotation to Sales Order conversion wizard

### Low Priority (Advanced)
1. Warehouse transfer management
2. Advanced costing reports
2. Batch operations

## Acceptance Criteria Checklist

- [ ] Quotation creation with catalogue items
- [ ] Quotation sending to customer
- [ ] Customer acceptance of quotation
- [ ] Stock validation on acceptance
- [ ] Quotation to Sales Order conversion
- [ ] Stock reservation on Sales Order confirmation
- [ ] Stock deduction on dispatch
- [ ] Partial dispatch handling
- [ ] Warehouse transfer with in-transit tracking
- [ ] FIFO costing accuracy
- [ ] Weighted average accuracy
- [ ] Valuation group assignment
- [ ] Inventory valuation reports
- [ ] All 17 test scenarios pass
- [ ] No negative stock possible
- [ ] No double reservation possible
- [ ] Audit trail for all stock operations

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Concurrent reservation conflicts | Use SELECT FOR UPDATE with advisory locks |
| FIFO costing performance | Index costing_layers by item+warehouse, cache valuation |
| Migration data integrity | Test on staging copy first, verify row counts |
| Costing method change | Require authorized migration with reconciliation |
| Concurrent dispatch | Row-level locks on stock_levels |

## Definition of Done

- All 17 test scenarios pass
- Zero TypeScript errors
- Production build succeeds
- All migrations run cleanly on staging
- Performance: <200ms for stock availability check
- Costing accuracy: ±0.01% vs manual calculation
- Zero negative stock occurrences in testing
- Zero double-reservation in concurrent testing
- Full audit trail for all stock operations