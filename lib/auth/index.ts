import { NextRequest } from 'next/server';
import { mainDb, erpDb } from '@/lib/db';
import { eq, and } from 'drizzle-orm';
import { erpUserAccess } from '@/lib/db/schema';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this-in-production';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  organizationId: string;
  departmentId?: string;
}

export interface ErpUser extends AuthUser {
  erpOrganizationId: string;
  erpDepartmentId?: string;
  departmentName: string;
  organizationName?: string;
  roleId?: string;
  role: string;
  permissions: Record<string, any>;
  warehouseId?: string;
  warehouseLocationId?: string;
  isWarehouseManager?: boolean;
  isLocationManager?: boolean;
}

/**
 * Verify JWT token from request headers
 */
export function verifyToken(token: string): any | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    return decoded;
  } catch (error) {
    console.error('JWT verification error:', error);
    return null;
  }
}

/**
 * Get token from request headers
 */
export function getTokenFromRequest(req: NextRequest): string | null {
  const authHeader = req.headers.get('authorization');
  console.log('Auth header:', authHeader);
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.log('No valid auth header found');
    return null;
  }
  const token = authHeader.substring(7);
  console.log('Extracted token:', token.substring(0, 50) + '...');
  return token;
}

/**
 * Get authenticated user from request
 */
export async function getAuthUser(req: NextRequest): Promise<AuthUser | null> {
  const token = getTokenFromRequest(req);
  if (!token) {
    return null;
  }
  
  return verifyToken(token);
}

/**
 * Get ERP user access details - Simplified for Sales department check and API users
 */
export async function getErpUserAccess(tokenData: any): Promise<ErpUser | null> {
  try {
    // Check if this is an API user (has isApiUser flag)
    if (tokenData.isApiUser === true) {
      // API users have full access
      return {
        id: tokenData.id,
        email: tokenData.email,
        name: tokenData.name,
        organizationId: tokenData.organizationId,
        departmentId: tokenData.departmentId || 'api-user',
        erpOrganizationId: tokenData.organizationId, // API user's org ID is already the ERP org ID
        erpDepartmentId: tokenData.departmentId,
        departmentName: 'API-ADMIN-USER',
        organizationName: tokenData.organizationName || '',
        roleId: 'api-admin',
        role: 'admin',
        permissions: {
          inventory: { view: true, create: true, edit: true, delete: true },
          purchasing: { view: true, create: true, edit: true, delete: true },
          sales: { view: true, create: true, edit: true, delete: true },
          manufacturing: { view: true, create: true, edit: true, delete: true },
        },
      };
    }

    // Check if user has sales department from token
    if (!tokenData.departmentName || tokenData.departmentName.toLowerCase() !== 'sales') {
      return null;
    }

    // Create ERP user with sales department access
    return {
      id: tokenData.id,
      email: tokenData.email,
      name: tokenData.name,
      organizationId: tokenData.organizationId,
      departmentId: tokenData.departmentId,
      erpOrganizationId: tokenData.organizationId, // Use same org ID
      erpDepartmentId: tokenData.departmentId,
      departmentName: tokenData.departmentName,
      organizationName: tokenData.organizationName || '',
      roleId: tokenData.roleId || '',
      role: tokenData.role || 'user',
      permissions: {
        inventory: { view: true, create: true, edit: true, delete: true },
        purchasing: { view: true, create: true, edit: true, delete: true },
        sales: { view: true, create: true, edit: true, delete: true },
      },
    };
  } catch (error) {
    console.error('Error getting ERP user access:', error);
    return null;
  }
}

/**
 * Check if user has specific permission
 */
export function hasPermission(
  erpUser: ErpUser,
  module: string,
  action: 'view' | 'create' | 'edit' | 'delete'
): boolean {
  // API users and Sales department users have all permissions
  if (erpUser.departmentName.toLowerCase() === 'sales' || 
      erpUser.departmentName === 'API-ADMIN-USER' ||
      erpUser.role === 'admin') {
    return true;
  }

  // Check granular permissions
  const modulePermissions = erpUser.permissions[module];
  if (!modulePermissions) {
    return false;
  }

  return modulePermissions[action] === true;
}

/**
 * Middleware to require authentication
 */
export async function requireAuth(req: NextRequest): Promise<{ user: AuthUser; error?: never } | { user?: never; error: Response }> {
  const user = await getAuthUser(req);
  
  if (!user) {
    return {
      error: new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      ),
    };
  }

  return { user };
}

/**
 * Middleware to require ERP access
 */
export async function requireErpAccess(
  req: NextRequest,
  requiredRole?: 'admin' | 'manager' | 'user' | 'viewer'
): Promise<{ user: ErpUser; error?: never } | { user?: never; error: Response }> {
  const token = getTokenFromRequest(req);
  
  if (!token) {
    console.error('No token found in request');
    return {
      error: new Response(
        JSON.stringify({ error: 'Unauthorized - No token provided' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      ),
    };
  }

  const tokenData = verifyToken(token);
  
  if (!tokenData) {
    console.error('Invalid token - verification failed');
    return {
      error: new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      ),
    };
  }

  const erpUser = await getErpUserAccess(tokenData);
  
  if (!erpUser) {
    console.error('ERP access denied - user not in Sales department');
    return {
      error: new Response(
        JSON.stringify({ error: 'ERP access denied. You must be assigned to Sales department.' }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      ),
    };
  }

  return { user: erpUser };
}

/**
 * Get ERP user from JWT token for warehouse manager/location manager
 */
export async function getErpUserFromToken(req: NextRequest): Promise<ErpUser | null> {
  const token = getTokenFromRequest(req);
  
  if (!token) {
    return null;
  }

  const tokenData = verifyToken(token);
  
  if (!tokenData) {
    return null;
  }

  // Check if this is a warehouse manager or location manager
  if (tokenData.isWarehouseManager || tokenData.isLocationManager) {
    return {
      id: tokenData.id,
      email: tokenData.email,
      name: tokenData.name || '',
      organizationId: tokenData.organizationId,
      departmentId: tokenData.departmentId,
      erpOrganizationId: tokenData.organizationId,
      erpDepartmentId: tokenData.departmentId,
      departmentName: tokenData.role === 'warehouse_manager' ? 'Warehouse Manager' : 'Location Manager',
      organizationName: tokenData.organizationName || '',
      roleId: tokenData.role,
      role: tokenData.role,
      warehouseId: tokenData.warehouseId,
      warehouseLocationId: tokenData.warehouseLocationId,
      isWarehouseManager: tokenData.isWarehouseManager,
      isLocationManager: tokenData.isLocationManager,
      permissions: {
        inventory: { view: true, create: true, edit: true, delete: false },
        purchasing: { view: true, create: true, edit: false, delete: false },
        sales: { view: true, create: false, edit: false, delete: false },
      },
    };
  }

  // For regular ERP users, use existing logic
  return await getErpUserAccess(tokenData);
}

/**
 * Generate JWT token for user
 */
export function generateToken(user: AuthUser): string {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      name: user.name,
      organizationId: user.organizationId,
      departmentId: user.departmentId,
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}
