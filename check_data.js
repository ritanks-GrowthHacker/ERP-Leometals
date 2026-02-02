const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.ERP_DATABASE_URL,
});

async function checkData() {
  try {
    console.log('\n=== CHECKING DATABASE DATA ===\n');

    // Check erp_organizations
    const orgs = await pool.query('SELECT COUNT(*) as count FROM erp_organizations');
    console.log(`ERP Organizations: ${orgs.rows[0].count}`);

    // Check sales invoices
    const salesInv = await pool.query('SELECT COUNT(*) as count FROM sales_invoices_gst');
    console.log(`Sales Invoices (GST): ${salesInv.rows[0].count}`);

    // Check purchase invoices
    const purchaseInv = await pool.query('SELECT COUNT(*) as count FROM purchase_invoices_gst');
    console.log(`Purchase Invoices (GST): ${purchaseInv.rows[0].count}`);

    // Check customers
    const customers = await pool.query('SELECT COUNT(*) as count FROM customers');
    console.log(`Customers: ${customers.rows[0].count}`);

    // Check suppliers
    const suppliers = await pool.query('SELECT COUNT(*) as count FROM suppliers');
    console.log(`Suppliers: ${suppliers.rows[0].count}`);

    console.log('\n=== ORGANIZATION DETAILS ===\n');
    
    // Show organizations
    const orgDetails = await pool.query('SELECT id, main_org_id, erp_enabled FROM erp_organizations');
    console.log('Organizations:');
    orgDetails.rows.forEach(org => {
      console.log(`  ID: ${org.id}, Main Org ID: ${org.main_org_id}, ERP Enabled: ${org.erp_enabled}`);
    });

    console.log('\n=== SALES INVOICES BY ORG ===\n');
    
    // Sales invoices by org
    const salesByOrg = await pool.query(`
      SELECT 
        si.erp_organization_id, 
        COUNT(*) as invoice_count,
        SUM(total_amount) as total_revenue,
        SUM(total_gst_amount) as total_gst
      FROM sales_invoices_gst si
      GROUP BY si.erp_organization_id
    `);
    
    if (salesByOrg.rows.length === 0) {
      console.log('NO SALES INVOICES FOUND IN DATABASE');
    } else {
      salesByOrg.rows.forEach(row => {
        console.log(`  Org ID: ${row.erp_organization_id}`);
        console.log(`    Invoices: ${row.invoice_count}`);
        console.log(`    Revenue: ₹${row.total_revenue}`);
        console.log(`    GST: ₹${row.total_gst}\n`);
      });
    }

    console.log('\n=== PURCHASE INVOICES BY ORG ===\n');
    
    // Purchase invoices by org
    const purchaseByOrg = await pool.query(`
      SELECT 
        pi.erp_organization_id, 
        COUNT(*) as invoice_count,
        SUM(total_amount) as total_expenses,
        SUM(itc_cgst_amount + itc_sgst_amount + itc_igst_amount) as total_itc
      FROM purchase_invoices_gst pi
      GROUP BY pi.erp_organization_id
    `);
    
    if (purchaseByOrg.rows.length === 0) {
      console.log('NO PURCHASE INVOICES FOUND IN DATABASE');
    } else {
      purchaseByOrg.rows.forEach(row => {
        console.log(`  Org ID: ${row.erp_organization_id}`);
        console.log(`    Invoices: ${row.invoice_count}`);
        console.log(`    Expenses: ₹${row.total_expenses}`);
        console.log(`    ITC: ₹${row.total_itc}\n`);
      });
    }

  } catch (error) {
    console.error('ERROR:', error.message);
  } finally {
    await pool.end();
  }
}

checkData();
