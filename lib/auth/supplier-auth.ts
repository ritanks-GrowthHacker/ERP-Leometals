import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'your-secret-key-change-in-production'
);

// Middleware to verify supplier authentication
export async function verifySupplierAuth(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
    }

    const token = authHeader.substring(7);
    const { payload } = await jwtVerify(token, JWT_SECRET);

    if (payload.type !== 'supplier') {
      return { error: NextResponse.json({ error: 'Invalid token type' }, { status: 401 }) };
    }

    return {
      supplier: {
        id: payload.supplierId as string,
        code: payload.supplierCode as string,
        name: payload.supplierName as string,
        email: payload.email as string,
      },
    };
  } catch (error) {
    return { error: NextResponse.json({ error: 'Invalid token' }, { status: 401 }) };
  }
}
