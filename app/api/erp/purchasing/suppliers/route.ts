import { NextRequest, NextResponse } from 'next/server';
import { erpDb, mainDb } from '@/lib/db';
import { suppliers } from '@/lib/db/schema';
import { requireErpAccess, hasPermission } from '@/lib/auth';
import { eq, and, like, sql } from 'drizzle-orm';
import { sendEmail } from '@/lib/emailServices';
import { getSupplierWelcomeEmailTemplate } from '@/lib/emailTemplates';
import { handleDatabaseError, logDatabaseError } from '@/lib/db/error-handler';

// GET /api/erp/purchasing/suppliers
export async function GET(req: NextRequest) {
  const { user, error } = await requireErpAccess(req);
  if (error) return error;

  if (!hasPermission(user, 'purchasing', 'view')) {
    return NextResponse.json(
      { error: 'No permission to view suppliers' },
      { status: 403 }
    );
  }

  try {
    const searchParams = req.nextUrl.searchParams;
    const search = searchParams.get('search');
    const isActive = searchParams.get('isActive');

    const conditions = [eq(suppliers.erpOrganizationId, user.erpOrganizationId)];
    
    if (search) {
      conditions.push(like(suppliers.name, `%${search}%`));
    }
    
    if (isActive !== null) {
      conditions.push(eq(suppliers.isActive, isActive === 'true'));
    }

    const suppliersList = await erpDb.query.suppliers.findMany({
      where: and(...conditions),
      with: {
        contacts: true,
      },
    });

    return NextResponse.json({ suppliers: suppliersList });
  } catch (error: any) {
    logDatabaseError('Fetching suppliers', error);
    const dbError = handleDatabaseError(error);
    return NextResponse.json({ error: dbError.message }, { status: dbError.statusCode });
  }
}

// POST /api/erp/purchasing/suppliers
export async function POST(req: NextRequest) {
  const { user, error } = await requireErpAccess(req, 'user');
  if (error) return error;

  if (!hasPermission(user, 'purchasing', 'create')) {
    return NextResponse.json(
      { error: 'No permission to create suppliers' },
      { status: 403 }
    );
  }

  try {
    const body = await req.json();
    const {
      name,
      code,
      email,
      phone,
      website,
      address,
      city,
      state,
      country,
      postalCode,
      taxId,
      paymentTerms,
      currencyCode,
      notes,
    } = body;

    if (!name) {
      return NextResponse.json(
        { error: 'Supplier name is required' },
        { status: 400 }
      );
    }

    // Generate code if not provided
    const supplierCode = code || `SUP${Date.now().toString().slice(-6)}`;

    // Check if code already exists
    const existing = await erpDb.query.suppliers.findFirst({
      where: and(
        eq(suppliers.erpOrganizationId, user.erpOrganizationId),
        eq(suppliers.code, supplierCode)
      ),
    });

    if (existing) {
      return NextResponse.json(
        { error: 'Supplier with this code already exists' },
        { status: 409 }
      );
    }

    const [newSupplier] = await erpDb
      .insert(suppliers)
      .values({
        erpOrganizationId: user.erpOrganizationId,
        name,
        code: supplierCode,
        email,
        phone,
        website,
        address,
        city,
        state,
        country,
        postalCode,
        taxId,
        paymentTerms: paymentTerms || 30,
        currencyCode: currencyCode || 'INR',
        notes,
        createdBy: user.id,
        isActive: true,
      })
      .returning();

    // Send welcome email if supplier has email
    if (email) {
      try {
        // Fetch organization details from main DB
        const [org] = await mainDb.execute(
          sql`SELECT name, logo_url FROM organizations WHERE id = ${user.organizationId} LIMIT 1`
        );

        const organizationName = (org as any)?.name || 'Organization';
        const organizationLogo = (org as any)?.logo_url;

        const welcomeEmailHtml = getSupplierWelcomeEmailTemplate({
          supplierName: name,
          organizationName,
          organizationLogo,
          contactPerson: user.name,
        });

        await sendEmail({
          to: email,
          subject: `Welcome to ${organizationName} - Supplier Partnership`,
          html: welcomeEmailHtml,
        });

        console.log(`Welcome email sent to supplier: ${email}`);
      } catch (emailError) {
        console.error('Failed to send welcome email:', emailError);
        // Don't fail the request if email fails
      }
    }

    return NextResponse.json({ supplier: newSupplier }, { status: 201 });
  } catch (error: any) {
    logDatabaseError('Creating supplier', error);
    const dbError = handleDatabaseError(error);
    return NextResponse.json({ error: dbError.message }, { status: dbError.statusCode });
  }
}
