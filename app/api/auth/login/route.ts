import { NextRequest, NextResponse } from 'next/server';
import { mainDb } from '@/lib/db';
import { sql } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this-in-production';

// POST /api/auth/login
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, password, username } = body;

    // Check if this is API user login (username provided)
    if (username) {
      // API User Login
      const { erpDb } = await import('@/lib/db');
      
      const apiUsers = await erpDb.execute(
        sql`SELECT au.id, au.username, au.password_hash, au.full_name, au.email,
                   ak.erp_organization_id, ak.company_name
            FROM api_users au
            JOIN api_keys ak ON ak.id = au.api_key_id
            WHERE au.username = ${username} AND au.is_active = true
            LIMIT 1`
      );

      const apiUser = apiUsers[0] as any;

      if (!apiUser) {
        return NextResponse.json(
          { error: 'Invalid username or password' },
          { status: 401 }
        );
      }

      // Verify password
      const isPasswordValid = await bcrypt.compare(password, apiUser.password_hash);

      if (!isPasswordValid) {
        return NextResponse.json(
          { error: 'Invalid username or password' },
          { status: 401 }
        );
      }

      // Update last login
      await erpDb.execute(
        sql`UPDATE api_users SET last_login_at = CURRENT_TIMESTAMP WHERE id = ${apiUser.id}`
      );

      // Generate JWT token for API user
      const token = jwt.sign(
        {
          id: apiUser.id,
          email: apiUser.email,
          name: apiUser.full_name || apiUser.username,
          organizationId: apiUser.erp_organization_id,
          organizationName: apiUser.company_name,
          departmentId: 'api-user',
          departmentName: 'API-ADMIN-USER',
          isApiUser: true,
        },
        JWT_SECRET
      );

      return NextResponse.json({
        token,
        user: {
          id: apiUser.id,
          email: apiUser.email,
          name: apiUser.full_name || apiUser.username,
          organizationId: apiUser.erp_organization_id,
          organizationName: apiUser.company_name,
          departmentId: 'api-user',
          departmentName: 'API-ADMIN-USER',
          isApiUser: true,
        },
      });
    }

    // Regular User Login
    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    // Query user with department and organization info from main database
    // Flow: email → user (has department_id) → departments table
    const users = await mainDb.execute(
      sql`SELECT u.id, u.email, u.password_hash, u.name, u.organization_id,
                 u.department_id,
                 d.name as department_name,
                 o.name as organization_name
          FROM users u
          LEFT JOIN departments d ON d.id = u.department_id
          LEFT JOIN organizations o ON o.id = u.organization_id
          WHERE u.email = ${email}
          LIMIT 1`
    );

    const user = users[0] as any;

    if (!user) {
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);

    if (!isPasswordValid) {
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    // Check if user has Sales department
    if (!user.department_id || user.department_name?.toLowerCase() !== 'sales') {
      return NextResponse.json(
        { error: 'Access denied. Only Sales department users can access ERP.' },
        { status: 403 }
      );
    }

    // Generate JWT token
    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        name: user.name,
        organizationId: user.organization_id,
        organizationName: user.organization_name,
        departmentId: user.department_id,
        departmentName: user.department_name,
        isApiUser: false,
      },
      JWT_SECRET
    );

    return NextResponse.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        organizationId: user.organization_id,
        organizationName: user.organization_name,
        departmentId: user.department_id,
        departmentName: user.department_name,
        isApiUser: false,
      },
    });
  } catch (err: any) {
    console.error('Login error:', err);
    return NextResponse.json(
      { error: 'An error occurred during login' },
      { status: 500 }
    );
  }
}
