import { NextRequest, NextResponse } from 'next/server';
import { erpDb } from '@/lib/db';
import { sql } from 'drizzle-orm';
import { requireErpAccess, hasPermission } from '@/lib/auth';

// GET /api/v1/api-keys/[id] - Get a specific API key
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, error } = await requireErpAccess(request);
  if (error) return error;

  if (!hasPermission(user, 'sales', 'view')) {
    return NextResponse.json({ error: 'No permission to view API keys' }, { status: 403 });
  }

  // Await params
  const { id } = await params;

  try {
    const result = await erpDb.execute(sql`
      SELECT ak.*
      FROM api_keys ak
      WHERE ak.id = ${id}
    `);

    if (!result || result.length === 0) {
      return NextResponse.json(
        { success: false, error: 'API key not found' },
        { status: 404 }
      );
    }

    const row = result[0] as any;

    return NextResponse.json({
      success: true,
      data: {
        id: row.id,
        name: row.name,
        apiKey: row.api_key,
        apiKeyMasked: `${row.api_key.substring(0, 12)}...${row.api_key.substring(row.api_key.length - 4)}`,
        scopes: row.scopes,
        rateLimitPerHour: row.rate_limit_per_hour,
        isActive: row.is_active,
        lastUsedAt: row.last_used_at,
        expiresAt: row.expires_at,
        environment: row.environment,
        description: row.description,
        allowedIps: row.allowed_ips,
        webhookUrl: row.webhook_url,
        webhookEvents: row.webhook_events,
        createdAt: row.created_at
      }
    });

  } catch (error) {
    console.error('Error fetching API key:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch API key' },
      { status: 500 }
    );
  }
}

// PATCH /api/v1/api-keys/[id] - Update API key
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, error } = await requireErpAccess(request);
  if (error) return error;

  if (!hasPermission(user, 'sales', 'edit')) {
    return NextResponse.json({ error: 'No permission to edit API keys' }, { status: 403 });
  }

  // Await params
  const { id } = await params;

  try {
    const body = await request.json();
    const {
      name,
      description,
      scopes,
      rateLimitPerHour,
      isActive,
      allowedIps,
      webhookUrl,
      webhookEvents
    } = body;

    // Verify API key exists
    const checkResult = await erpDb.execute(sql`
      SELECT id FROM api_keys
      WHERE id = ${id}
    `);

    if (!checkResult || checkResult.length === 0) {
      return NextResponse.json(
        { success: false, error: 'API key not found' },
        { status: 404 }
      );
    }

    // Build update query dynamically
    const updates: string[] = [];
    const values: any[] = [];

    if (name !== undefined) {
      updates.push(`name = $${updates.length + 1}`);
      values.push(name);
    }
    if (description !== undefined) {
      updates.push(`description = $${updates.length + 1}`);
      values.push(description);
    }
    if (scopes !== undefined) {
      updates.push(`scopes = $${updates.length + 1}`);
      values.push(scopes);
    }
    if (rateLimitPerHour !== undefined) {
      updates.push(`rate_limit_per_hour = $${updates.length + 1}`);
      values.push(rateLimitPerHour);
    }
    if (isActive !== undefined) {
      updates.push(`is_active = $${updates.length + 1}`);
      values.push(isActive);
    }
    if (allowedIps !== undefined) {
      updates.push(`allowed_ips = $${updates.length + 1}`);
      values.push(allowedIps.length > 0 ? allowedIps : null);
    }
    if (webhookUrl !== undefined) {
      updates.push(`webhook_url = $${updates.length + 1}`);
      values.push(webhookUrl);
    }
    if (webhookEvents !== undefined) {
      updates.push(`webhook_events = $${updates.length + 1}`);
      values.push(webhookEvents.length > 0 ? webhookEvents : null);
    }

    if (updates.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No fields to update' },
        { status: 400 }
      );
    }

    updates.push(`updated_at = NOW()`);

    // Execute update
    await erpDb.execute(sql`
      UPDATE api_keys
      SET ${sql.raw(updates.join(', '))}
      WHERE id = ${id}
    `);

    return NextResponse.json({
      success: true,
      message: 'API key updated successfully'
    });

  } catch (error) {
    console.error('Error updating API key:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update API key' },
      { status: 500 }
    );
  }
}

// DELETE /api/v1/api-keys/[id] - Delete (revoke) API key
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, error } = await requireErpAccess(request);
  if (error) return error;

  if (!hasPermission(user, 'sales', 'delete')) {
    return NextResponse.json({ error: 'No permission to delete API keys' }, { status: 403 });
  }

  // Await params
  const { id } = await params;

  try {
    // Delete API key
    const result = await erpDb.execute(sql`
      DELETE FROM api_keys
      WHERE id = ${id}
      RETURNING id
    `);

    if (!result || result.length === 0) {
      return NextResponse.json(
        { success: false, error: 'API key not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'API key revoked successfully'
    });

  } catch (error) {
    console.error('Error deleting API key:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete API key' },
      { status: 500 }
    );
  }
}