# 🏗️ Complete ERP System Architecture & Design Documentation

## 📋 Table of Contents

1. [System Overview](#system-overview)
2. [All Modules & Features](#all-modules--features)
3. [Module Integration](#module-integration)


---

## 🎯 System Overview

I've built a complete **Enterprise Resource Planning (ERP) system** that manages end-to-end business operations for small to medium-sized enterprises. Think of it as the central nervous system for a business - everything connects through it.


**My Solution:**
A unified platform where everything talks to each other - when you sell a product, inventory updates automatically. When stock is low, the system suggests what to buy. When you receive goods, it updates costs and creates bills automatically.

---

## 📦 All Modules & Features

### 1. **Inventory Management Module** 

This is starting because everything depends on knowing what's there in stock.

#### **Features I Built:**

**Product Management**
- ✅ Unlimited product catalog with images
- ✅ SKU and barcode generation (auto-generates as `ProductName-SKU-WarehouseCode`)
- ✅ Product categories with hierarchy support
- ✅ Product types: storable, consumable, service
- ✅ Multi-currency pricing (cost price, sale price)
- ✅ Product variants support
- ✅ Auto-code generation for products
- ✅ Image upload and storage

**Warehouse Management (WMS)**
- ✅ Multi-warehouse support (manage 10+ warehouses from one screen)
- ✅ Warehouse locations hierarchy: Zone → Aisle → Rack → Shelf → Bin
- ✅ Location capacity tracking
- ✅ Warehouse manager assignment with contact details
- ✅ Auto-generated warehouse codes
- ✅ Barcode-based warehouse identification

**Stock Tracking**
- ✅ Real-time stock levels by warehouse and location
- ✅ Quantity on hand tracking
- ✅ Quantity reserved (for pending orders)
- ✅ Available quantity calculation (on hand - reserved)
- ✅ Last counted timestamp
- ✅ Low stock alerts (red/yellow/green indicators)
- ✅ Out of stock detection
- ✅ Assign products to warehouses with specific locations

**Stock Movements**
- ✅ Internal transfers between warehouses
- ✅ Receipt movements (goods receiving)
- ✅ Delivery movements (goods outgoing)
- ✅ Stock adjustments (physical count corrections)
- ✅ Return movements
- ✅ Scrap/waste movements
- ✅ Movement workflow: draft → confirmed → processing → completed
- ✅ Full audit trail with timestamps

**Serial & Lot Tracking**
- ✅ Serial number tracking (for unique items like laptops, phones)
- ✅ Lot/batch tracking (for grouped items like medicines with same expiry)
- ✅ Manufacture date and expiry date tracking
- ✅ Status tracking (available, reserved, sold, damaged, expired)
- ✅ Full traceability from supplier to customer

**Procurement Integration**
- ✅ Reorder rules (min/max levels per product per warehouse)
- ✅ Automated PO suggestions when stock < reorder point
- ✅ Average daily consumption calculation from sales history
- ✅ Days until stockout estimation
- ✅ Priority levels (critical, high, medium, low)
- ✅ Approve/reject suggestions workflow

**Cost Management**
- ✅ FIFO (First-In, First-Out) costing
- ✅ LIFO (Last-In, First-Out) costing
- ✅ Weighted Average costing
- ✅ Inventory valuation layers
- ✅ COGS (Cost of Goods Sold) tracking
- ✅ Profitability analysis

**Demand Forecasting**
- ✅ Multiple forecasting methods: Moving Average, Exponential Smoothing, Linear Regression
- ✅ Historical sales analysis
- ✅ Future demand predictions
- ✅ Forecast accuracy tracking
- ✅ Confidence level indicators

**Quality Control**
- ✅ Inspection types: incoming, in_process, outgoing, periodic
- ✅ Quality criteria definition per product
- ✅ Inspection workflows with checkpoints
- ✅ Pass/fail logic with acceptable ranges
- ✅ Defect tracking and corrective actions
- ✅ Quality reports and trends

**Analytics & Reporting**
- ✅ ABC Classification (Pareto analysis)
- ✅ Stock aging reports (0-30, 31-60, 61-90, 91-180, 180+ days)
- ✅ Turnover ratio analysis
- ✅ Fast vs slow-moving products
- ✅ Stock distribution by warehouse
- ✅ Stock distribution by category
- ✅ Valuation reports
- ✅ Expiry alerts (color-coded by urgency)
- ✅ Best performing warehouse
- ✅ Real-time dashboard

---

### 2. **Purchasing Module** (Smart Buying)

I built this to automate the entire procurement process and eliminate manual purchase orders.

#### **Features I Built:**

**Supplier Management**
- ✅ Complete supplier database
- ✅ Contact persons with multiple contacts per supplier
- ✅ Payment terms tracking
- ✅ Tax information (GST, PAN, TAN)
- ✅ Credit limit management
- ✅ Supplier performance ratings
- ✅ Welcome email automation
- ✅ Supplier address management
- ✅ Active/inactive status

**Request for Quotation (RFQ)**
- ✅ Create RFQs with multiple products
- ✅ Send to multiple suppliers simultaneously
- ✅ Email automation with RFQ details
- ✅ Deadline tracking
- ✅ RFQ status workflow: draft → sent → received → closed
- ✅ Compare quotations from multiple suppliers
- ✅ Convert RFQ to Purchase Order

**Purchase Orders (PO)**
- ✅ Create POs manually or from RFQ/suggestions
- ✅ Multi-line PO support (multiple products in one order)
- ✅ PO status workflow: draft → confirmed → partially_received → received → closed
- ✅ Auto-email PO to suppliers
- ✅ Payment terms integration
- ✅ Expected delivery date tracking
- ✅ Warehouse assignment per PO
- ✅ PO amendments and cancellations
- ✅ Auto-generated PO numbers: PO000001, PO000002...

**Goods Receipt**
- ✅ Receive against PO
- ✅ Partial receipt support (receive in batches)
- ✅ Quality inspection integration
- ✅ Automatic stock update on receipt
- ✅ Automatic invoice matching
- ✅ GRN (Goods Receipt Note) generation
- ✅ Receipt timestamps and user tracking

**Bills & Payments**
- ✅ Vendor bill creation from PO
- ✅ Payment status tracking (pending, partial, paid)
- ✅ Payment due date tracking
- ✅ Aging reports (30, 60, 90 days)
- ✅ Multi-payment support
- ✅ Payment method tracking
- ✅ Payment reference numbers

**Analytics**
- ✅ Spending analysis by supplier
- ✅ Spending analysis by category
- ✅ Top suppliers by volume
- ✅ Average order value
- ✅ On-time delivery performance
- ✅ Supplier comparison dashboards
- ✅ PO trend analysis

---

### 3. **Sales Module** (Customer Delight)

I designed this to make selling as smooth as possible and keep customers happy.

#### **Features I Built:**

**Customer Management**
- ✅ Complete customer database (CRM)
- ✅ Multiple shipping addresses per customer
- ✅ Billing address management
- ✅ Credit limit tracking
- ✅ Customer contact persons
- ✅ Customer categories (retail, wholesale, distributor)
- ✅ Tax information (GST)
- ✅ Payment terms per customer
- ✅ Customer purchase history

**Quotations**
- ✅ Professional quotation generation
- ✅ Multi-line items with tax calculation
- ✅ Discount support (per line or total)
- ✅ Validity period tracking
- ✅ Quotation status: draft → sent → accepted → rejected
- ✅ Email quotations to customers
- ✅ Convert quotation to sales order
- ✅ Quotation templates
- ✅ Auto-generated numbers: SQ000001, SQ000002...

**Sales Orders**
- ✅ Create orders manually or from quotations
- ✅ Multi-product orders
- ✅ Order status workflow: draft → confirmed → in_progress → delivered → invoiced
- ✅ Stock reservation on confirmation
- ✅ Expected delivery date
- ✅ Priority levels
- ✅ Order amendments
- ✅ Auto-generated numbers: SO000001, SO000002...

**Invoices**
- ✅ Auto-generate invoices from completed orders
- ✅ Manual invoice creation
- ✅ Tax calculations (GST, VAT, etc.)
- ✅ Payment status tracking
- ✅ Invoice aging reports
- ✅ Payment reminders
- ✅ Multiple payment methods
- ✅ Credit note support
- ✅ Auto-generated numbers: INV000001, INV000002...

**Delivery Management Integration**
- ✅ Assign delivery partners to orders
- ✅ Pickup address management
- ✅ Delivery address tracking
- ✅ Delivery status tracking
- ✅ Expected delivery dates
- ✅ Proof of delivery

**Analytics**
- ✅ Sales by product
- ✅ Sales by customer
- ✅ Sales by period (daily, weekly, monthly)
- ✅ Top customers dashboard
- ✅ Revenue trends
- ✅ Profit margin analysis
- ✅ Sales targets vs actuals
- ✅ Customer lifetime value

---

### 4. **Manufacturing Module** (Production Control)

I built this for businesses that make their own products from raw materials.

#### **Features I Built:**

**Bill of Materials (BOM)**
- ✅ Multi-level BOM support (product within product)
- ✅ Component quantity and unit tracking
- ✅ BOM versioning
- ✅ Cost rollup calculations
- ✅ Where-used reports (which products use this component)
- ✅ BOM templates
- ✅ Scrap factor inclusion
- ✅ Operation routing per BOM

**Manufacturing Orders (MO)**
- ✅ Create MO from sales order or manually
- ✅ MO status workflow: draft → confirmed → in_progress → done → cancelled
- ✅ Raw material reservation
- ✅ Auto-consume materials on production
- ✅ Work order scheduling
- ✅ Priority management
- ✅ Batch/lot assignment
- ✅ Production progress tracking
- ✅ Quality checkpoints during production
- ✅ Auto-generated numbers: MO000001, MO000002...

**Work Centers**
- ✅ Work center master data (machines, assembly lines, testing stations)
- ✅ Capacity planning
- ✅ Efficiency tracking
- ✅ Work center status (active, maintenance, breakdown, idle)
- ✅ Scheduled operations tracking
- ✅ Downtime logging with reasons
- ✅ Maintenance scheduling
- ✅ Operator assignment

**Routing**
- ✅ Operation sequences per product
- ✅ Work center assignment per operation
- ✅ Setup time and run time per operation
- ✅ Operation descriptions and instructions
- ✅ Quality checkpoints per operation
- ✅ Visual operation flow
- ✅ Time-based costing

**Quality Control**
- ✅ Inspection types: incoming, in_process, finished_goods
- ✅ Quality checkpoints with specifications
- ✅ Pass/fail criteria
- ✅ Defect tracking with severity levels (critical, major, minor)
- ✅ Defect actions (reject, rework, accept with deviation)
- ✅ Quality reports by product
- ✅ Rejection rate analysis

**Material Requirements Planning (MRP)**
- ✅ Automatic material requirement calculation
- ✅ Pending MO analysis (max 10 visible)
- ✅ Low stock product identification
- ✅ Material shortage detection
- ✅ Shortage quantity calculations
- ✅ Procurement suggestions from MRP
- ✅ Real-time refresh functionality

---

### 5. **Delivery Management Module** (Last Mile)

I created this to track deliveries from warehouse to customer doorstep.

#### **Features I Built:**

**Delivery Assignment**
- ✅ Assign delivery partners to sales orders
- ✅ Delivery partner details (name, mobile, email)
- ✅ Pickup address auto-fill from warehouse
- ✅ Delivery address auto-fill from customer
- ✅ Receiver contact details for OTP
- ✅ Special instructions field
- ✅ Email notification to delivery partner

**Delivery Partner Portal**
- ✅ Unique token-based access (no login required)
- ✅ Token expires after 7 days or after delivery
- ✅ View order details and items
- ✅ Pickup and delivery addresses display
- ✅ Mark as picked up button
- ✅ OTP verification to complete delivery
- ✅ Status tracking (pending → picked_up → delivered)

**OTP System**
- ✅ 6-digit OTP generation
- ✅ OTP sent to receiver via email
- ✅ OTP valid for 24 hours
- ✅ OTP verification at delivery
- ✅ Prevents fake deliveries

**Auto-Invoice Generation**
- ✅ Invoice auto-created on delivery completion
- ✅ All order lines copied to invoice
- ✅ Payment status set to pending
- ✅ Invoice number auto-generated
- ✅ Sales order status updated to delivered

**Status Logs**
- ✅ Complete audit trail of status changes
- ✅ Timestamp for each status change
- ✅ User/actor tracking
- ✅ Reason/notes for changes
- ✅ Delivery history reports

---

### 6. **Supplier Portal Module** (Vendor Collaboration)

I built this so suppliers can interact with the system without needing full ERP access.

#### **Features I Built:**

**OTP-Based Authentication**
- ✅ Email-based login (no password)
- ✅ 6-digit OTP generation
- ✅ OTP expires in 10 minutes
- ✅ JWT token issued on verification
- ✅ Token valid for 24 hours
- ✅ Secure, passwordless access

**Supplier Dashboard**
- ✅ Statistics cards (Total, Pending, Accepted, Rejected quotations)
- ✅ Recent quotations table with status
- ✅ Quick action buttons
- ✅ Profile header with image
- ✅ Last login tracking
- ✅ Responsive design

**Profile Management**
- ✅ View/Edit mode toggle
- ✅ Profile image upload with preview
- ✅ Image validation (max 5MB, images only)
- ✅ Contact details editing
- ✅ Address management
- ✅ Website URL field
- ✅ Last login display

**Quotation Submission**
- ✅ Two submission modes:
  - **File Upload**: PDF/Word/Image (max 10MB, base64 encoded)
  - **Manual Entry**: Line items with product details
- ✅ Dynamic add/remove line items
- ✅ Real-time total calculation
- ✅ Tax rate and discount per item
- ✅ Validity days and delivery lead time
- ✅ Payment terms and notes
- ✅ Terms & conditions field
- ✅ Auto-generated submission numbers: SQ000001, SQ000002...

**Quotation Management**
- ✅ View submitted quotations
- ✅ Track quotation status (submitted, under_review, accepted, rejected)
- ✅ Status badges with colors
- ✅ Link to RFQ details
- ✅ Link to PO when accepted
- ✅ Submission history

---

### 7. **Analytics & Reporting Module** (Business Intelligence)

I integrated analytics throughout the system to give real-time business insights.

#### **Features I Built:**

**Inventory Analytics**
- ✅ ABC Classification (Pareto principle)
- ✅ Stock turnover ratio
- ✅ Days in inventory
- ✅ Stock aging analysis
- ✅ Fast vs slow-moving products
- ✅ Stock distribution by warehouse
- ✅ Stock distribution by category
- ✅ Expiry alerts dashboard
- ✅ Valuation reports (FIFO/LIFO/Weighted Avg)
- ✅ Best performing warehouse

**Purchasing Analytics**
- ✅ Spending by supplier
- ✅ Spending by category
- ✅ Top suppliers dashboard
- ✅ Average order value
- ✅ On-time delivery tracking
- ✅ Supplier performance scores
- ✅ Price trend analysis

**Sales Analytics**
- ✅ Top customers by revenue
- ✅ Sales by product
- ✅ Sales by period
- ✅ Revenue trends
- ✅ Profit margin analysis
- ✅ Customer lifetime value
- ✅ Sales targets vs actuals

**Manufacturing Analytics**
- ✅ Production efficiency
- ✅ Work center utilization
- ✅ Quality pass/fail rates
- ✅ Rejection rate analysis
- ✅ Production cost analysis
- ✅ Operation time analysis

**Interactive Modals**
- ✅ Click any row to see detailed view
- ✅ Purchase history modals
- ✅ Order details modals
- ✅ Stock movement modals
- ✅ Clean, responsive design

---

### 8. **Authentication & Authorization Module**

I implemented a secure, role-based access control system.

#### **Features I Built:**

**User Management**
- ✅ User registration and login
- ✅ JWT-based authentication
- ✅ Token expiration (24 hours)
- ✅ Password hashing (bcrypt)
- ✅ User profiles
- ✅ Active/inactive users

**Role-Based Access Control (RBAC)**
- ✅ Three roles: Admin, Manager, User
- ✅ Role-based permissions
- ✅ Route protection
- ✅ API endpoint authorization
- ✅ Feature-level access control

**Multi-Organization Support**
- ✅ Organization master data
- ✅ User-organization mapping
- ✅ Organization-level data isolation
- ✅ Cross-organization prevention

---

### 9. **Mobile Application** (On-the-Go Access)

I'm building a React Native Expo app for mobile access.

#### **Features Planned:**

**Inventory Features**
- ✅ View stock levels
- ✅ Scan barcodes
- ✅ Quick stock adjustments
- ✅ Stock movement recording
- ✅ Low stock alerts

**Sales Features**
- ✅ Create quick orders
- ✅ Customer lookup
- ✅ View order status
- ✅ Record payments

**Delivery Features**
- ✅ Delivery partner app
- ✅ Route optimization
- ✅ Proof of delivery
- ✅ Digital signatures

---

## 🔗 Module Integration

Here's how I made all these modules work together seamlessly:

### **1. Inventory ↔ Purchasing Integration**

**How They Connect:**
- When inventory detects low stock (quantity ≤ reorder point), it automatically creates a **Purchase Order Suggestion**
- Purchasing team reviews suggestions and creates **Purchase Orders**
- When goods are received against PO, inventory **auto-updates stock levels**
- Received goods create **inventory valuation layers** for costing

**Database Integration:**
```
reorder_rules → purchase_order_suggestions → purchase_orders → stock_movements → stock_levels
```

**Real Flow:**
1. Product "Laptop" stock falls to 5 units (reorder point: 10)
2. System generates PO suggestion: "Order 100 laptops"
3. Manager approves → Creates PO with Supplier A
4. Goods received → Stock updated to 105 units
5. Valuation layer created: 100 units @ $500 each

---

### **2. Inventory ↔ Sales Integration**

**How They Connect:**
- When a **Sales Order** is confirmed, inventory **reserves stock** (quantity_reserved++)
- Available quantity = quantity_on_hand - quantity_reserved
- When delivery is completed, inventory **reduces stock** (quantity_on_hand--)
- System calculates **COGS** using FIFO/LIFO method
- If stock is insufficient, sales order creation **fails with alert**

**Database Integration:**
```
sales_orders → stock_levels (quantity_reserved)
deliveries → stock_movements (delivery type)
COGS → inventory_valuation_layers (consume oldest first)
```

**Real Flow:**
1. Customer orders 10 laptops → Sales order created
2. Stock reserved: quantity_reserved = 10
3. Warehouse picks 10 laptops → Stock movement created
4. Delivery completed → quantity_on_hand reduced by 10
5. COGS calculated: 10 units @ FIFO cost = $4,800

---

### **3. Inventory ↔ Manufacturing Integration**

**How They Connect:**
- Manufacturing Order pulls **BOM** to see required components
- When MO starts, system **reserves raw materials** from inventory
- During production, materials are **consumed** (quantity_on_hand--)
- When production completes, **finished goods are added** to inventory
- If raw materials insufficient, MO **cannot start**

**Database Integration:**
```
manufacturing_orders → bill_of_materials → products → stock_levels
production_completion → stock_movements (receipt type)
```

**Real Flow:**
1. MO to make 50 bicycles → BOM needs 100 wheels, 50 frames, 50 chains
2. System checks inventory: wheels = 120 ✓, frames = 45 ✗
3. Alert: "Insufficient frames. Need 50, have 45"
4. After procuring frames, MO starts
5. Materials consumed, 50 bicycles added to inventory

---

### **4. Sales ↔ Delivery Integration**

**How They Connect:**
- Sales order moves to "confirmed" → Ready for **delivery assignment**
- Delivery partner assigned → **Email sent** with delivery portal link
- Partner marks "picked up" → Sales order status = "in_progress"
- Partner completes delivery with OTP → Sales order status = "delivered"
- **Invoice auto-generated** and emailed to customer

**Database Integration:**
```
sales_orders → delivery_assignments → delivery_status_logs → sales_invoices
```

**Real Flow:**
1. Order confirmed → Assign to delivery partner
2. OTP sent to customer: 456789
3. Partner picks up from warehouse
4. Partner enters OTP at customer doorstep
5. Invoice INV000123 auto-created

---

### **5. Purchasing ↔ Supplier Portal Integration**

**How They Connect:**
- Purchasing team creates **RFQ** → Email sent to suppliers
- Supplier logs in to portal → Submits **quotation**
- Quotation appears in purchasing module → Team reviews
- Best quotation accepted → Converts to **Purchase Order**
- PO sent to supplier via email

**Database Integration:**
```
rfqs → supplier_quotation_submissions → purchase_orders
```

**Real Flow:**
1. Need 1000 USB drives → Create RFQ, send to 3 suppliers
2. Supplier A submits: $2.50/unit, 15 days delivery
3. Supplier B submits: $2.30/unit, 20 days delivery
4. Accept Supplier B → Create PO000456
5. PO emailed to Supplier B

---

### **6. Manufacturing ↔ Quality Control Integration**

**How They Connect:**
- Raw materials received → **Incoming inspection** required
- During production → **In-process inspections** at checkpoints
- Production complete → **Finished goods inspection**
- Failed inspection → Materials **rejected or reworked**
- Passed inspection → Goods **move to next stage**

**Database Integration:**
```
quality_inspections → manufacturing_orders
quality_checkpoints → work_center_operations
```

---

### **7. Cross-Module Analytics**

**How I Aggregated Data:**
- Created **sales_history** table: aggregates daily sales data
- Created **purchase_history** table: aggregates daily purchases
- **Demand forecasting** reads sales_history
- **Spending analysis** reads purchase_history
- **ABC classification** combines sales and inventory data
- **Turnover ratio** uses COGS and inventory value

---

## 🎨System Architecture &  Design Patterns

### **1. Repository Pattern**

**What I Did:**
- Created a data access layer between API routes and database
- All database queries go through repository functions
- Makes it easy to change database or add caching later

**Example:**
```typescript
// lib/db/repositories/productRepository.ts
export async function getProducts(organizationId: string) {
  return await erpDb
    .select()
    .from(products)
    .where(eq(products.erpOrganizationId, organizationId));
}

// API route uses repository
const products = await getProducts(orgId);
```

---

### **2. Factory Pattern**

**What I Did:**
- Created factory functions for generating unique codes
- Auto-generate PO numbers, SO numbers, invoice numbers, etc.
- Ensures uniqueness and follows naming conventions

**Example:**
```typescript
// Generate next PO number
export async function generatePONumber(orgId: string) {
  const lastPO = await getLastPONumber(orgId);
  const nextNumber = extractNumber(lastPO) + 1;
  return `PO${String(nextNumber).padStart(6, '0')}`; // PO000001
}
```

---

### **3. Observer Pattern (Event-Driven)**

**What I Did:**
- Stock level changes trigger alerts
- Order status changes trigger emails
- Delivery completion triggers invoice generation

**Example:**
```typescript
// When stock updated
if (newQuantity <= reorderPoint) {
  await createAlert({
    type: 'low_stock',
    severity: 'warning',
    productId: product.id
  });
  
  await generatePOSuggestion(product);
}
```

---

### **4. Strategy Pattern (for Costing)**

**What I Did:**
- Different inventory valuation methods (FIFO, LIFO, Weighted Average)
- Strategy selected based on product or organization preference
- Easy to add new costing methods

**Example:**
```typescript
// Costing strategies
const costingStrategies = {
  FIFO: consumeFIFO,
  LIFO: consumeLIFO,
  WEIGHTED_AVG: consumeWeightedAverage
};

const strategy = costingStrategies[valuationMethod];
const cogs = await strategy(productId, quantity);
```

---

### **5. Builder Pattern (for Complex Objects)**

**What I Did:**
- Used for creating complex entities like Manufacturing Orders
- Step-by-step construction with validation at each step

**Example:**
```typescript
const moBuilder = new ManufacturingOrderBuilder()
  .setProduct(productId)
  .setQuantity(100)
  .setBOM(bomId)
  .setScheduledDate(date)
  .reserveMaterials()
  .validate()
  .build();
```

---

### **6. Middleware Pattern**

**What I Did:**
- Authentication middleware checks JWT tokens
- Authorization middleware checks user roles
- Error handling middleware catches all errors
- Logging middleware for audit trails

**Example:**
```typescript
// app/api/middleware/auth.ts
export function authenticate(request: NextRequest) {
  const token = request.headers.get('authorization');
  if (!token) throw new UnauthorizedError();
  
  const user = verifyJWT(token);
  return user;
}
```

---

### **7. Singleton Pattern (Database Connection)**

**What I Did:**
- Single database connection pool shared across application
- Prevents connection exhaustion
- Improves performance

**Example:**
```typescript
// lib/db/index.ts
const erpClient = postgres(connectionString);
export const erpDb = drizzle(erpClient); // Singleton
```

---

### **8. Decorator Pattern (HOC for Components)**

**What I Did:**
- Higher-Order Components for authentication
- Wraps pages with auth check
- Reduces code duplication

**Example:**
```typescript
function withAuth(Component) {
  return function AuthenticatedComponent(props) {
    const { user, loading } = useAuth();
    if (!user) return <Redirect to="/login" />;
    return <Component {...props} user={user} />;
  };
}
```

---

## 🏗️ Backend Architecture

### **Architecture Style: Layered Architecture**

I structured the backend in clear layers:

```
┌─────────────────────────────────────────┐
│         Presentation Layer              │
│     (Next.js API Routes - Route         │
│      Handlers)                          │
└─────────────────┬───────────────────────┘
                  │
┌─────────────────▼───────────────────────┐
│         Business Logic Layer            │
│     (Services, Validators, Use Cases)   │
└─────────────────┬───────────────────────┘
                  │
┌─────────────────▼───────────────────────┐
│         Data Access Layer               │
│     (Repositories, Drizzle ORM)         │
└─────────────────┬───────────────────────┘
                  │
┌─────────────────▼───────────────────────┐
│            Database Layer               │
│        (PostgreSQL Database)            │
└─────────────────────────────────────────┘
```

---

### **1. Presentation Layer (API Routes)**

**What I Did:**
- Created RESTful API endpoints using Next.js App Router
- Each route handles HTTP methods: GET, POST, PUT, DELETE
- Input validation at entry point
- Error responses standardized

**File Structure:**
```
app/api/
├── auth/                    # Authentication endpoints
├── erp/
│   ├── inventory/
│   │   ├── products/route.ts         # GET/POST /api/erp/inventory/products
│   │   ├── warehouses/route.ts       # GET/POST /api/erp/inventory/warehouses
│   │   ├── stock-levels/route.ts     # GET/POST /api/erp/inventory/stock-levels
│   │   └── movements/route.ts        # GET/POST /api/erp/inventory/movements
│   ├── purchasing/
│   │   ├── suppliers/route.ts        # Supplier CRUD
│   │   ├── rfqs/route.ts            # RFQ CRUD
│   │   └── orders/route.ts          # Purchase Order CRUD
│   ├── sales/
│   │   ├── customers/route.ts        # Customer CRUD
│   │   ├── quotations/route.ts       # Quotation CRUD
│   │   ├── orders/route.ts          # Sales Order CRUD
│   │   └── invoices/route.ts        # Invoice CRUD
│   └── manufacturing/
│       ├── bom/route.ts             # BOM CRUD
│       ├── orders/route.ts          # Manufacturing Order CRUD
│       └── work-centers/route.ts     # Work Center CRUD
├── delivery/                # Delivery portal endpoints
└── supplier-portal/         # Supplier portal endpoints
```

---

### **2. Business Logic Layer**

**What I Did:**
- Separated business logic from API routes
- Created service classes for complex operations
- Validators for data integrity
- Use cases for multi-step workflows

**Example Service:**
```typescript
// lib/services/orderService.ts
export class OrderService {
  async createSalesOrder(data: CreateOrderDTO) {
    // 1. Validate customer credit limit
    await this.validateCreditLimit(data.customerId, data.total);
    
    // 2. Check stock availability
    await this.checkStockAvailability(data.items);
    
    // 3. Reserve stock
    await this.reserveStock(data.items);
    
    // 4. Create order
    const order = await this.createOrder(data);
    
    // 5. Send confirmation email
    await this.sendOrderConfirmation(order);
    
    return order;
  }
}
```

---

### **3. Data Access Layer**

**What I Did:**
- Used Drizzle ORM for type-safe database queries
- Repository pattern for all database operations
- Transaction support for complex operations
- Query optimization with joins

**Example Repository:**
```typescript
// lib/db/repositories/orderRepository.ts
export async function getOrderWithDetails(orderId: string) {
  return await erpDb
    .select()
    .from(salesOrders)
    .leftJoin(customers, eq(salesOrders.customerId, customers.id))
    .leftJoin(salesOrderLines, eq(salesOrders.id, salesOrderLines.salesOrderId))
    .leftJoin(products, eq(salesOrderLines.productId, products.id))
    .where(eq(salesOrders.id, orderId));
}
```

---

### **4. Error Handling**

**What I Did:**
- Custom error classes for different error types
- Global error handler middleware
- Consistent error response format
- Error logging for debugging

**Error Response Format:**
```json
{
  "error": "ValidationError",
  "message": "Insufficient stock for product: Laptop",
  "details": {
    "productId": "xxx",
    "requested": 100,
    "available": 50
  },
  "timestamp": "2025-12-30T10:00:00Z"
}
```

---

### **5. Authentication & Authorization**

**How I Implemented It:**

**JWT Authentication:**
```typescript
// User logs in
const token = jwt.sign(
  { userId, email, role, organizationId },
  JWT_SECRET,
  { expiresIn: '24h' }
);

// Every API call includes token in header
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...

// Server verifies token
const decoded = jwt.verify(token, JWT_SECRET);
```

**Role-Based Access:**
```typescript
// Middleware checks role
if (decoded.role !== 'admin') {
  throw new ForbiddenError('Admin access required');
}
```

---

### **6. Email Integration**

**What I Did:**
- Integrated email service for notifications
- Created email templates
- Queue system for bulk emails

**Email Triggers:**
- Welcome email to new suppliers
- RFQ sent to suppliers
- PO confirmation to suppliers
- Order confirmation to customers
- Invoice sent to customers
- Delivery assignment to partners
- OTP for delivery completion
- Low stock alerts to managers

---

## 🗄️ Database Architecture

### **Database: PostgreSQL 15+**

I chose PostgreSQL because:
- Excellent JSONB support for flexible data
- ACID compliance for transactions
- Powerful indexing
- Full-text search
- Open source and free

---

### **Schema Design Principles I Followed:**

1. **Normalization:** Avoided data duplication, used foreign keys
2. **Soft Deletes:** Never delete data, just mark as inactive
3. **Audit Trails:** Created_at, updated_at, created_by on all tables
4. **UUID Primary Keys:** For security and distributed systems
5. **Indexes:** Added indexes on frequently queried columns
6. **Constraints:** Check constraints for data integrity

---

### **Database Structure**

**Core Tables: 80+ tables organized by module**

```
┌──────────────────────────────────────────────────────────┐
│                    ERP Database                          │
└──────────────────────────────────────────────────────────┘

├── Auth & Organization (5 tables)
│   ├── organizations
│   ├── users
│   ├── user_roles
│   ├── permissions
│   └── user_permissions
│
├── Inventory Module (15 tables)
│   ├── products
│   ├── product_categories
│   ├── warehouses
│   ├── warehouse_locations
│   ├── stock_levels
│   ├── stock_movements
│   ├── stock_movement_lines
│   ├── stock_adjustments
│   ├── stock_adjustment_lines
│   ├── serial_lot_numbers
│   ├── reorder_rules
│   ├── purchase_order_suggestions
│   ├── inventory_valuation_layers
│   ├── cogs_transactions
│   └── demand_forecasts
│
├── Purchasing Module (12 tables)
│   ├── suppliers
│   ├── supplier_contacts
│   ├── rfqs (request for quotations)
│   ├── rfq_lines
│   ├── purchase_orders
│   ├── purchase_order_lines
│   ├── goods_receipts
│   ├── goods_receipt_lines
│   ├── vendor_bills
│   ├── vendor_payments
│   ├── supplier_quotation_submissions
│   └── purchase_history
│
├── Sales Module (12 tables)
│   ├── customers
│   ├── customer_contacts
│   ├── customer_addresses
│   ├── sales_quotations
│   ├── sales_quotation_lines
│   ├── sales_orders
│   ├── sales_order_lines
│   ├── sales_invoices
│   ├── sales_invoice_lines
│   ├── customer_payments
│   ├── sales_returns
│   └── sales_history
│
├── Manufacturing Module (15 tables)
│   ├── bill_of_materials
│   ├── bom_components
│   ├── manufacturing_orders
│   ├── manufacturing_order_lines
│   ├── work_centers
│   ├── work_center_operations
│   ├── work_center_downtime
│   ├── routing
│   ├── routing_operations
│   ├── production_tracking
│   ├── quality_inspections
│   ├── quality_checkpoints
│   ├── quality_defects
│   ├── quality_control_criteria
│   └── quality_inspection_results
│
├── Delivery Module (3 tables)
│   ├── delivery_assignments
│   ├── delivery_status_logs
│   └── delivery_tracking
│
├── Analytics Module (5 tables)
│   ├── stock_alerts
│   ├── abc_classification
│   ├── stock_aging_report
│   ├── turnover_analysis
│   └── kpi_dashboards
│
└── Shared/Common (8 tables)
    ├── addresses
    ├── contacts
    ├── currencies
    ├── tax_rates
    ├── payment_terms
    ├── units_of_measure
    ├── file_attachments
    └── audit_logs
```

---

### **Key Database Features I Implemented:**

**1. Referential Integrity**
```sql
-- All foreign keys with cascading
ALTER TABLE stock_levels 
  ADD CONSTRAINT fk_product 
  FOREIGN KEY (product_id) REFERENCES products(id) 
  ON DELETE CASCADE;
```

**2. Database Triggers**
```sql
-- Auto-generate barcode on product insert
CREATE TRIGGER generate_barcode_trigger
BEFORE INSERT ON products
FOR EACH ROW
EXECUTE FUNCTION generate_product_barcode();

-- Update stock alert on stock change
CREATE TRIGGER stock_alert_trigger
AFTER UPDATE ON stock_levels
FOR EACH ROW
EXECUTE FUNCTION check_and_create_stock_alert();
```

**3. Database Functions**
```sql
-- Generate PO suggestions (runs daily)
CREATE FUNCTION generate_purchase_order_suggestions()
RETURNS void AS $$
BEGIN
  -- Complex logic to analyze stock and create suggestions
END;
$$ LANGUAGE plpgsql;
```

**4. Materialized Views** (for performance)
```sql
-- Pre-calculated ABC classification
CREATE MATERIALIZED VIEW abc_classification_view AS
SELECT 
  product_id,
  SUM(revenue) as total_revenue,
  CASE 
    WHEN cumulative_percentage <= 80 THEN 'A'
    WHEN cumulative_percentage <= 95 THEN 'B'
    ELSE 'C'
  END as classification
FROM sales_with_cumulative
GROUP BY product_id;

-- Refresh periodically
REFRESH MATERIALIZED VIEW abc_classification_view;
```

**5. Indexes for Performance**
```sql
-- Composite indexes for common queries
CREATE INDEX idx_stock_levels_product_warehouse 
ON stock_levels(product_id, warehouse_id);

CREATE INDEX idx_sales_orders_customer_status 
ON sales_orders(customer_id, order_status);

CREATE INDEX idx_movements_date 
ON stock_movements(movement_date DESC);
```

**6. JSONB for Flexibility**
```sql
-- Store dynamic data
ALTER TABLE products ADD COLUMN attributes JSONB;

-- Query JSON data
SELECT * FROM products 
WHERE attributes->>'color' = 'red';
```

---

### **Data Flow Examples:**

**Example 1: Create Sales Order**
```sql
-- Transaction ensures all-or-nothing
BEGIN;

  -- Insert order
  INSERT INTO sales_orders (...) VALUES (...);
  
  -- Insert order lines
  INSERT INTO sales_order_lines (...) VALUES (...);
  
  -- Reserve stock
  UPDATE stock_levels 
  SET quantity_reserved = quantity_reserved + 10 
  WHERE product_id = 'xxx';
  
  -- Create audit log
  INSERT INTO audit_logs (...) VALUES (...);

COMMIT;
```

**Example 2: Complete Delivery → Auto-Invoice**
```sql
-- Trigger on delivery completion
CREATE FUNCTION auto_generate_invoice()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.delivery_status = 'delivered' THEN
    -- Create invoice
    INSERT INTO sales_invoices (
      sales_order_id, customer_id, total_amount, status
    )
    SELECT 
      id, customer_id, total_amount, 'sent'
    FROM sales_orders
    WHERE id = NEW.id;
    
    -- Copy line items
    INSERT INTO sales_invoice_lines (...)
    SELECT ... FROM sales_order_lines WHERE sales_order_id = NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

---

## 🎨 Frontend Architecture

### **Framework: Next.js 14+ with App Router**

I chose Next.js because:
- Server-side rendering for SEO
- API routes in same codebase
- File-based routing
- React Server Components
- Excellent TypeScript support

---

### **Frontend Structure:**

```
app/
├── layout.tsx               # Root layout with providers
├── page.tsx                 # Landing page
├── login/                   # Auth pages
├── erp/                     # Main ERP modules
│   ├── layout.tsx           # ERP sidebar layout
│   ├── page.tsx             # ERP dashboard
│   ├── inventory/
│   │   ├── layout.tsx       # Inventory submenu
│   │   ├── products/page.tsx
│   │   ├── warehouses/page.tsx
│   │   ├── stock-levels/page.tsx
│   │   ├── movements/page.tsx
│   │   ├── categories/page.tsx
│   │   ├── procurement/page.tsx
│   │   ├── forecasting/page.tsx
│   │   ├── quality/page.tsx
│   │   └── analytics/page.tsx
│   ├── purchasing/
│   │   ├── layout.tsx
│   │   ├── suppliers/page.tsx
│   │   ├── rfqs/page.tsx
│   │   ├── orders/page.tsx
│   │   └── analytics/page.tsx
│   ├── sales/
│   │   ├── layout.tsx
│   │   ├── customers/page.tsx
│   │   ├── quotations/page.tsx
│   │   ├── orders/page.tsx
│   │   ├── invoices/page.tsx
│   │   └── analytics/page.tsx
│   └── manufacturing/
│       ├── layout.tsx
│       ├── bom/page.tsx
│       ├── orders/page.tsx
│       ├── work-centers/page.tsx
│       ├── routing/page.tsx
│       ├── quality/page.tsx
│       └── mrp/page.tsx
├── delivery/[token]/page.tsx    # Delivery partner portal
└── supplier-portal/             # Supplier portal
    ├── page.tsx                 # Login
    ├── dashboard/page.tsx
    ├── profile/page.tsx
    └── submit-quotation/page.tsx

components/
├── ui/                      # Reusable UI components (buttons, tables, etc.)
├── modal/                   # Modal components
├── modals/                  # Feature-specific modals
├── common/                  # Common components (alerts, etc.)
├── manufacturing/           # Manufacturing-specific components
└── VoiceCommand.tsx         # Voice command feature

lib/
├── db/                      # Database connection and schema
├── utils/                   # Utility functions
├── store/                   # State management (Zustand)
└── auth/                    # Auth helpers
```

---

### **Component Architecture:**

I followed **Atomic Design Pattern:**

```
Atoms (Basic building blocks)
├── Button
├── Input
├── Label
├── Badge
└── Icon

Molecules (Simple combinations)
├── FormField (Label + Input)
├── SearchBar (Input + Icon)
├── StatusBadge (Badge + Text)
└── PriceDisplay (Currency + Amount)

Organisms (Complex components)
├── DataTable (with sorting, pagination)
├── Form (multiple fields with validation)
├── Modal (header, body, footer)
└── StatsCard (icon, title, value, trend)

Templates (Page layouts)
├── ERPLayout (sidebar + content)
├── AuthLayout (centered form)
└── DashboardLayout (header + grid)

Pages (Full pages)
├── ProductsPage
├── OrdersPage
└── DashboardPage
```

---

### **State Management Strategy:**

I used **multiple state management approaches** based on needs:

**1. React useState (Component-Level)**
- For local component state
- Form inputs, toggles, modals
```typescript
const [isOpen, setIsOpen] = useState(false);
```

**2. URL State (Query Parameters)**
- For filters, search, pagination
- Makes state shareable via URL
```typescript
const searchParams = useSearchParams();
const page = searchParams.get('page') || '1';
```

**3. Zustand (Global State)**
- For app-wide state (user, organization)
- Lightweight alternative to Redux
```typescript
// lib/store/useAuthStore.ts
export const useAuthStore = create((set) => ({
  user: null,
  setUser: (user) => set({ user }),
  logout: () => set({ user: null })
}));
```

**4. React Context (Provider Pattern)**
- For theme, alerts
```typescript
// AlertProvider for global alerts
<AlertProvider>
  <App />
</AlertProvider>
```

**5. Server State (React Query - Future)**
- Plan to add for caching API responses
- Auto-refresh on background

---

### **UI/UX Patterns I Implemented:**

**1. Consistent Navigation**
- Sidebar with module icons
- Breadcrumbs for location awareness
- Back buttons on detail pages

**2. Responsive Design**
- Mobile-first approach
- Tailwind CSS breakpoints
- Collapsible sidebar on mobile

**3. Loading States**
- Skeleton screens while loading
- Spinners for actions
- Disabled buttons during submission

**4. Error Handling**
- Toast notifications for errors
- Inline validation messages
- Error boundaries for crash recovery

**5. Color-Coded Status**
- 🟢 Green: Success, Active, In Stock
- 🟡 Yellow: Warning, Low Stock, Pending
- 🔴 Red: Error, Out of Stock, Critical
- 🔵 Blue: Info, Draft
- 🟣 Purple: Special (Transfers)

**6. Interactive Tables**
- Expandable rows for details
- Action buttons inside expanded section
- Pagination (20 items per page)
- Search and filters
- Sorting by columns

**7. Modal Workflows**
- Create/Edit in modals (not new pages)
- View details in modals
- Confirmation dialogs for delete
- Escape key to close

**8. Form Patterns**
- Auto-save drafts
- Validation on blur
- Required field indicators
- Clear error messages
- Success confirmations

---

### **Performance Optimizations I Made:**

**1. Code Splitting**
- Next.js automatic code splitting
- Dynamic imports for modals
```typescript
const Modal = dynamic(() => import('./Modal'), { ssr: false });
```

**2. Image Optimization**
- Next.js Image component
- Lazy loading images
- WebP format support

**3. Pagination**
- Limit 20 items per page
- Prevents loading thousands of records
- Server-side pagination

**4. Debouncing**
- Search inputs debounced (300ms)
- Reduces API calls

**5. Memoization**
- useMemo for expensive calculations
- React.memo for pure components

**6. Virtual Scrolling** (Future)
- For very long lists
- Only render visible items

---
### **Database:**
- 🐘 **PostgreSQL 15+** - Relational database
- 🔮 **Drizzle ORM** - Type-safe ORM
- 🗂️ **Drizzle Kit** - Migrations


---

- **Development Time:** 2+ months
