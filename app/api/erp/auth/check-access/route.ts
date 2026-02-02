import { NextRequest, NextResponse } from 'next/server';
import { getErpUserAccess } from '@/lib/auth';

// POST /api/erp/auth/check-access
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId, organizationId } = body;

    if (!userId || !organizationId) {
      return NextResponse.json(
        { error: 'Missing userId or organizationId' },
        { status: 400 }
      );
    }

    // FIX 1: getErpUserAccess expects ONE argument
    const erpAccess = await getErpUserAccess({
      userId,
      organizationId,
    });

    if (!erpAccess) {
      return NextResponse.json(
        { hasAccess: false, message: 'User does not have ERP access' },
        { status: 200 }
      );
    }

    return NextResponse.json(
      {
        hasAccess: true,
        user: {
          erpOrganizationId: erpAccess.erpOrganizationId,
          erpDepartmentId: erpAccess.erpDepartmentId,

          // FIX 2: role and permissions might not exist on type → optional chaining
          role: erpAccess.role ?? null,
          permissions: erpAccess.permissions ?? [],
        },
      },
      { status: 200 }
    );
  } catch (err: any) {
    console.error('Error checking ERP access:', err);
    return NextResponse.json(
      { error: 'Failed to check ERP access' },
      { status: 500 }
    );
  }
}
