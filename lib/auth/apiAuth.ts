import { NextRequest, NextResponse } from 'next/server';
import { erpDb } from '@/lib/db';
import { sql } from 'drizzle-orm';
import crypto from 'crypto';

export interface ApiKeyContext {
  apiKeyId: string;
  subOrganisationId: string;
  userId: string;
  scopes: string[];
  environment: string;
}

export interface AuthenticatedRequest extends NextRequest {
  apiKeyContext?: ApiKeyContext;
}

/**
 * Validate API Key from request headers
 * Supports two authentication methods:
 * 1. X-API-Key header with format: "key:secret"
 * 2. Authorization header with format: "Bearer key:secret"
 */
export async function validateApiKey(request: NextRequest): Promise<ApiKeyContext | null> {
  try {
    // Extract API key from headers
    const apiKeyHeader = request.headers.get('X-API-Key');
    const authHeader = request.headers.get('Authorization');
    
    let apiKeyString: string | null = null;
    
    if (apiKeyHeader) {
      apiKeyString = apiKeyHeader;
    } else if (authHeader?.startsWith('Bearer ')) {
      apiKeyString = authHeader.substring(7);
    }
    
    if (!apiKeyString) {
      return null;
    }
    
    // Parse key:secret format
    const [key, secret] = apiKeyString.split(':');
    
    if (!key || !secret) {
      return null;
    }
    
    // Query database for API key
    const result = await erpDb.execute(sql`
      SELECT 
        id,
        api_key,
        api_secret,
        sub_organisation_id,
        user_id,
        scopes,
        rate_limit_per_hour,
        requests_made_current_hour,
        rate_limit_reset_at,
        is_active,
        expires_at,
        allowed_ips,
        environment
      FROM api_keys
      WHERE api_key = ${key}
        AND is_active = true
    `);
    
    if (!result || result.length === 0) {
      return null;
    }
    
    const apiKey = result[0] as any;
    
    // Verify secret
    if (apiKey.api_secret !== secret) {
      return null;
    }
    
    // Check expiration
    if (apiKey.expires_at && new Date(apiKey.expires_at) < new Date()) {
      return null;
    }
    
    // Check IP restrictions
    if (apiKey.allowed_ips && apiKey.allowed_ips.length > 0) {
      const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0] || 
                       request.headers.get('x-real-ip') || 
                       'unknown';
      
      if (!apiKey.allowed_ips.includes(clientIp)) {
        return null;
      }
    }
    
    // Check rate limit
    const now = new Date();
    const resetAt = new Date(apiKey.rate_limit_reset_at);
    
    if (resetAt < now) {
      // Reset rate limit counter
      await erpDb.execute(sql`
        UPDATE api_keys
        SET 
          requests_made_current_hour = 1,
          rate_limit_reset_at = ${new Date(now.getTime() + 60 * 60 * 1000).toISOString()},
          last_used_at = NOW(),
          last_request_at = NOW()
        WHERE id = ${apiKey.id}
      `);
    } else {
      // Check if rate limit exceeded
      if (apiKey.requests_made_current_hour >= apiKey.rate_limit_per_hour) {
        throw new Error('RATE_LIMIT_EXCEEDED');
      }
      
      // Increment request counter
      await erpDb.execute(sql`
        UPDATE api_keys
        SET 
          requests_made_current_hour = requests_made_current_hour + 1,
          last_used_at = NOW(),
          last_request_at = NOW()
        WHERE id = ${apiKey.id}
      `);
    }
    
    return {
      apiKeyId: apiKey.id,
      subOrganisationId: apiKey.sub_organisation_id,
      userId: apiKey.user_id,
      scopes: apiKey.scopes || ['read'],
      environment: apiKey.environment || 'production'
    };
    
  } catch (error: any) {
    if (error.message === 'RATE_LIMIT_EXCEEDED') {
      throw error;
    }
    console.error('API Key validation error:', error);
    return null;
  }
}

/**
 * Log API request for monitoring and analytics
 */
export async function logApiRequest(
  apiKeyId: string,
  request: NextRequest,
  statusCode: number,
  responseBody: any,
  responseTimeMs: number,
  errorMessage?: string
) {
  try {
    const url = new URL(request.url);
    const queryParams = Object.fromEntries(url.searchParams.entries());
    
    let requestBody = null;
    try {
      if (request.method !== 'GET' && request.method !== 'DELETE') {
        requestBody = await request.clone().json();
      }
    } catch {
      // Skip if body is not JSON
    }
    
    await erpDb.execute(sql`
      INSERT INTO api_request_logs (
        api_key_id,
        method,
        endpoint,
        query_params,
        request_body,
        status_code,
        response_body,
        response_time_ms,
        ip_address,
        user_agent,
        error_message
      ) VALUES (
        ${apiKeyId},
        ${request.method},
        ${url.pathname},
        ${JSON.stringify(queryParams)},
        ${requestBody ? JSON.stringify(requestBody) : null},
        ${statusCode},
        ${JSON.stringify(responseBody)},
        ${responseTimeMs},
        ${request.headers.get('x-forwarded-for')?.split(',')[0] || request.headers.get('x-real-ip') || 'unknown'},
        ${request.headers.get('user-agent') || 'unknown'},
        ${errorMessage || null}
      )
    `);
  } catch (error) {
    console.error('Failed to log API request:', error);
  }
}

/**
 * Check if API key has required scope
 */
export function hasScope(context: ApiKeyContext, requiredScope: string): boolean {
  if (context.scopes.includes('admin')) {
    return true; // Admin scope has all permissions
  }
  return context.scopes.includes(requiredScope);
}

/**
 * API Authentication Middleware
 * Use this to protect API routes that require API key authentication
 */
export function withApiAuth(
  handler: (request: AuthenticatedRequest, context: ApiKeyContext) => Promise<Response>,
  options: {
    requiredScopes?: string[];
    allowSandbox?: boolean;
  } = {}
) {
  return async (request: NextRequest) => {
    const startTime = Date.now();
    
    try {
      // Validate API key
      const apiKeyContext = await validateApiKey(request);
      
      if (!apiKeyContext) {
        const response = NextResponse.json(
          {
            success: false,
            error: {
              code: 'UNAUTHORIZED',
              message: 'Invalid or missing API key'
            }
          },
          { status: 401 }
        );
        
        return response;
      }
      
      // Check environment
      if (!options.allowSandbox && apiKeyContext.environment === 'sandbox') {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'SANDBOX_NOT_ALLOWED',
              message: 'Sandbox API keys are not allowed for this endpoint'
            }
          },
          { status: 403 }
        );
      }
      
      // Check required scopes
      if (options.requiredScopes && options.requiredScopes.length > 0) {
        const hasRequiredScope = options.requiredScopes.every(scope => 
          hasScope(apiKeyContext, scope)
        );
        
        if (!hasRequiredScope) {
          return NextResponse.json(
            {
              success: false,
              error: {
                code: 'INSUFFICIENT_PERMISSIONS',
                message: `Required scopes: ${options.requiredScopes.join(', ')}`
              }
            },
            { status: 403 }
          );
        }
      }
      
      // Add context to request
      const authenticatedRequest = request as AuthenticatedRequest;
      authenticatedRequest.apiKeyContext = apiKeyContext;
      
      // Call handler
      const response = await handler(authenticatedRequest, apiKeyContext);
      
      // Add rate limit headers
      const rateLimitInfo = await getRateLimitInfo(apiKeyContext.apiKeyId);
      const headers = new Headers(response.headers);
      headers.set('X-RateLimit-Limit', rateLimitInfo.limit.toString());
      headers.set('X-RateLimit-Remaining', rateLimitInfo.remaining.toString());
      headers.set('X-RateLimit-Reset', rateLimitInfo.reset.toString());
      
      const responseWithHeaders = new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers
      });
      
      // Log request
      const responseTime = Date.now() - startTime;
      const responseBody = response.status < 400 ? { success: true } : await response.clone().json();
      await logApiRequest(
        apiKeyContext.apiKeyId,
        request,
        response.status,
        responseBody,
        responseTime
      );
      
      return responseWithHeaders;
      
    } catch (error: any) {
      const responseTime = Date.now() - startTime;
      
      if (error.message === 'RATE_LIMIT_EXCEEDED') {
        const response = NextResponse.json(
          {
            success: false,
            error: {
              code: 'RATE_LIMIT_EXCEEDED',
              message: 'API rate limit exceeded. Please try again later.'
            }
          },
          { status: 429 }
        );
        
        return response;
      }
      
      console.error('API Error:', error);
      
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INTERNAL_ERROR',
            message: 'An internal error occurred'
          }
        },
        { status: 500 }
      );
    }
  };
}

/**
 * Get rate limit information for an API key
 */
async function getRateLimitInfo(apiKeyId: string): Promise<{
  limit: number;
  remaining: number;
  reset: number;
}> {
  const result = await erpDb.execute(sql`
    SELECT 
      rate_limit_per_hour,
      requests_made_current_hour,
      rate_limit_reset_at
    FROM api_keys
    WHERE id = ${apiKeyId}
  `);
  
  if (!result || result.length === 0) {
    return { limit: 1000, remaining: 0, reset: Date.now() + 3600000 };
  }
  
  const row = result[0] as any;
  const resetTime = new Date(row.rate_limit_reset_at).getTime();
  
  return {
    limit: row.rate_limit_per_hour,
    remaining: Math.max(0, row.rate_limit_per_hour - row.requests_made_current_hour),
    reset: Math.floor(resetTime / 1000)
  };
}

/**
 * Generate new API key and secret
 */
export function generateApiKey(): { key: string; secret: string } {
  const key = `erp_${crypto.randomBytes(16).toString('hex')}`;
  const secret = crypto.randomBytes(32).toString('hex');
  return { key, secret };
}

/**
 * Generate webhook signature for verification
 */
export function generateWebhookSignature(payload: any, secret: string): string {
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(JSON.stringify(payload));
  return hmac.digest('hex');
}

/**
 * Verify webhook signature
 */
export function verifyWebhookSignature(
  payload: any,
  signature: string,
  secret: string
): boolean {
  const expectedSignature = generateWebhookSignature(payload, secret);
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}
