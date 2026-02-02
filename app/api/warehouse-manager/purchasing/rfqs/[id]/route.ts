import { NextRequest, NextResponse } from 'next/server';
import { erpDb } from '@/lib/db';
import { requestForQuotations, rfqLines } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { getErpUserFromToken } from '@/lib/auth';

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getErpUserFromToken(req);
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (user.role !== 'warehouse_manager') {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const params = await context.params;
    const { id } = params;

    // Get RFQ with lines
    const rfq = await erpDb.query.requestForQuotations.findFirst({
      where: and(
        eq(requestForQuotations.id, id),
        eq(requestForQuotations.erpOrganizationId, user.organizationId)
      ),
      with: {
        lines: {
          with: {
            product: true,
          },
        },
        suppliers: {
          with: {
            supplier: true,
          },
        },
      },
    });

    if (!rfq) {
      return NextResponse.json({ error: 'RFQ not found' }, { status: 404 });
    }

    return NextResponse.json(rfq);
  } catch (error: any) {
    console.error('Error fetching RFQ:', error);
    return NextResponse.json(
      { error: 'Failed to fetch RFQ', details: error.message },
      { status: 500 }
    );
  }
}
