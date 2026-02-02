import { NextRequest, NextResponse } from 'next/server';
import { erpDb } from '@/lib/db';
import { sql } from 'drizzle-orm';
import bcrypt from 'bcryptjs';

// POST /api/v1/api-users - Create API user for an API key (PUBLIC - no auth required)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      apiKeyId,
      username,
      password,
      fullName,
      email,
      phone
    } = body;

    if (!apiKeyId || !username || !password) {
      return NextResponse.json(
        { success: false, error: 'API key ID, username, and password are required' },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { success: false, error: 'Password must be at least 8 characters long' },
        { status: 400 }
      );
    }

    // Check if API key exists (search by either UUID or api_key string)
    const apiKeyCheck = await erpDb.execute(sql`
      SELECT id FROM api_keys 
      WHERE id::text = ${apiKeyId} OR api_key = ${apiKeyId}
    `);

    if (!apiKeyCheck || apiKeyCheck.length === 0) {
      return NextResponse.json(
        { success: false, error: 'API key not found' },
        { status: 404 }
      );
    }

    const actualApiKeyId = (apiKeyCheck[0] as any).id;

    // Check if user already exists for this API key
    const existingUser = await erpDb.execute(sql`
      SELECT id FROM api_users WHERE api_key_id = ${actualApiKeyId}
    `);

    if (existingUser && existingUser.length > 0) {
      return NextResponse.json(
        { success: false, error: 'An API user already exists for this API key. Only one user per API key is allowed.' },
        { status: 400 }
      );
    }

    // Check if username is already taken
    const usernameCheck = await erpDb.execute(sql`
      SELECT id FROM api_users WHERE username = ${username}
    `);

    if (usernameCheck && usernameCheck.length > 0) {
      return NextResponse.json(
        { success: false, error: 'Username is already taken' },
        { status: 400 }
      );
    }

    // Hash the password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create API user
    const result = await erpDb.execute(sql`
      INSERT INTO api_users (
        api_key_id,
        username,
        password_hash,
        full_name,
        email,
        phone
      ) VALUES (
        ${actualApiKeyId},
        ${username},
        ${passwordHash},
        ${fullName || null},
        ${email || null},
        ${phone || null}
      )
      RETURNING id, api_key_id, username, full_name, email, phone, is_active, created_at
    `);

    const newUser = result[0] as any;

    return NextResponse.json({
      success: true,
      message: 'API user created successfully. Use these credentials to generate JWT tokens.',
      data: {
        id: newUser.id,
        apiKeyId: newUser.api_key_id,
        username: newUser.username,
        fullName: newUser.full_name,
        email: newUser.email,
        phone: newUser.phone,
        isActive: newUser.is_active,
        createdAt: newUser.created_at
      }
    }, { status: 201 });

  } catch (error: any) {
    console.error('Error creating API user:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to create API user' },
      { status: 500 }
    );
  }
}

// GET /api/v1/api-users - List all API users (PUBLIC for now)
export async function GET(request: NextRequest) {
  try {
    const result = await erpDb.execute(sql`
      SELECT 
        u.id,
        u.api_key_id,
        u.username,
        u.full_name,
        u.email,
        u.phone,
        u.is_active,
        u.last_login_at,
        u.created_at,
        k.name as api_key_name,
        k.company_name
      FROM api_users u
      LEFT JOIN api_keys k ON u.api_key_id = k.id
      ORDER BY u.created_at DESC
    `);

    const users = result.map((row: any) => ({
      id: row.id,
      apiKeyId: row.api_key_id,
      apiKeyName: row.api_key_name,
      companyName: row.company_name,
      username: row.username,
      fullName: row.full_name,
      email: row.email,
      phone: row.phone,
      isActive: row.is_active,
      lastLoginAt: row.last_login_at,
      createdAt: row.created_at
    }));

    return NextResponse.json({
      success: true,
      data: users
    });

  } catch (error) {
    console.error('Error fetching API users:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch API users' },
      { status: 500 }
    );
  }
}
