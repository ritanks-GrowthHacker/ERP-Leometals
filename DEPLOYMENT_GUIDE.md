# Leo Metals ERP - Deployment Guide

This guide provides step-by-step instructions for deploying and configuring the Leo Metals ERP system.

## 📋 Table of Contents

1. [Prerequisites](#prerequisites)
2. [Environment Setup](#environment-setup)
3. [Database Setup](#database-setup)
4. [Application Configuration](#application-configuration)
5. [Deployment](#deployment)
6. [Initial Data Setup](#initial-data-setup)
7. [Post-Deployment Verification](#post-deployment-verification)

---

## Prerequisites

### Required Software
- **Node.js**: Version 20 or higher
- **PostgreSQL**: Version 15 or higher
- **npm**: Version 10 or higher
- **Git**: For version control

### Required Services
- PostgreSQL database (local or cloud-hosted)
- SMTP server for email notifications (optional)
- Razorpay account for payment processing (optional)

---

## Environment Setup

### 1. Clone the Repository

```bash
git clone https://github.com/ritanks-GrowthHacker/ERP-Leometals.git
cd ERP-Leometals
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Create Environment Variables

Create a `.env.local` file in the root directory:

```env
# Database Configuration
ERP_DATABASE_URL=postgresql://username:password@localhost:5432/leometals_erp

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_EXPIRES_IN=7d

# Email Configuration (Optional)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
SMTP_FROM=noreply@leometals.com

# Razorpay Configuration (Optional - for payment processing)
RAZORPAY_KEY_ID=your_razorpay_key_id
RAZORPAY_KEY_SECRET=your_razorpay_key_secret

# Application Configuration
NEXT_PUBLIC_APP_URL=http://localhost:3000
NODE_ENV=development
```

---

## Database Setup

### 1. Create PostgreSQL Database

```sql
-- Connect to PostgreSQL
psql -U postgres

-- Create database
CREATE DATABASE leometals_erp;

-- Create user (optional)
CREATE USER leometals_admin WITH PASSWORD 'secure_password';
GRANT ALL PRIVILEGES ON DATABASE leometals_erp TO leometals_admin;
```

### 2. Run Schema Migrations

Execute the SQL files in order:

```bash
# Run base schema (if exists)
psql -U postgres -d leometals_erp -f path/to/base_schema.sql

# Run metal-specific fields migration
psql -U postgres -d leometals_erp -f ADD_METAL_SPECIFIC_FIELDS.sql

# Run any other migrations
psql -U postgres -d leometals_erp -f EXECUTE_THIS.sql
psql -U postgres -d leometals_erp -f ADD_PRODUCT_TAX_COLUMNS.sql
```

### 3. Verify Database Tables

```bash
psql -U postgres -d leometals_erp -c "\dt"
```

You should see tables like:
- `erp_organizations`
- `products`
- `warehouses`
- `stock_levels`
- `purchase_orders`
- `sales_orders`
- And many more...

---

## Application Configuration

### 1. Update Company Information

Edit `lib/config/leo-metals-config.ts` with your company details:

```typescript
company: {
  name: 'Leo Metals',
  legalName: 'Leo Metals Private Limited',
  // ... update contact info, address, GST number, etc.
},
```

### 2. Configure Theme (Optional)

Update branding colors in the same config file:

```typescript
theme: {
  primaryColor: '#1E40AF',
  secondaryColor: '#0EA5E9',
  // ... customize colors
},
```

---

## Deployment

### Development Mode

```bash
npm run dev
```

The application will be available at `http://localhost:3000`

### Production Build

```bash
# Build the application
npm run build

# Start production server
npm start
```

### Using PM2 (Recommended for Production)

```bash
# Install PM2 globally
npm install -g pm2

# Start the application
pm2 start npm --name "leo-metals-erp" -- start

# Save PM2 configuration
pm2 save

# Setup PM2 to start on system boot
pm2 startup
```

### Docker Deployment (Optional)

Create a `Dockerfile`:

```dockerfile
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

EXPOSE 3000

CMD ["npm", "start"]
```

Build and run:

```bash
docker build -t leo-metals-erp .
docker run -p 3000:3000 --env-file .env.local leo-metals-erp
```

---

## Initial Data Setup

### 1. Create Initial Organization

```sql
INSERT INTO erp_organizations (id, name, code, email, phone, address, city, state, country, postal_code, is_active)
VALUES (
  gen_random_uuid(),
  'Leo Metals Private Limited',
  'LM001',
  'info@leometals.com',
  '+91-XXXXXXXXXX',
  'Industrial Area, Phase 1',
  'Mumbai',
  'Maharashtra',
  'India',
  '400001',
  true
);
```

### 2. Create Admin User

Access the application and register the first admin user through the UI, or insert directly:

```sql
-- Note: Password should be hashed using bcrypt
INSERT INTO users (id, erp_organization_id, name, email, password_hash, role, is_active)
VALUES (
  gen_random_uuid(),
  (SELECT id FROM erp_organizations WHERE code = 'LM001'),
  'Admin User',
  'admin@leometals.com',
  '$2a$10$...', -- Use bcrypt to hash your password
  'admin',
  true
);
```

### 3. Create Initial Warehouses

```sql
INSERT INTO warehouses (id, erp_organization_id, name, code, address, city, state, country, is_active)
VALUES 
  (gen_random_uuid(), (SELECT id FROM erp_organizations WHERE code = 'LM001'), 
   'Main Warehouse', 'LM-WH-001', 'Industrial Area', 'Mumbai', 'Maharashtra', 'India', true),
  (gen_random_uuid(), (SELECT id FROM erp_organizations WHERE code = 'LM001'), 
   'Secondary Warehouse', 'LM-WH-002', 'Industrial Area', 'Mumbai', 'Maharashtra', 'India', true);
```

### 4. Create Product Categories

The metal-specific categories are automatically created by the migration script:
- Steel Products
- Aluminum Products
- Copper Products
- Stainless Steel
- Scrap Materials

### 5. Create Units of Measure

The metal-specific units are automatically created:
- Kilogram (KG)
- Metric Ton (TON)
- Meter (MTR)
- Piece (PC)
- Square Meter (SQM)

---

## Post-Deployment Verification

### 1. Access the Application

Open browser and navigate to: `http://localhost:3000` (or your production URL)

### 2. Login

- Navigate to `/login`
- Enter admin credentials
- Verify successful login and dashboard access

### 3. Test Core Features

#### a. Inventory Management
1. Go to **ERP → Inventory → Products**
2. Create a test metal product:
   - Name: "Stainless Steel Sheet 304"
   - Metal Alloy Type: "Stainless Steel"
   - Metal Grade: "304"
   - Metal Form: "Sheet"
   - Dimensions: Set thickness, width, length
3. Verify product creation

#### b. Warehouse Setup
1. Go to **ERP → Inventory → Warehouses**
2. View existing warehouses
3. Create warehouse locations if needed

#### c. Stock Management
1. Go to **ERP → Inventory → Stock Levels**
2. Add stock for the test product
3. Verify stock appears correctly

#### d. Purchase Order
1. Go to **ERP → Purchasing → Purchase Orders**
2. Create a test PO
3. Verify workflow

#### e. Sales Order
1. Go to **ERP → Sales → Orders**
2. Create a test SO
3. Verify workflow

### 4. Check Logs

```bash
# If using PM2
pm2 logs leo-metals-erp

# Or check application logs
tail -f logs/application.log
```

---

## Common Issues and Solutions

### Issue: Database Connection Failed

**Solution:**
- Verify PostgreSQL is running: `sudo systemctl status postgresql`
- Check database credentials in `.env.local`
- Ensure database exists and is accessible

### Issue: Build Fails

**Solution:**
- Clear cache: `rm -rf .next`
- Delete node_modules: `rm -rf node_modules`
- Reinstall dependencies: `npm install`
- Try build again: `npm run build`

### Issue: Port Already in Use

**Solution:**
```bash
# Find process using port 3000
lsof -i :3000

# Kill the process
kill -9 <PID>

# Or use a different port
PORT=3001 npm start
```

---

## Security Recommendations

1. **Change Default Credentials**: Update all default passwords and secrets
2. **Enable HTTPS**: Use SSL/TLS certificates in production
3. **Database Security**: Use strong passwords, restrict access
4. **Environment Variables**: Never commit `.env` files to version control
5. **Regular Updates**: Keep dependencies up to date
6. **Backup Strategy**: Implement regular database backups

---

## Backup and Recovery

### Database Backup

```bash
# Create backup
pg_dump -U postgres leometals_erp > backup_$(date +%Y%m%d_%H%M%S).sql

# Restore from backup
psql -U postgres leometals_erp < backup_20260202_120000.sql
```

### Application Backup

```bash
# Backup uploaded files (if any)
tar -czf uploads_backup_$(date +%Y%m%d).tar.gz public/uploads/

# Backup configuration
cp .env.local .env.backup
```

---

## Performance Optimization

1. **Database Indexing**: Ensure proper indexes on frequently queried columns
2. **Connection Pooling**: Configure PostgreSQL connection pool size
3. **Caching**: Implement Redis for session and data caching
4. **CDN**: Use CDN for static assets in production
5. **Load Balancing**: Use nginx or similar for load balancing

---

## Support and Maintenance

### Monitoring

Set up monitoring for:
- Application uptime
- Database performance
- Error logs
- API response times

### Regular Maintenance

- Weekly database backups
- Monthly dependency updates
- Quarterly security audits
- Regular log rotation

---

## Contact Information

For technical support or questions:
- Email: support@leometals.com
- Documentation: Check README.md
- Issues: Create issue on GitHub repository

---

**Last Updated**: February 2026
**Version**: 1.0.0
