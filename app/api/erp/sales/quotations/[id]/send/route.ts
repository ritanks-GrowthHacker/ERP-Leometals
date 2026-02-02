import { NextRequest, NextResponse } from 'next/server';
import { erpDb } from '@/lib/db';
import { salesQuotations } from '@/lib/db/schema';
import { requireErpAccess, hasPermission } from '@/lib/auth';
import { eq, and } from 'drizzle-orm';
import { handleDatabaseError, logDatabaseError } from '@/lib/db/error-handler';
import { sendEmail } from '@/lib/emailServices';
import { getQuotationEmailTemplate } from '@/lib/emailTemplates';

// POST /api/erp/sales/quotations/[id]/send
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { user, error } = await requireErpAccess(req);
  if (error) return error;

  if (!hasPermission(user, 'sales', 'edit')) {
    return NextResponse.json(
      { error: 'No permission to send quotations' },
      { status: 403 }
    );
  }

  try {
    const params = await context.params;
    const quotationId = params.id;

    if (!quotationId) {
      return NextResponse.json(
        { error: 'Quotation ID is required' },
        { status: 400 }
      );
    }

    // Check if quotation exists and belongs to organization
    const existingQuotation = await erpDb.query.salesQuotations.findFirst({
      where: and(
        eq(salesQuotations.id, quotationId),
        eq(salesQuotations.erpOrganizationId, user.organizationId)
      ),
      with: {
        customer: true,
        lines: {
          with: {
            product: true,
          },
        },
      },
    });

    if (!existingQuotation) {
      return NextResponse.json(
        { error: 'Quotation not found' },
        { status: 404 }
      );
    }

    // Only allow sending draft quotations or resending already sent quotations
    if (existingQuotation.status !== 'draft' && existingQuotation.status !== 'sent' && existingQuotation.status !== 'declined' && existingQuotation.status !== 'expired') {
      return NextResponse.json(
        { error: 'Only draft, sent, declined, or expired quotations can be sent' },
        { status: 400 }
      );
    }

    // Validate quotation has items
    if (!existingQuotation.lines || existingQuotation.lines.length === 0) {
      return NextResponse.json(
        { error: 'Quotation must have at least one item' },
        { status: 400 }
      );
    }

    // Update quotation status to 'sent'
    const [updatedQuotation] = await erpDb
      .update(salesQuotations)
      .set({
        status: 'sent',
        updatedAt: new Date(),
      })
      .where(eq(salesQuotations.id, quotationId))
      .returning();

    // Send email notification to customer
    let emailSent = false;
    let emailError = null;
    
    try {
      const customer = existingQuotation.customer as any;
      console.log('📧 Attempting to send email to customer:', customer?.email);
      
      if (!customer?.email) {
        console.warn('⚠️ Customer has no email address');
        emailError = 'Customer has no email address';
      } else {
        const quotationData = {
          id: quotationId, // Add quotation ID for customer response
          quotationNumber: existingQuotation.quotationNumber,
          quotationDate: new Date(existingQuotation.quotationDate).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          }),
          validUntil: existingQuotation.validUntil
            ? new Date(existingQuotation.validUntil).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })
            : undefined,
          customerName: customer.name || 'Customer',
          customerEmail: customer.email,
          totalAmount: (existingQuotation.totalAmount || 0).toString(),
          currencyCode: existingQuotation.currencyCode || 'INR',
          lines: existingQuotation.lines.map((line) => {
            const quantity = parseFloat(line.quantity || '0');
            const unitPrice = parseFloat(line.unitPrice || '0');
            const total = (quantity * unitPrice).toFixed(2);
            
            return {
              productName: line.product?.name || 'Product',
              description: line.description || undefined,
              quantity: line.quantity || '0',
              unitPrice: line.unitPrice || '0',
              total: total,
            };
          }),
          notes: existingQuotation.notes || undefined,
        };

        console.log('📝 Generating email template...');
        const emailHtml = getQuotationEmailTemplate(
          quotationData,
          'ERP System'
        );

        console.log('📤 Sending email to:', customer.email);
        const emailResult = await sendEmail({
          to: customer.email,
          subject: `Quotation ${existingQuotation.quotationNumber}`,
          html: emailHtml,
        });
        
        if (emailResult.success) {
          console.log('✅ Email sent successfully! Message ID:', emailResult.messageId);
          emailSent = true;
        } else {
          console.error('❌ Email sending failed:', emailResult.error);
          emailError = emailResult.error;
        }
      }
    } catch (error) {
      console.error('❌ Error in email sending process:', error);
      emailError = error instanceof Error ? error.message : 'Unknown error';
    }

    return NextResponse.json({
      success: true,
      quotation: updatedQuotation,
      message: 'Quotation sent successfully',
      emailSent,
      emailError,
    });
  } catch (error: any) {
    console.error('Error sending quotation:', error);
    logDatabaseError('Sending sales quotation', error);
    const dbError = handleDatabaseError(error);
    return NextResponse.json({ error: dbError.message }, { status: dbError.statusCode });
  }
}
