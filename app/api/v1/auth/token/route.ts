import { NextRequest, NextResponse } from 'next/server';
import { erpDb } from '@/lib/db';
import { sql } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { JWT_SECRET, JWT_EXPIRES_IN } from '@/lib/auth/config';

// POST /api/v1/auth/token - Generate JWT token using API username/password
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { username, password } = body;

    if (!username || !password) {
      return NextResponse.json(
        { success: false, error: 'Username and password are required' },
        { status: 400 }
      );
    }

    // Find user by username
    const result = await erpDb.execute(sql`
      SELECT 
        u.id,
        u.api_key_id,
        u.username,
        u.password_hash,
        u.full_name,
        u.email,
        u.is_active,
        k.name as api_key_name,
        k.company_name,
        k.scopes,
        k.is_active as api_key_active,
        k.expires_at,
        k.erp_organization_id
      FROM api_users u
      INNER JOIN api_keys k ON u.api_key_id = k.id
      WHERE u.username = ${username}
    `);

    if (!result || result.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    const user = result[0] as any;

    // Check if user is active
    if (!user.is_active) {
      return NextResponse.json(
        { success: false, error: 'User account is disabled' },
        { status: 403 }
      );
    }

    // Check if API key is active
    if (!user.api_key_active) {
      return NextResponse.json(
        { success: false, error: 'API key is disabled' },
        { status: 403 }
      );
    }

    // Check if API key is expired
    if (user.expires_at && new Date(user.expires_at) < new Date()) {
      return NextResponse.json(
        { success: false, error: 'API key has expired' },
        { status: 403 }
      );
    }

    // Verify password
    const passwordMatch = await bcrypt.compare(password, user.password_hash);

    if (!passwordMatch) {
      return NextResponse.json(
        { success: false, error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    // Update last login
    await erpDb.execute(sql`
      UPDATE api_users
      SET last_login_at = CURRENT_TIMESTAMP
      WHERE id = ${user.id}
    `);

    // Generate JWT token (expires in 2 hours)
    console.log('TOKEN GENERATION - JWT_SECRET:', JWT_SECRET.substring(0, 30) + '...');
    console.log('TOKEN GENERATION - Current server time:', new Date().toISOString());
    console.log('TOKEN GENERATION - User org ID:', user.erp_organization_id);
    
    const token = jwt.sign(
      {
        userId: user.id,
        username: user.username,
        apiKeyId: user.api_key_id,
        apiKeyName: user.api_key_name,
        companyName: user.company_name,
        scopes: user.scopes,
        fullName: user.full_name,
        email: user.email,
        erpOrganizationId: user.erp_organization_id
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );
    
    const decoded = jwt.decode(token) as any;
    console.log('TOKEN GENERATION - Token will expire at:', new Date(decoded.exp * 1000).toISOString());

    return NextResponse.json({
      success: true,
      message: 'Authentication successful',
      data: {
        token,
        tokenType: 'Bearer',
        expiresIn: 7200, // 2 hours in seconds
        user: {
          id: user.id,
          username: user.username,
          fullName: user.full_name,
          email: user.email,
          companyName: user.company_name,
          scopes: user.scopes
        }
      }
    });

  } catch (error: any) {
    console.error('Error generating token:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to generate token' },
      { status: 500 }
    );
  }
}

// POST /api/v1/auth/refresh - Refresh JWT token
export async function PUT(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { success: false, error: 'No token provided' },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);
    
    // Verify and decode existing token (ignore expiration)
    const decoded = jwt.verify(token, JWT_SECRET, { ignoreExpiration: true }) as any;

    // Check if user and API key still active
    const result = await erpDb.execute(sql`
      SELECT 
        u.id,
        u.is_active,
        k.is_active as api_key_active,
        k.expires_at,
        k.erp_organization_id
      FROM api_users u
      INNER JOIN api_keys k ON u.api_key_id = k.id
      WHERE u.id = ${decoded.userId}
    `);

    if (!result || result.length === 0) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    const user = result[0] as any;

    if (!user.is_active || !user.api_key_active) {
      return NextResponse.json(
        { success: false, error: 'Account is disabled' },
        { status: 403 }
      );
    }

    if (user.expires_at && new Date(user.expires_at) < new Date()) {
      return NextResponse.json(
        { success: false, error: 'API key has expired' },
        { status: 403 }
      );
    }

    // Generate new token with same payload
    const newToken = jwt.sign(
      {
        userId: decoded.userId,
        username: decoded.username,
        apiKeyId: decoded.apiKeyId,
        apiKeyName: decoded.apiKeyName,
        companyName: decoded.companyName,
        scopes: decoded.scopes,
        fullName: decoded.fullName,
        email: decoded.email,
        erpOrganizationId: user.erp_organization_id
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    return NextResponse.json({
      success: true,
      message: 'Token refreshed successfully',
      data: {
        token: newToken,
        tokenType: 'Bearer',
        expiresIn: 7200
      }
    });

  } catch (error: any) {
    console.error('Error refreshing token:', error);
    return NextResponse.json(
      { success: false, error: 'Invalid or expired token' },
      { status: 401 }
    );
  }
}
