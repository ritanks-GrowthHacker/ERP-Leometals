import { NextRequest, NextResponse } from 'next/server';
import { erpDb } from '@/lib/db';
import { sql } from 'drizzle-orm';
import { requireErpAccess, hasPermission } from '@/lib/auth';
import { generateApiKey } from '@/lib/auth/apiAuth';

// GET /api/v1/api-keys - List all API keys for the organization
export async function GET(request: NextRequest) {
  const { user, error } = await requireErpAccess(request);
  if (error) return error;

  if (!hasPermission(user, 'sales', 'view')) {
    return NextResponse.json({ error: 'No permission to view API keys' }, { status: 403 });
  }

  try {
    // Fetch all API keys (no user filtering since we removed user_id)
    const result = await erpDb.execute(sql`
      SELECT 
        ak.id,
        ak.name,
        ak.api_key,
        ak.scopes,
        ak.rate_limit_per_hour,
        ak.is_active,
        ak.last_used_at,
        ak.expires_at,
        ak.environment,
        ak.description,
        ak.created_at
      FROM api_keys ak
      ORDER BY ak.created_at DESC
    `);

    const apiKeys = result.map((row: any) => ({
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
      createdAt: row.created_at
    }));

    return NextResponse.json({
      success: true,
      data: apiKeys
    });

  } catch (error) {
    console.error('Error fetching API keys:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch API keys' },
      { status: 500 }
    );
  }
}

// POST /api/v1/api-keys - Create a new API key
export async function POST(request: NextRequest) {
  const { user, error } = await requireErpAccess(request);
  if (error) return error;

  if (!hasPermission(user, 'sales', 'create')) {
    return NextResponse.json({ error: 'No permission to create API keys' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const {
      name,
      description,
      companyName,
      companyEmail,
      companyPhone,
      companyAddress,
      contactPerson,
      scopes = ['read'],
      rateLimitPerHour = 1000,
      expiresInDays,
      environment = 'production',
      allowedIps = []
    } = body;

    if (!name) {
      return NextResponse.json(
        { success: false, error: 'Name is required' },
        { status: 400 }
      );
    }

    if (!companyName || !companyEmail || !contactPerson) {
      return NextResponse.json(
        { success: false, error: 'Company name, email, and contact person are required' },
        { status: 400 }
      );
    }

    // Validate scopes
    const validScopes = ['read', 'write', 'delete', 'admin'];
    const invalidScopes = scopes.filter((s: string) => !validScopes.includes(s));
    if (invalidScopes.length > 0) {
      return NextResponse.json(
        { success: false, error: `Invalid scopes: ${invalidScopes.join(', ')}` },
        { status: 400 }
      );
    }

    // Generate API key and secret
    const { key, secret } = generateApiKey();

    // Calculate expiration date
    let expiresAt = null;
    if (expiresInDays) {
      expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + expiresInDays);
    }

    // Insert into database
    const result = await erpDb.execute(sql`
      INSERT INTO api_keys (
        name,
        api_key,
        api_secret,
        sub_organisation_id,
        company_name,
        company_email,
        company_phone,
        company_address,
        contact_person,
        scopes,
        rate_limit_per_hour,
        expires_at,
        environment,
        description,
        allowed_ips,
        rate_limit_reset_at
      ) VALUES (
        ${name},
        ${key},
        ${secret},
        ${user.erpOrganizationId},
        ${companyName},
        ${companyEmail},
        ${companyPhone || null},
        ${companyAddress || null},
        ${contactPerson},
        ARRAY[${sql.join(scopes.map((s: string) => sql`${s}`), sql`, `)}]::text[],
        ${rateLimitPerHour},
        ${expiresAt ? expiresAt.toISOString() : null},
        ${environment},
        ${description || null},
        ${allowedIps.length > 0 ? sql`ARRAY[${sql.join(allowedIps.map((ip: string) => sql`${ip}`), sql`, `)}]::text[]` : null},
        ${new Date(Date.now() + 60 * 60 * 1000).toISOString()}
      )
      RETURNING id, name, api_key, api_secret, company_name, company_email, company_phone, company_address, contact_person, scopes, rate_limit_per_hour, expires_at, environment, created_at
    `);

    const newApiKey = result[0] as any;

    return NextResponse.json({
      success: true,
      message: 'API key created successfully. Please save the secret key securely as it will not be shown again. Next step: Create an API user using this API key ID.',
      data: {
        id: newApiKey.id,
        name: newApiKey.name,
        apiKey: newApiKey.api_key,
        apiSecret: newApiKey.api_secret, // Only returned once during creation
        fullCredential: `${newApiKey.api_key}:${newApiKey.api_secret}`, // For easy copy-paste
        companyName: newApiKey.company_name,
        companyEmail: newApiKey.company_email,
        companyPhone: newApiKey.company_phone,
        companyAddress: newApiKey.company_address,
        contactPerson: newApiKey.contact_person,
        scopes: newApiKey.scopes,
        rateLimitPerHour: newApiKey.rate_limit_per_hour,
        expiresAt: newApiKey.expires_at,
        environment: newApiKey.environment,
        createdAt: newApiKey.created_at
      }
    }, { status: 201 });

  } catch (error) {
    console.error('Error creating API key:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create API key' },
      { status: 500 }
    );
  }
}
