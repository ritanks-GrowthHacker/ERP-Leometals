# Leo Metals ERP - Metal Industry Features

This document describes the metal industry-specific features implemented in the Leo Metals ERP system.

## 📋 Table of Contents

1. [Metal Product Management](#metal-product-management)
2. [Metal-Specific Attributes](#metal-specific-attributes)
3. [Weight Calculations](#weight-calculations)
4. [Quality Certifications](#quality-certifications)
5. [Units of Measure](#units-of-measure)
6. [Product Categories](#product-categories)
7. [Usage Examples](#usage-examples)

---

## Metal Product Management

The Leo Metals ERP extends the standard product management with specialized fields for metal products.

### Enhanced Product Schema

Every product in the system can now capture detailed metal-specific information including:
- Alloy type and grade
- Physical dimensions
- Form/shape
- Surface finish
- Certifications
- Manufacturing details

---

## Metal-Specific Attributes

### 1. Alloy Type (`metal_alloy_type`)
The type of metal or alloy:
- Carbon Steel
- Stainless Steel
- Aluminum
- Copper
- Brass
- Bronze
- Galvanized Steel
- Mild Steel (MS)
- High Carbon Steel
- Alloy Steel

**Example Usage:**
```typescript
metalAlloyType: "Stainless Steel"
```

### 2. Metal Grade (`metal_grade`)
Specific grade designation:
- Steel: A36, A572, 304, 316L, IS 2062
- Aluminum: 1050, 1100, 6061, 6063, 7075
- Standards: ASTM, IS, EN

**Example Usage:**
```typescript
metalGrade: "304L"
```

### 3. Metal Form (`metal_form`)
Physical form of the metal product:
- Sheet
- Plate
- Coil
- Rod
- Bar
- Tube
- Pipe
- Angle
- Channel
- Beam
- Wire
- Foil
- Strip

**Example Usage:**
```typescript
metalForm: "Sheet"
```

### 4. Dimensions

#### Thickness (`metal_thickness`)
- For sheets, plates, coils
- Measured in millimeters (mm)
- Precision: 4 decimal places

**Example:**
```typescript
metalThickness: 2.5 // 2.5mm thick
```

#### Width (`metal_width`)
- For sheets, plates, strips
- Measured in millimeters (mm) or meters (m)
- Precision: 4 decimal places

**Example:**
```typescript
metalWidth: 1000 // 1000mm = 1m wide
```

#### Length (`metal_length`)
- For sheets, plates, bars, rods
- Measured in millimeters (mm) or meters (m)
- Precision: 4 decimal places

**Example:**
```typescript
metalLength: 2000 // 2000mm = 2m long
```

#### Diameter (`metal_diameter`)
- For rods, pipes, tubes, wires
- Measured in millimeters (mm)
- Precision: 4 decimal places

**Example:**
```typescript
metalDiameter: 25.4 // 25.4mm diameter rod
```

### 5. Surface Finish (`metal_finish`)
Type of surface finish applied:
- Polished
- Matte
- Brushed
- Mill Finish
- Galvanized
- Painted
- Powder Coated
- 2B Finish (standard cold rolled)
- BA Finish (Bright Annealed)
- No. 4 Finish (brushed)
- Mirror Finish

**Example Usage:**
```typescript
metalFinish: "Polished"
```

### 6. Surface Treatment (`metal_surface_treatment`)
Additional surface treatments:
- Polished
- Brushed
- Sandblasted
- Pickled
- Passivated

### 7. Heat Treatment (`metal_heat_treatment`)
Heat treatment processes applied:
- Annealed
- Normalized
- Hardened
- Tempered
- Quenched
- Solution Treated
- Aged

**Example Usage:**
```typescript
metalHeatTreatment: "Annealed"
```

### 8. Coating (`metal_coating`)
Types of protective coatings:
- Zinc Coating
- Chrome Coating
- Nickel Coating
- Tin Coating
- Epoxy Coating
- Powder Coating

---

## Weight Calculations

### Weight Per Unit (`weight_per_unit`)
The system supports automatic weight calculation based on dimensions and density.

**Formula Storage:**
```typescript
weightCalculationFormula: "(thickness_mm / 1000) × (width_m) × (length_m) × density_kg_per_m3"
```

### Standard Metal Densities

The system includes predefined densities for common metals:

| Metal Type | Density (kg/m³) |
|------------|-----------------|
| Carbon Steel | 7850 |
| Stainless Steel 304 | 8000 |
| Stainless Steel 316 | 8000 |
| Mild Steel | 7850 |
| Aluminum | 2700 |
| Copper | 8960 |
| Brass | 8500 |
| Bronze | 8800 |
| Zinc | 7140 |
| Titanium | 4500 |

### Weight Calculation Examples

#### Sheet/Plate Weight
```typescript
// For a stainless steel sheet:
// Thickness: 3mm
// Width: 1m
// Length: 2m
// Density: 8000 kg/m³

weight = (3 / 1000) × 1 × 2 × 8000
weight = 48 kg
```

#### Rod Weight
```typescript
// For a steel rod:
// Diameter: 25mm
// Length: 6m
// Density: 7850 kg/m³

weight = π × (25/2000)² × 6 × 7850
weight ≈ 23 kg
```

---

## Quality Certifications

### Certification (`metal_certification`)
Quality standards and certifications:
- ISO 9001:2015
- CE Mark
- BIS Certification
- ASTM Compliant
- EN Standards
- Mill Test Certificate (MTC)
- Material Test Certificate

**Example Usage:**
```typescript
metalCertification: "ISO 9001:2015, Mill Test Certificate"
```

### Test Certificate (`metal_test_certificate`)
Reference number for mill test certificate:
```typescript
metalTestCertificate: "MTC-2026-001234"
```

### Manufacturing Details

#### Country of Origin (`metal_country_of_origin`)
```typescript
metalCountryOfOrigin: "India"
```

#### Manufacturer (`metal_manufacturer`)
```typescript
metalManufacturer: "Tata Steel Limited"
```

#### Carbon Content (`carbon_content`)
Percentage of carbon content (for steel products):
```typescript
carbonContent: 0.08 // 0.08% carbon
```

---

## Units of Measure

### Predefined Units

The system includes metal-industry specific units:

| Unit | Code | Type | Conversion Factor |
|------|------|------|-------------------|
| Kilogram | KG | Weight | 1.0 (base) |
| Metric Ton | TON | Weight | 1000.0 |
| Meter | MTR | Length | 1.0 (base) |
| Piece | PC | Unit | 1.0 |
| Square Meter | SQM | Area | 1.0 |

### Usage in Products

Products can have different units for different purposes:
- **Base UOM**: Primary unit for inventory (e.g., KG, PC)
- **Purchase UOM**: Unit used when buying (e.g., TON)
- **Sales UOM**: Unit used when selling (e.g., KG, MTR)

---

## Product Categories

### Predefined Metal Categories

The system automatically creates these categories:

1. **Steel Products** (Code: STEEL)
   - All types of steel products including sheets, plates, rods, and tubes

2. **Aluminum Products** (Code: ALUM)
   - All types of aluminum products and alloys

3. **Copper Products** (Code: COPPER)
   - All types of copper products and alloys

4. **Stainless Steel** (Code: SS)
   - All grades of stainless steel products

5. **Scrap Materials** (Code: SCRAP)
   - Scrap and waste metal materials

### Scrap Material Management

Special handling for scrap materials:
```typescript
isScrapMaterial: true
```

---

## Usage Examples

### Example 1: Creating a Stainless Steel Sheet

```typescript
const product = {
  name: "SS 304 Sheet - 3mm x 1m x 2m",
  sku: "SS-304-SHT-3X1X2",
  description: "Stainless Steel 304 grade sheet, polished finish",
  
  // Metal-specific fields
  metalAlloyType: "Stainless Steel",
  metalGrade: "304",
  metalForm: "Sheet",
  metalThickness: 3.0,      // 3mm
  metalWidth: 1000,         // 1m (1000mm)
  metalLength: 2000,        // 2m (2000mm)
  metalFinish: "Polished",
  metalDensity: 8000,       // kg/m³
  
  // Calculated weight: 48 kg
  weightPerUnit: 48.0,
  
  // Certifications
  metalCertification: "ISO 9001:2015, Mill Test Certificate",
  metalTestCertificate: "MTC-2026-SS304-001",
  
  // Manufacturing
  metalCountryOfOrigin: "India",
  metalManufacturer: "Jindal Stainless",
  
  // Units
  uom: "PC",                // Sold per piece
  purchaseUom: "PC",
  saleUom: "PC",
  
  // Pricing
  costPrice: 15000,         // ₹15,000 per piece
  salePrice: 18000,         // ₹18,000 per piece
};
```

### Example 2: Creating an Aluminum Rod

```typescript
const product = {
  name: "Aluminum 6061 Rod - 25mm x 6m",
  sku: "AL-6061-ROD-25X6",
  description: "Aluminum 6061 grade round rod",
  
  // Metal-specific fields
  metalAlloyType: "Aluminum",
  metalGrade: "6061",
  metalForm: "Rod",
  metalDiameter: 25.0,      // 25mm diameter
  metalLength: 6000,        // 6m (6000mm)
  metalDensity: 2700,       // kg/m³
  
  // Calculated weight: ~7.9 kg
  weightPerUnit: 7.9,
  
  // Units
  uom: "PC",
  purchaseUom: "PC",
  saleUom: "MTR",          // Can sell by meter
  
  // Pricing
  costPrice: 800,          // ₹800 per piece
  salePrice: 1000,         // ₹1,000 per piece
};
```

### Example 3: Creating a Copper Tube

```typescript
const product = {
  name: "Copper Tube - OD 22mm x ID 20mm",
  sku: "CU-TUBE-22X20",
  description: "Copper pipe/tube for plumbing",
  
  // Metal-specific fields
  metalAlloyType: "Copper",
  metalForm: "Tube",
  metalDiameter: 22.0,      // Outer diameter 22mm
  metalThickness: 1.0,      // Wall thickness 1mm (ID = 20mm)
  metalFinish: "Mill Finish",
  metalDensity: 8960,       // kg/m³
  
  // Units
  uom: "MTR",              // Sold by meter
  purchaseUom: "MTR",
  saleUom: "MTR",
  
  // Pricing per meter
  costPrice: 350,
  salePrice: 450,
};
```

---

## Integration with Existing Features

### Inventory Management
- Stock levels track metal products by warehouse and location
- Serial/lot tracking for batches with specific certificates
- Reorder points based on weight or piece count

### Purchasing
- RFQs can specify metal specifications
- Purchase orders include quality requirements
- Goods receipts verify certificates and specifications

### Sales
- Quotations show detailed metal specifications
- Orders calculate weights automatically
- Invoices include certification details

### Reporting
- Inventory valuation by metal type
- Stock aging by alloy and grade
- Purchase analysis by supplier and metal category

---

## API Usage

### Creating a Metal Product via API

```javascript
POST /api/erp/inventory/products
Content-Type: application/json
Authorization: Bearer <token>

{
  "name": "MS Plate 10mm",
  "sku": "MS-PLT-10",
  "productType": "storable",
  "categoryId": "<steel-products-category-id>",
  
  "metalAlloyType": "Mild Steel",
  "metalGrade": "IS 2062",
  "metalForm": "Plate",
  "metalThickness": 10.0,
  "metalWidth": 1500,
  "metalLength": 3000,
  "metalFinish": "Mill Finish",
  "metalDensity": 7850,
  "weightPerUnit": 353.25,
  
  "costPrice": 35000,
  "salePrice": 42000
}
```

---

## Best Practices

1. **Always specify metal grade** for accurate tracking and pricing
2. **Include certifications** for quality assurance
3. **Use calculated weight** for accurate costing
4. **Maintain test certificates** for traceability
5. **Update dimensions** for custom-cut pieces
6. **Track country of origin** for compliance
7. **Use proper UOM conversions** when selling in different units

---

**Last Updated**: February 2026
**Version**: 1.0.0
