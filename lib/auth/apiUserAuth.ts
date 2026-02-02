import { NextRequest, NextResponse } from 'next/server';
import { erpDb } from '@/lib/db';
import { sql } from 'drizzle-orm';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from './config';

export interface ApiUser {
  userId: string;
  username: string;
  apiKeyId: string;
  apiKeyName: string;
  companyName: string;
  scopes: string[];
  fullName: string;
  email: string;
  erpOrganizationId: string;
}

/**
 * Middleware to require API authentication with JWT
 * This is specifically for /api/v1/* endpoints using API user credentials
 */
export async function requireApiAuth(
  req: NextRequest
): Promise<{ user: ApiUser; error?: never } | { user?: never; error: Response }> {
  const authHeader = req.headers.get('authorization');
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return {
      error: NextResponse.json(
        { success: false, error: 'Unauthorized - No token provided' },
        { status: 401 }
      ),
    };
  }

  const token = authHeader.substring(7);

  try {
    console.log('TOKEN VERIFICATION - JWT_SECRET:', JWT_SECRET.substring(0, 30) + '...');
    console.log('TOKEN VERIFICATION - Auth Header:', authHeader.substring(0, 50) + '...');
    console.log('TOKEN VERIFICATION - Token (first 50 chars):', token.substring(0, 50) + '...');
    
    // Decode without verification first to check expiration
    const decodedWithoutVerify = jwt.decode(token) as any;
    if (decodedWithoutVerify) {
      const now = Math.floor(Date.now() / 1000);
      console.log('TOKEN DEBUG - Current server time:', now, new Date());
      console.log('TOKEN DEBUG - Token issued at (iat):', decodedWithoutVerify.iat, new Date(decodedWithoutVerify.iat * 1000));
      console.log('TOKEN DEBUG - Token expires at (exp):', decodedWithoutVerify.exp, new Date(decodedWithoutVerify.exp * 1000));
      console.log('TOKEN DEBUG - Time until expiry (seconds):', decodedWithoutVerify.exp - now);
      console.log('TOKEN DEBUG - Has erpOrganizationId:', decodedWithoutVerify.erpOrganizationId);
    }
    
    // Verify JWT token with clock tolerance of 60 seconds
    const decoded = jwt.verify(token, JWT_SECRET, { 
      clockTolerance: 60 
    }) as any;
    
    console.log('API Auth - Token verified successfully:', {
      userId: decoded.userId,
      username: decoded.username,
      scopes: decoded.scopes,
      erpOrganizationId: decoded.erpOrganizationId
    });

    // Validate token has required fields
    if (!decoded.userId || !decoded.apiKeyId) {
      console.error('API Auth - Invalid token structure:', decoded);
      return {
        error: NextResponse.json(
          { success: false, error: 'Invalid token structure' },
          { status: 401 }
        ),
      };
    }

    // Return user from JWT payload (skip database checks for performance)
    const apiUser: ApiUser = {
      userId: decoded.userId,
      username: decoded.username,
      apiKeyId: decoded.apiKeyId,
      apiKeyName: decoded.apiKeyName,
      companyName: decoded.companyName,
      scopes: decoded.scopes || [],
      fullName: decoded.fullName,
      email: decoded.email,
      erpOrganizationId: decoded.erpOrganizationId
    };

    return { user: apiUser };

  } catch (error: any) {
    console.error('API Auth error:', {
      name: error.name,
      message: error.message,
      secret: JWT_SECRET.substring(0, 20) + '...'
    });
    
    if (error.name === 'TokenExpiredError') {
      return {
        error: NextResponse.json(
          { success: false, error: 'Token has expired. Please refresh your token.' },
          { status: 401 }
        ),
      };
    }

    if (error.name === 'JsonWebTokenError') {
      return {
        error: NextResponse.json(
          { success: false, error: 'Invalid token' },
          { status: 401 }
        ),
      };
    }

    console.error('API auth error:', error);
    return {
      error: NextResponse.json(
        { success: false, error: 'Authentication failed' },
        { status: 401 }
      ),
    };
  }
}

/**
 * Check if API user has a specific scope
 */
export function hasScope(user: ApiUser, requiredScope: string): boolean {
  return user.scopes.includes(requiredScope) || user.scopes.includes('admin');
}
