import { NextRequest, NextResponse } from 'next/server';
import { erpDb } from '@/lib/db';
import { requireErpAccess } from '@/lib/auth';
import { sql } from 'drizzle-orm';

// GET /api/erp/suppliers/ratings - Get ratings for suppliers
export async function GET(req: NextRequest) {
  const { user, error } = await requireErpAccess(req);
  if (error) return error;

  try {
    const searchParams = req.nextUrl.searchParams;
    const supplierId = searchParams.get('supplierId');

    let result;

    if (supplierId) {
      result = await erpDb.execute(sql`
        SELECT 
          r.*,
          s.name as supplier_name,
          s.code as supplier_code,
          u.name as rated_by_name
        FROM supplier_ratings r
        LEFT JOIN suppliers s ON r.supplier_id = s.id
        LEFT JOIN users u ON r.rated_by = u.id
        WHERE r.erp_organization_id = ${user.erpOrganizationId}
        AND r.supplier_id = ${supplierId}
        ORDER BY r.created_at DESC
      `);
    } else {
      result = await erpDb.execute(sql`
        SELECT 
          r.*,
          s.name as supplier_name,
          s.code as supplier_code,
          u.name as rated_by_name
        FROM supplier_ratings r
        LEFT JOIN suppliers s ON r.supplier_id = s.id
        LEFT JOIN users u ON r.rated_by = u.id
        WHERE r.erp_organization_id = ${user.erpOrganizationId}
        ORDER BY r.created_at DESC
      `);
    }

    const ratings = Array.from(result);

    return NextResponse.json({
      ratings: ratings,
      total: ratings.length,
    });
  } catch (error: any) {
    console.error('Error fetching ratings:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/erp/suppliers/ratings - Create rating
export async function POST(req: NextRequest) {
  const { user, error } = await requireErpAccess(req, 'user');
  if (error) return error;

  try {
    const body = await req.json();
    const {
      supplierId,
      purchaseOrderId,
      invoiceId,
      qualityRating,
      deliveryRating,
      communicationRating,
      pricingRating,
      reviewTitle,
      reviewText,
      wouldRecommend,
      isPublic,
    } = body;

    if (!supplierId) {
      return NextResponse.json({ error: 'Supplier ID is required' }, { status: 400 });
    }

    if (!qualityRating || !deliveryRating || !communicationRating || !pricingRating) {
      return NextResponse.json({ error: 'All ratings are required' }, { status: 400 });
    }

    const insertResult = await erpDb.execute(sql`
      INSERT INTO supplier_ratings (
        erp_organization_id,
        supplier_id,
        purchase_order_id,
        invoice_id,
        quality_rating,
        delivery_rating,
        communication_rating,
        pricing_rating,
        review_title,
        review_text,
        would_recommend,
        rated_by,
        is_public
      ) VALUES (
        ${user.erpOrganizationId},
        ${supplierId},
        ${purchaseOrderId},
        ${invoiceId},
        ${qualityRating},
        ${deliveryRating},
        ${communicationRating},
        ${pricingRating},
        ${reviewTitle},
        ${reviewText},
        ${wouldRecommend},
        ${user.id},
        ${isPublic || false}
      )
      RETURNING *
    `);

    const ratingResult = Array.from(insertResult);

    // Notify supplier
    await erpDb.execute(sql`
      INSERT INTO supplier_portal_notifications (
        supplier_id,
        notification_type,
        title,
        message,
        related_entity_type,
        related_entity_id
      ) VALUES (
        ${supplierId},
        'rating_received',
        'New Rating Received',
        ${`You received a ${ratingResult[0].overall_rating} star rating`},
        'rating',
        ${ratingResult[0].id}
      )
    `);

    return NextResponse.json({
      message: 'Rating submitted successfully',
      rating: ratingResult[0],
    }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating rating:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
