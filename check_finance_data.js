const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.ERP_DATABASE_URL,
});

async function checkFinanceData() {
  try {
    console.log('=== CHECKING FINANCE DATA ===\n');
    
    // Check organizations
    const orgs = await pool.query('SELECT id, main_org_id, erp_enabled FROM erp_organizations');
    console.log('ERP Organizations:', orgs.rows.length);
    orgs.rows.forEach(org => {
      console.log(`  - ID: ${org.id}, Main Org: ${org.main_org_id}, ERP Enabled: ${org.erp_enabled}`);
    });
    console.log('');
    
    // Check sales invoices
    const sales = await pool.query('SELECT erp_organization_id, COUNT(*), SUM(total_amount) as total FROM sales_invoices_gst GROUP BY erp_organization_id');
    console.log('Sales Invoices by Org:');
    if (sales.rows.length === 0) {
      console.log('  NO DATA FOUND IN sales_invoices_gst');
    } else {
      sales.rows.forEach(row => {
        console.log(`  - Org: ${row.erp_organization_id}, Count: ${row.count}, Total: ${row.total}`);
      });
    }
    console.log('');
    
    // Check purchase invoices
    const purchase = await pool.query('SELECT erp_organization_id, COUNT(*), SUM(total_amount) as total FROM purchase_invoices_gst GROUP BY erp_organization_id');
    console.log('Purchase Invoices by Org:');
    if (purchase.rows.length === 0) {
      console.log('  NO DATA FOUND IN purchase_invoices_gst');
    } else {
      purchase.rows.forEach(row => {
        console.log(`  - Org: ${row.erp_organization_id}, Count: ${row.count}, Total: ${row.total}`);
      });
    }
    console.log('');
    
    // Check customers
    const customers = await pool.query('SELECT COUNT(*) FROM customers');
    console.log(`Total Customers: ${customers.rows[0].count}\n`);
    
    // Check suppliers
    const suppliers = await pool.query('SELECT COUNT(*) FROM suppliers');
    console.log(`Total Suppliers: ${suppliers.rows[0].count}\n`);
    
    await pool.end();
  } catch (error) {
    console.error('ERROR:', error.message);
    process.exit(1);
  }
}

checkFinanceData();
