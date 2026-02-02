import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { mainDb } from '@/lib/db';
import { sql } from 'drizzle-orm';

// GET /api/erp/profile - Get current user profile
export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyToken(token);
    if (!decoded || !decoded.id) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    console.log('Decoded token:', decoded);
    console.log('User ID:', decoded.id);

    // Fetch user profile with organization role and department role
    const userResult = await mainDb.execute(sql`
      SELECT 
        u.id,
        u.name,
        u.email,
        u.phone,
        u.profile_picture_url as profile_picture,
        u.department_id,
        d.name as department_name,
        o.id as organization_id,
        o.name as organization_name,
        org_role.id as org_role_id,
        org_role.name as org_role_name,
        org_role.description as org_role_description,
        dept_role.id as dept_role_id,
        dept_role.name as dept_role_name,
        dept_role.description as dept_role_description
      FROM users u
      LEFT JOIN departments d ON u.department_id = d.id
      LEFT JOIN organizations o ON u.organization_id = o.id
      LEFT JOIN user_organization_roles uor ON uor.user_id = u.id AND uor.organization_id = u.organization_id
      LEFT JOIN global_roles org_role ON uor.role_id = org_role.id
      LEFT JOIN user_department_roles udr ON udr.user_id = u.id AND udr.department_id = u.department_id
      LEFT JOIN global_roles dept_role ON udr.role_id = dept_role.id
      WHERE u.id = ${decoded.id}
      LIMIT 1
    `);

    console.log('Database query result:', JSON.stringify(userResult, null, 2));
    console.log('Number of rows returned:', userResult.length);

    const userProfile = userResult[0] as any;
    
    console.log('User profile:', JSON.stringify(userProfile, null, 2));
    
    if (!userProfile) {
      console.log('User not found in database');
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const responseData = {
      user: {
        id: userProfile.id,
        name: userProfile.name,
        email: userProfile.email,
        phone: userProfile.phone,
        profilePicture: userProfile.profile_picture,
        departmentId: userProfile.department_id,
        departmentName: userProfile.department_name,
        organizationId: userProfile.organization_id,
        organizationName: userProfile.organization_name,
        organizationRole: userProfile.org_role_id ? {
          id: userProfile.org_role_id,
          name: userProfile.org_role_name,
          description: userProfile.org_role_description,
        } : null,
        departmentRole: userProfile.dept_role_id ? {
          id: userProfile.dept_role_id,
          name: userProfile.dept_role_name,
          description: userProfile.dept_role_description,
        } : null,
      },
    };

    console.log('Response data being sent:', JSON.stringify(responseData, null, 2));

    return NextResponse.json(responseData);
   
  } catch (error: any) {
    console.error('Error fetching profile:', error);
    console.error('Error stack:', error.stack);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
// PUT /api/erp/profile - Update current user profile
export async function PUT(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyToken(token);
    if (!decoded || !decoded.id) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const body = await req.json();
    const { name, email, phone } = body;

    // Update user profile using sql
    await mainDb.execute(sql`
      UPDATE users
      SET 
        name = ${name},
        email = ${email},
        phone = ${phone || null},
        updated_at = NOW()
      WHERE id = ${decoded.id}
    `);

    // Fetch updated user with organization role and department role
    const userResult = await mainDb.execute(sql`
      SELECT 
        u.id,
        u.name,
        u.email,
        u.phone,
        u.profile_picture_url as profile_picture,
        u.department_id,
        d.name as department_name,
        o.id as organization_id,
        o.name as organization_name,
        org_role.id as org_role_id,
        org_role.name as org_role_name,
        org_role.description as org_role_description,
        dept_role.id as dept_role_id,
        dept_role.name as dept_role_name,
        dept_role.description as dept_role_description
      FROM users u
      LEFT JOIN departments d ON u.department_id = d.id
      LEFT JOIN organizations o ON u.organization_id = o.id
      LEFT JOIN user_organization_roles uor ON uor.user_id = u.id AND uor.organization_id = u.organization_id
      LEFT JOIN global_roles org_role ON uor.role_id = org_role.id
      LEFT JOIN user_department_roles udr ON udr.user_id = u.id AND udr.department_id = u.department_id
      LEFT JOIN global_roles dept_role ON udr.role_id = dept_role.id
      WHERE u.id = ${decoded.id}
      LIMIT 1
    `);

    const userProfile = userResult[0] as any;

    return NextResponse.json({
      success: true,
      message: 'Profile updated successfully',
      user: {
        id: userProfile.id,
        name: userProfile.name,
        email: userProfile.email,
        phone: userProfile.phone,
        profilePicture: userProfile.profile_picture,
        departmentId: userProfile.department_id,
        departmentName: userProfile.department_name,
        organizationId: userProfile.organization_id,
        organizationName: userProfile.organization_name,
        organizationRole: userProfile.org_role_id ? {
          id: userProfile.org_role_id,
          name: userProfile.org_role_name,
          description: userProfile.org_role_description,
        } : null,
        departmentRole: userProfile.dept_role_id ? {
          id: userProfile.dept_role_id,
          name: userProfile.dept_role_name,
          description: userProfile.dept_role_description,
        } : null,
      },
    });
  } catch (error: any) {
    console.error('Error updating profile:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}