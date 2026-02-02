import { NextRequest, NextResponse } from 'next/server';
import { erpDb, mainDb } from '@/lib/db';
import { stockLevels } from '@/lib/db/schema';
import { requireErpAccess, hasPermission } from '@/lib/auth';
import { sql } from 'drizzle-orm';
import { sendEmail } from '@/lib/emailServices';
import { getStockAlertEmailTemplate } from '@/lib/emailTemplates';

// POST /api/erp/inventory/alerts/send
export async function POST(req: NextRequest) {
  const { user, error } = await requireErpAccess(req);
  if (error) return error;

  if (!hasPermission(user, 'inventory', 'view')) {
    return NextResponse.json(
      { error: 'No permission to send alerts' },
      { status: 403 }
    );
  }

  try {
    // Fetch all stock levels with low stock
    const lowStockItems = await erpDb.query.stockLevels.findMany({
      with: {
        product: true,
        warehouse: true,
      },
    });

    // Filter for items below reorder point
    const alertItems = lowStockItems.filter((sl: any) => {
      const available = parseFloat(sl.quantityOnHand || '0');
      const reorderPoint = parseFloat(sl.product?.reorderPoint || '0');
      return reorderPoint > 0 && available <= reorderPoint;
    });

    if (alertItems.length === 0) {
      return NextResponse.json({ 
        message: 'No low stock items found',
        alertsSent: 0 
      });
    }

    // Fetch organization details for email
    const [org] = await mainDb.execute(
      sql`SELECT name, logo_url FROM organizations WHERE id = ${user.organizationId} LIMIT 1`
    );

    const organizationName = (org as any)?.name || 'Organization';
    const organizationLogo = (org as any)?.logo_url;

    // Get purchasing manager emails (users with purchasing permissions)
    // For now, we'll send to the user who triggered this
    const recipientEmails = [user.email];

    // Send email for each low stock item
    const emailPromises = alertItems.map(async (item: any) => {
      const available = parseFloat(item.quantityOnHand || '0');
      const reorderPoint = parseFloat(item.product?.reorderPoint || '0');
      const suggestedOrder = Math.ceil((reorderPoint * 2) - available); // Suggest ordering double the reorder point minus current

      const emailHtml = getStockAlertEmailTemplate(
        {
          productName: item.product.name,
          productSku: item.product.sku,
          currentQuantity: available.toString(),
          reorderPoint: reorderPoint.toString(),
          warehouseName: item.warehouse.name,
          suggestedOrderQuantity: suggestedOrder > 0 ? suggestedOrder.toString() : undefined,
        },
        organizationName,
        organizationLogo
      );

      // Send to all recipients
      return Promise.all(
        recipientEmails.map(email =>
          sendEmail({
            to: email,
            subject: `⚠️ Low Stock Alert: ${item.product.name} (${item.warehouse.name})`,
            html: emailHtml,
          })
        )
      );
    });

    await Promise.all(emailPromises);

    return NextResponse.json({
      success: true,
      message: `Sent ${alertItems.length} low stock alerts`,
      alertsSent: alertItems.length,
      items: alertItems.map((item: any) => ({
        productName: item.product.name,
        warehouseName: item.warehouse.name,
        currentStock: parseFloat(item.quantityOnHand || '0'),
        reorderPoint: parseFloat(item.product?.reorderPoint || '0'),
      })),
    });
  } catch (err: any) {
    console.error('Error sending low stock alerts:', err);
    return NextResponse.json(
      { error: 'Failed to send low stock alerts' },
      { status: 500 }
    );
  }
}

// GET /api/erp/inventory/alerts/send - Check what alerts would be sent
export async function GET(req: NextRequest) {
  const { user, error } = await requireErpAccess(req);
  if (error) return error;

  if (!hasPermission(user, 'inventory', 'view')) {
    return NextResponse.json(
      { error: 'No permission to view alerts' },
      { status: 403 }
    );
  }

  try {
    // Fetch all stock levels with low stock
    const lowStockItems = await erpDb.query.stockLevels.findMany({
      with: {
        product: true,
        warehouse: true,
      },
    });

    // Filter for items below reorder point
    const alertItems = lowStockItems.filter((sl: any) => {
      const available = parseFloat(sl.quantityOnHand || '0');
      const reorderPoint = parseFloat(sl.product?.reorderPoint || '0');
      return reorderPoint > 0 && available <= reorderPoint;
    });

    return NextResponse.json({
      alertCount: alertItems.length,
      items: alertItems.map((item: any) => ({
        productId: item.productId,
        productName: item.product.name,
        productSku: item.product.sku,
        warehouseId: item.warehouseId,
        warehouseName: item.warehouse.name,
        currentStock: parseFloat(item.quantityOnHand || '0'),
        reorderPoint: parseFloat(item.product?.reorderPoint || '0'),
        suggestedOrderQuantity: Math.ceil((parseFloat(item.product?.reorderPoint || '0') * 2) - parseFloat(item.quantityOnHand || '0')),
      })),
    });
  } catch (err: any) {
    console.error('Error checking low stock alerts:', err);
    return NextResponse.json(
      { error: 'Failed to check low stock alerts' },
      { status: 500 }
    );
  }
}
