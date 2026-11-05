# Architecture Complète - Les Rois Du Bois Admin Dashboard

## 📋 Table des Matières

1. [Modèles de Base de Données](#modèles-de-base-de-données)
2. [API Endpoints](#api-endpoints)
3. [Structure Frontend](#structure-frontend)
4. [Système de Permissions](#système-de-permissions)
5. [Job Queue System](#job-queue-system)
6. [Validations](#validations)

---

## 🗄️ Modèles de Base de Données

### Inventory Management

#### InventoryLog Model
```javascript
{
  productId: ObjectId (ref: Product),
  productType: String (enum: ['regular', 'special']),
  changeType: String (enum: ['increase', 'decrease', 'adjustment', 'sale', 'return', 'purchase']),
  reason: String,
  quantityBefore: Number,
  quantityAfter: Number,
  quantityChange: Number,
  userId: ObjectId (ref: User),
  orderId: ObjectId (ref: Order, optional),
  invoiceId: ObjectId (ref: Invoice, optional),
  notes: String,
  createdAt: Date
}
```

#### StockAlert Model
```javascript
{
  productId: ObjectId (ref: Product),
  productType: String,
  currentStock: Number,
  threshold: Number,
  status: String (enum: ['active', 'resolved']),
  notifiedAt: Date,
  resolvedAt: Date
}
```

### Orders Management

#### Order Model
```javascript
{
  orderNumber: String (unique, auto-generated),
  clientId: ObjectId (ref: User, optional),
  clientName: String,
  clientPhone: String,
  clientEmail: String,
  clientAddress: String,
  status: String (enum: ['pending', 'preparing', 'ready', 'delivered', 'completed', 'canceled']),
  storeId: ObjectId (ref: Store, optional),
  commercialId: ObjectId (ref: User, optional),
  items: [OrderItem],
  subtotal: Number,
  discount: Number,
  tax: Number,
  total: Number,
  cost: Number, // Total cost for profit calculation
  profit: Number,
  paymentMethod: String (enum: ['cash', 'card', 'credit', 'mixed']),
  paymentStatus: String (enum: ['unpaid', 'partial', 'paid']),
  notes: String,
  assignedTo: ObjectId (ref: User, optional),
  createdAt: Date,
  updatedAt: Date,
  completedAt: Date,
  canceledAt: Date,
  canceledBy: ObjectId (ref: User, optional),
  cancelReason: String
}
```

#### OrderItem Model (Embedded in Order)
```javascript
{
  productId: ObjectId (ref: Product),
  productType: String (enum: ['regular', 'special']),
  productName: String,
  variantA: Object (optional, for special products),
  variantB: Object (optional, for special products),
  combinationId: String (optional, for special products),
  quantity: Number,
  unitPrice: Number,
  cost: Number,
  discount: Number,
  subtotal: Number,
  total: Number
}
```

#### OrderActivity Model
```javascript
{
  orderId: ObjectId (ref: Order),
  action: String (enum: ['created', 'updated', 'status_changed', 'item_added', 'item_removed', 'assigned', 'canceled']),
  userId: ObjectId (ref: User),
  changes: Object, // before/after values
  notes: String,
  createdAt: Date
}
```

### Invoice Management

#### Invoice Model
```javascript
{
  invoiceNumber: String (unique, auto-generated),
  orderId: ObjectId (ref: Order),
  clientId: ObjectId (ref: User, optional),
  clientName: String,
  clientAddress: String,
  clientTaxId: String,
  items: [InvoiceItem],
  subtotal: Number,
  discount: Number,
  tax: Number,
  total: Number,
  paidAmount: Number,
  remainingAmount: Number,
  status: String (enum: ['draft', 'sent', 'paid', 'partial', 'overdue', 'canceled']),
  dueDate: Date,
  issuedAt: Date,
  paidAt: Date,
  pdfPath: String,
  emailSent: Boolean,
  emailSentAt: Date,
  notes: String,
  createdBy: ObjectId (ref: User),
  createdAt: Date,
  updatedAt: Date
}
```

#### InvoiceItem Model (Embedded in Invoice)
```javascript
{
  productId: ObjectId (ref: Product),
  productName: String,
  quantity: Number,
  unitPrice: Number,
  discount: Number,
  tax: Number,
  total: Number
}
```

#### Payment Model
```javascript
{
  invoiceId: ObjectId (ref: Invoice),
  orderId: ObjectId (ref: Order, optional),
  amount: Number,
  paymentMethod: String (enum: ['cash', 'card', 'bank_transfer', 'check', 'credit']),
  paymentDate: Date,
  reference: String,
  notes: String,
  recordedBy: ObjectId (ref: User),
  createdAt: Date
}
```

### Audit Logs

#### AuditLog Model
```javascript
{
  resourceType: String (enum: ['user', 'product', 'category', 'order', 'invoice', 'inventory', 'special_product']),
  resourceId: ObjectId,
  action: String (enum: ['create', 'update', 'delete', 'status_change', 'price_change', 'stock_change']),
  userId: ObjectId (ref: User),
  userEmail: String,
  before: Object,
  after: Object,
  changes: Object,
  ipAddress: String,
  userAgent: String,
  createdAt: Date
}
```

### Store & POS

#### Store Model
```javascript
{
  name: String,
  code: String (unique),
  address: String,
  phone: String,
  email: String,
  managerId: ObjectId (ref: User),
  isActive: Boolean,
  createdAt: Date,
  updatedAt: Date
}
```

#### Sale Model (POS)
```javascript
{
  saleNumber: String (unique, auto-generated),
  storeId: ObjectId (ref: Store),
  cashierId: ObjectId (ref: User),
  items: [SaleItem],
  subtotal: Number,
  discount: Number,
  tax: Number,
  total: Number,
  paymentMethod: String (enum: ['cash', 'card', 'mixed']),
  cashReceived: Number,
  change: Number,
  receiptPath: String,
  createdAt: Date
}
```

#### SaleItem Model (Embedded in Sale)
```javascript
{
  productId: ObjectId (ref: Product),
  productName: String,
  quantity: Number,
  unitPrice: Number,
  discount: Number,
  total: Number
}
```

### Supplier & Billing

#### Supplier Model
```javascript
{
  name: String,
  code: String (unique),
  contactName: String,
  email: String,
  phone: String,
  address: String,
  taxId: String,
  paymentTerms: String,
  isActive: Boolean,
  createdAt: Date,
  updatedAt: Date
}
```

#### PurchaseOrder Model
```javascript
{
  poNumber: String (unique, auto-generated),
  supplierId: ObjectId (ref: Supplier),
  status: String (enum: ['draft', 'sent', 'received', 'completed', 'canceled']),
  items: [POItem],
  subtotal: Number,
  tax: Number,
  total: Number,
  expectedDeliveryDate: Date,
  receivedAt: Date,
  notes: String,
  createdBy: ObjectId (ref: User),
  createdAt: Date,
  updatedAt: Date
}
```

#### POItem Model (Embedded in PurchaseOrder)
```javascript
{
  productId: ObjectId (ref: Product),
  productName: String,
  quantity: Number,
  unitCost: Number,
  total: Number
}
```

#### Expense Model
```javascript
{
  expenseNumber: String (unique, auto-generated),
  category: String (enum: ['supplies', 'utilities', 'rent', 'salaries', 'marketing', 'other']),
  description: String,
  amount: Number,
  supplierId: ObjectId (ref: Supplier, optional),
  paymentMethod: String,
  expenseDate: Date,
  receiptPath: String,
  recordedBy: ObjectId (ref: User),
  createdAt: Date
}
```

### Returns & Refunds

#### Return Model
```javascript
{
  returnNumber: String (unique, auto-generated),
  orderId: ObjectId (ref: Order),
  invoiceId: ObjectId (ref: Invoice, optional),
  reason: String,
  items: [ReturnItem],
  totalRefund: Number,
  status: String (enum: ['pending', 'approved', 'rejected', 'completed']),
  creditNoteId: ObjectId (ref: CreditNote, optional),
  restocked: Boolean,
  processedBy: ObjectId (ref: User, optional),
  processedAt: Date,
  createdAt: Date
}
```

#### ReturnItem Model (Embedded in Return)
```javascript
{
  orderItemId: ObjectId,
  productId: ObjectId (ref: Product),
  productName: String,
  quantity: Number,
  unitPrice: Number,
  refundAmount: Number,
  restocked: Boolean
}
```

#### CreditNote Model
```javascript
{
  creditNoteNumber: String (unique, auto-generated),
  returnId: ObjectId (ref: Return),
  invoiceId: ObjectId (ref: Invoice),
  amount: Number,
  status: String (enum: ['draft', 'issued', 'applied', 'canceled']),
  appliedToInvoiceId: ObjectId (ref: Invoice, optional),
  issuedAt: Date,
  appliedAt: Date,
  createdBy: ObjectId (ref: User),
  createdAt: Date
}
```

### CRM

#### Client Model (extends User)
```javascript
// User model already exists, we add:
{
  clientType: String (enum: ['individual', 'business']),
  commercialId: ObjectId (ref: User, optional),
  companyName: String,
  taxId: String,
  creditLimit: Number,
  paymentTerms: String,
  totalOrders: Number,
  totalSpent: Number,
  lastOrderDate: Date,
  status: String (enum: ['active', 'inactive', 'blocked'])
}
```

#### Lead Model
```javascript
{
  name: String,
  email: String,
  phone: String,
  company: String,
  source: String,
  status: String (enum: ['new', 'contacted', 'qualified', 'converted', 'lost']),
  commercialId: ObjectId (ref: User, optional),
  notes: String,
  convertedToClientId: ObjectId (ref: User, optional),
  createdAt: Date,
  updatedAt: Date
}
```

---

## 🔌 API Endpoints

### Inventory Management

#### GET /api/inventory/logs
Query params: `productId`, `changeType`, `startDate`, `endDate`, `page`, `limit`
Response: `{ success: true, data: InventoryLog[], pagination: {...} }`

#### POST /api/inventory/adjust
Body: `{ productId, productType, quantity, reason, notes }`
Response: `{ success: true, data: InventoryLog }`

#### GET /api/inventory/alerts
Response: `{ success: true, data: StockAlert[] }`

#### POST /api/inventory/alerts/:id/resolve
Response: `{ success: true, message: 'Alert resolved' }`

### Orders Management

#### GET /api/orders
Query params: `status`, `clientId`, `storeId`, `commercialId`, `startDate`, `endDate`, `page`, `limit`
Response: `{ success: true, data: Order[], pagination: {...} }`

#### GET /api/orders/:id
Response: `{ success: true, data: Order }`

#### POST /api/orders
Body: `{ clientId, items, discount, paymentMethod, notes }`
Response: `{ success: true, data: Order }`

#### PUT /api/orders/:id
Body: `{ status, items, discount, notes }`
Response: `{ success: true, data: Order }`

#### PUT /api/orders/:id/status
Body: `{ status, notes }`
Response: `{ success: true, data: Order }`

#### POST /api/orders/:id/assign
Body: `{ commercialId, storeId }`
Response: `{ success: true, data: Order }`

#### DELETE /api/orders/:id
Body: `{ reason }`
Response: `{ success: true, message: 'Order canceled' }`

#### GET /api/orders/:id/activity
Response: `{ success: true, data: OrderActivity[] }`

### Invoice Management

#### GET /api/invoices
Query params: `status`, `clientId`, `startDate`, `endDate`, `page`, `limit`
Response: `{ success: true, data: Invoice[], pagination: {...} }`

#### GET /api/invoices/:id
Response: `{ success: true, data: Invoice }`

#### POST /api/invoices
Body: `{ orderId, dueDate, notes }`
Response: `{ success: true, data: Invoice }`

#### POST /api/invoices/:id/payments
Body: `{ amount, paymentMethod, paymentDate, reference, notes }`
Response: `{ success: true, data: Payment }`

#### GET /api/invoices/:id/payments
Response: `{ success: true, data: Payment[] }`

#### POST /api/invoices/:id/send-email
Response: `{ success: true, message: 'Email sent' }`

#### GET /api/invoices/:id/pdf
Response: PDF file

### Audit Logs

#### GET /api/audit-logs
Query params: `resourceType`, `resourceId`, `action`, `userId`, `startDate`, `endDate`, `page`, `limit`
Response: `{ success: true, data: AuditLog[], pagination: {...} }`

### Analytics

#### GET /api/analytics/sales-over-time
Query params: `startDate`, `endDate`, `groupBy` (day/week/month)
Response: `{ success: true, data: [{ date, sales, revenue }] }`

#### GET /api/analytics/revenue-by-category
Query params: `startDate`, `endDate`
Response: `{ success: true, data: [{ category, revenue, orders }] }`

#### GET /api/analytics/revenue-by-product
Query params: `startDate`, `endDate`, `limit`
Response: `{ success: true, data: [{ product, revenue, quantity, profit }] }`

#### GET /api/analytics/revenue-by-commercial
Query params: `startDate`, `endDate`
Response: `{ success: true, data: [{ commercial, revenue, orders, clients }] }`

#### GET /api/analytics/orders-by-status
Query params: `startDate`, `endDate`
Response: `{ success: true, data: [{ status, count, revenue }] }`

#### GET /api/analytics/profitability
Query params: `startDate`, `endDate`
Response: `{ success: true, data: { revenue, cost, profit, margin } }`

#### GET /api/analytics/top-products
Query params: `startDate`, `endDate`, `limit`
Response: `{ success: true, data: Product[] }`

#### GET /api/analytics/low-stock
Response: `{ success: true, data: Product[] }`

### Job Queue

#### GET /api/jobs
Query params: `status`, `type`, `page`, `limit`
Response: `{ success: true, data: Job[], pagination: {...} }`

#### GET /api/jobs/:id
Response: `{ success: true, data: Job }`

#### POST /api/jobs/:id/retry
Response: `{ success: true, message: 'Job queued for retry' }`

#### DELETE /api/jobs/:id
Response: `{ success: true, message: 'Job canceled' }`

### POS

#### GET /api/pos/store/:storeId/dashboard
Response: `{ success: true, data: { todaySales, ongoingOrders, lowStock } }`

#### POST /api/pos/sales
Body: `{ storeId, items, discount, paymentMethod, cashReceived }`
Response: `{ success: true, data: Sale }`

#### GET /api/pos/sales
Query params: `storeId`, `cashierId`, `startDate`, `endDate`, `page`, `limit`
Response: `{ success: true, data: Sale[], pagination: {...} }`

#### GET /api/pos/sales/:id/receipt
Response: PDF file

### Suppliers

#### GET /api/suppliers
Response: `{ success: true, data: Supplier[] }`

#### POST /api/suppliers
Body: `{ name, code, contactName, email, phone, address, taxId, paymentTerms }`
Response: `{ success: true, data: Supplier }`

#### PUT /api/suppliers/:id
Body: `{ ...supplier fields }`
Response: `{ success: true, data: Supplier }`

#### DELETE /api/suppliers/:id
Response: `{ success: true, message: 'Supplier deleted' }`

### Purchase Orders

#### GET /api/purchase-orders
Query params: `supplierId`, `status`, `page`, `limit`
Response: `{ success: true, data: PurchaseOrder[], pagination: {...} }`

#### POST /api/purchase-orders
Body: `{ supplierId, items, expectedDeliveryDate, notes }`
Response: `{ success: true, data: PurchaseOrder }`

#### PUT /api/purchase-orders/:id/status
Body: `{ status }`
Response: `{ success: true, data: PurchaseOrder }`

#### POST /api/purchase-orders/:id/receive
Body: `{ receivedItems }`
Response: `{ success: true, data: PurchaseOrder }`

### Expenses

#### GET /api/expenses
Query params: `category`, `startDate`, `endDate`, `page`, `limit`
Response: `{ success: true, data: Expense[], pagination: {...} }`

#### POST /api/expenses
Body: `{ category, description, amount, supplierId, paymentMethod, expenseDate }`
Response: `{ success: true, data: Expense }`

### Returns

#### GET /api/returns
Query params: `orderId`, `status`, `page`, `limit`
Response: `{ success: true, data: Return[], pagination: {...} }`

#### POST /api/returns
Body: `{ orderId, items, reason }`
Response: `{ success: true, data: Return }`

#### PUT /api/returns/:id/approve
Response: `{ success: true, data: Return }`

#### POST /api/returns/:id/restock
Response: `{ success: true, data: Return }`

### CRM

#### GET /api/crm/clients
Query params: `commercialId`, `status`, `page`, `limit`
Response: `{ success: true, data: User[], pagination: {...} }`

#### PUT /api/crm/clients/:id/assign-commercial
Body: `{ commercialId }`
Response: `{ success: true, data: User }`

#### GET /api/crm/leads
Query params: `status`, `commercialId`, `page`, `limit`
Response: `{ success: true, data: Lead[], pagination: {...} }`

#### POST /api/crm/leads
Body: `{ name, email, phone, company, source, notes }`
Response: `{ success: true, data: Lead }`

#### PUT /api/crm/leads/:id/status
Body: `{ status, notes }`
Response: `{ success: true, data: Lead }`

#### GET /api/crm/commercials/:id/performance
Query params: `startDate`, `endDate`
Response: `{ success: true, data: { sales, revenue, clients, orders } }`

---

## 🎨 Structure Frontend

### Pages Structure

```
frontend/src/pages/
├── Inventory/
│   ├── InventoryManagement.jsx
│   ├── InventoryLogs.jsx
│   └── StockAlerts.jsx
├── Orders/
│   ├── OrdersList.jsx
│   ├── OrderDetail.jsx
│   └── CreateOrder.jsx
├── Invoices/
│   ├── InvoicesList.jsx
│   ├── InvoiceDetail.jsx
│   └── CreateInvoice.jsx
├── AuditLogs/
│   └── AuditLogs.jsx
├── Analytics/
│   ├── AnalyticsDashboard.jsx
│   ├── SalesReports.jsx
│   └── ProfitabilityReports.jsx
├── Jobs/
│   ├── JobQueue.jsx
│   └── JobDetail.jsx
├── POS/
│   ├── POSDashboard.jsx
│   ├── CreateSale.jsx
│   └── SalesHistory.jsx
├── Suppliers/
│   ├── SuppliersList.jsx
│   ├── SupplierDetail.jsx
│   └── CreateSupplier.jsx
├── PurchaseOrders/
│   ├── POList.jsx
│   ├── PODetail.jsx
│   └── CreatePO.jsx
├── Expenses/
│   ├── ExpensesList.jsx
│   └── CreateExpense.jsx
├── Returns/
│   ├── ReturnsList.jsx
│   ├── ReturnDetail.jsx
│   └── CreateReturn.jsx
└── CRM/
    ├── ClientsList.jsx
    ├── ClientDetail.jsx
    ├── LeadsList.jsx
    └── CommercialPerformance.jsx
```

### Components Structure

```
frontend/src/components/
├── Inventory/
│   ├── StockAdjustModal.jsx
│   ├── InventoryLogTable.jsx
│   └── StockAlertCard.jsx
├── Orders/
│   ├── OrderForm.jsx
│   ├── OrderItemsTable.jsx
│   ├── OrderStatusBadge.jsx
│   ├── OrderActivityTimeline.jsx
│   └── ProductSelector.jsx
├── Invoices/
│   ├── InvoiceForm.jsx
│   ├── PaymentModal.jsx
│   ├── PaymentHistory.jsx
│   └── InvoiceStatusBadge.jsx
├── Analytics/
│   ├── SalesChart.jsx
│   ├── RevenueChart.jsx
│   ├── ProfitabilityChart.jsx
│   └── DateRangePicker.jsx
├── POS/
│   ├── ProductSearch.jsx
│   ├── Cart.jsx
│   ├── PaymentPanel.jsx
│   └── ReceiptPreview.jsx
└── Shared/
    ├── DataTable.jsx
    ├── FilterBar.jsx
    ├── ExportButton.jsx
    └── StatusBadge.jsx
```

---

## 🔐 Système de Permissions

### Rôles

- `admin`: Accès complet
- `commercial`: Gestion clients, commandes, factures
- `store_manager`: Gestion magasin, POS, inventaire magasin
- `store_cashier`: POS uniquement, ventes
- `accountant`: Factures, paiements, comptabilité
- `inventory_manager`: Inventaire, ajustements

### Permissions par Module

#### Inventory
- `inventory.view`: Voir inventaire
- `inventory.adjust`: Ajuster stock
- `inventory.view_logs`: Voir logs

#### Orders
- `orders.view`: Voir commandes
- `orders.create`: Créer commande
- `orders.edit`: Modifier commande
- `orders.cancel`: Annuler commande
- `orders.assign`: Assigner commande

#### Invoices
- `invoices.view`: Voir factures
- `invoices.create`: Créer facture
- `invoices.edit`: Modifier facture
- `invoices.mark_paid`: Marquer payé
- `invoices.send_email`: Envoyer par email

#### POS
- `pos.view`: Voir POS
- `pos.create_sale`: Créer vente
- `pos.view_sales`: Voir historique ventes

---

## ⚙️ Job Queue System

### Configuration BullMQ

```javascript
// backend/queue/queue.js
import { Queue } from 'bullmq';
import Redis from 'ioredis';

const connection = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379,
});

export const pdfQueue = new Queue('pdf-generation', { connection });
export const imageQueue = new Queue('image-processing', { connection });
export const reportQueue = new Queue('report-generation', { connection });
```

### Job Types

1. **PDF Generation**
   - Invoice PDF
   - Order PDF
   - Receipt PDF
   - Report PDF

2. **Image Processing**
   - Composite image generation for special products

3. **Report Generation**
   - Analytics reports
   - CSV exports

---

## ✅ Validations

### Order Validation
- Items required and non-empty
- Stock validation before confirmation
- Total calculation validation
- Client information required

### Invoice Validation
- Order must exist
- Invoice number uniqueness
- Total must match order total
- Due date must be in future

### Inventory Validation
- Quantity must be positive
- Reason required for adjustments
- Stock cannot go negative

---

Ce document fournit l'architecture complète pour tous les modules restants. Chaque section peut être implémentée étape par étape en suivant cette structure.

