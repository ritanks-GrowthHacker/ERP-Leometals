import { NextRequest, NextResponse } from 'next/server';
import { requireApiAuth, hasScope } from '@/lib/auth/apiUserAuth';
import { erpDb } from '@/lib/db';
import { sql } from 'drizzle-orm';

/**
 * GET /api/v1/audit/logs
 * Fetch audit logs with filters
 * Query params:
 * - type: customers | products | warehouse | monthly | yearly | weekly
 * - entityId: specific entity ID (optional)
 * - startDate: ISO date string (optional)
 * - endDate: ISO date string (optional)
 * - limit: number of records (default 100)
 * - offset: pagination offset (default 0)
 */
export async function GET(req: NextRequest) {
  const { user, error } = await requireApiAuth(req);
  if (error) return error;

  if (!hasScope(user, 'read')) {
    return NextResponse.json(
      { success: false, error: 'Insufficient permissions. Requires "read" scope.' },
      { status: 403 }
    );
  }

  try {
    const searchParams = req.nextUrl.searchParams;
    
    const type = searchParams.get('type');
    const entityId = searchParams.get('entityId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const limit = parseInt(searchParams.get('limit') || '100');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Build query conditions
    let conditions = [`erp_organization_id = '${user.erpOrganizationId}'`];

    if (type && ['customers', 'products', 'warehouse'].includes(type.toLowerCase())) {
      conditions.push(`entity_type = ${sql.raw(`'${type}'`)}`);
    }

    if (entityId) {
      conditions.push(`entity_id = ${sql.raw(`'${entityId}'`)}`);
    }

    if (startDate) {
      conditions.push(`created_at >= ${sql.raw(`'${startDate}'`)}`);
    }

    if (endDate) {
      conditions.push(`created_at <= ${sql.raw(`'${endDate}'`)}`);
    }

    // For time-based filters
    if (type === 'weekly') {
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      conditions.push(`created_at >= ${sql.raw(`'${weekAgo.toISOString()}'`)}`);
    } else if (type === 'monthly') {
      const monthAgo = new Date();
      monthAgo.setMonth(monthAgo.getMonth() - 1);
      conditions.push(`created_at >= ${sql.raw(`'${monthAgo.toISOString()}'`)}`);
    } else if (type === 'yearly') {
      const yearAgo = new Date();
      yearAgo.setFullYear(yearAgo.getFullYear() - 1);
      conditions.push(`created_at >= ${sql.raw(`'${yearAgo.toISOString()}'`)}`);
    }

    const whereClause = conditions.join(' AND ');

    // Fetch audit logs
    const logs = await erpDb.execute(sql`
      SELECT 
        id,
        entity_type,
        entity_id,
        action,
        user_id,
        user_name,
        changes,
        ip_address,
        user_agent,
        created_at
      FROM audit_logs
      WHERE ${sql.raw(whereClause)}
      ORDER BY created_at DESC
      LIMIT ${limit}
      OFFSET ${offset}
    `);

    // Get total count
    const countResult = await erpDb.execute(sql`
      SELECT COUNT(*) as total
      FROM audit_logs
      WHERE ${sql.raw(whereClause)}
    `);

    const total = (countResult[0] as any)?.total || 0;

    return NextResponse.json({
      success: true,
      data: logs,
      pagination: {
        limit,
        offset,
        total,
        hasNext: offset + limit < total,
        hasPrev: offset > 0,
      }
    });

  } catch (error) {
    console.error('Error fetching audit logs:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch audit logs',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/v1/audit/logs
 * Create a new audit log entry
 */
export async function POST(req: NextRequest) {
  const { user, error } = await requireApiAuth(req);
  if (error) return error;

  if (!hasScope(user, 'write')) {
    return NextResponse.json(
      { success: false, error: 'Insufficient permissions. Requires "write" scope.' },
      { status: 403 }
    );
  }

  try {
    const body = await req.json();

    const {
      entityType,
      entityId,
      action,
      changes,
    } = body;

    // Validate required fields
    if (!entityType || !entityId || !action) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: entityType, entityId, action' },
        { status: 400 }
      );
    }

    // Get client info
    const ipAddress = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
    const userAgent = req.headers.get('user-agent') || 'unknown';

    // Insert audit log
    const result = await erpDb.execute(sql`
      INSERT INTO audit_logs (
        erp_organization_id,
        entity_type,
        entity_id,
        action,
        user_id,
        user_name,
        changes,
        ip_address,
        user_agent
      ) VALUES (
        ${user.erpOrganizationId},
        ${entityType},
        ${entityId},
        ${action},
        ${user.userId},
        ${user.fullName || user.username},
        ${JSON.stringify(changes || {})},
        ${ipAddress},
        ${userAgent}
      )
      RETURNING *
    `);

    return NextResponse.json({
      success: true,
      data: result[0],
      message: 'Audit log created successfully'
    });

  } catch (error) {
    console.error('Error creating audit log:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to create audit log',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
