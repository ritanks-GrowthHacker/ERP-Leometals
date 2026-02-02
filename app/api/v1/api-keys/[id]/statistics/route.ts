import { NextRequest, NextResponse } from 'next/server';
import { erpDb } from '@/lib/db';
import { sql } from 'drizzle-orm';
import { requireErpAccess, hasPermission } from '@/lib/auth';

// GET /api/v1/api-keys/[id]/statistics - Get usage statistics for an API key
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, error } = await requireErpAccess(request);
  if (error) return error;

  if (!hasPermission(user, 'sales', 'view')) {
    return NextResponse.json({ error: 'No permission to view API key statistics' }, { status: 403 });
  }

  // Await params
  const { id } = await params;

  try {
    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || '7d'; // 24h, 7d, 30d, 90d

    // Calculate date range
    let startDate = new Date();
    switch (period) {
      case '24h':
        startDate.setHours(startDate.getHours() - 24);
        break;
      case '7d':
        startDate.setDate(startDate.getDate() - 7);
        break;
      case '30d':
        startDate.setDate(startDate.getDate() - 30);
        break;
      case '90d':
        startDate.setDate(startDate.getDate() - 90);
        break;
      default:
        startDate.setDate(startDate.getDate() - 7);
    }

    // Verify API key exists
    const keyCheck = await erpDb.execute(sql`
      SELECT id FROM api_keys
      WHERE id = ${id}
    `);

    if (!keyCheck || keyCheck.length === 0) {
      return NextResponse.json(
        { success: false, error: 'API key not found' },
        { status: 404 }
      );
    }

    // Get overall statistics
    const statsResult = await erpDb.execute(sql`
      SELECT 
        COUNT(*) as total_requests,
        COUNT(CASE WHEN status_code >= 200 AND status_code < 300 THEN 1 END) as successful_requests,
        COUNT(CASE WHEN status_code >= 400 AND status_code < 500 THEN 1 END) as client_errors,
        COUNT(CASE WHEN status_code >= 500 THEN 1 END) as server_errors,
        AVG(response_time_ms) as avg_response_time,
        MAX(response_time_ms) as max_response_time,
        MIN(response_time_ms) as min_response_time
      FROM api_request_logs
      WHERE api_key_id = ${id}
        AND created_at >= ${startDate.toISOString()}
    `);

    const stats = statsResult[0] as any;

    // Get requests by day
    const timeSeriesResult = await erpDb.execute(sql`
      SELECT 
        DATE(created_at) as date,
        COUNT(*) as requests,
        COUNT(CASE WHEN status_code >= 200 AND status_code < 300 THEN 1 END) as successful,
        COUNT(CASE WHEN status_code >= 400 THEN 1 END) as failed,
        AVG(response_time_ms) as avg_response_time
      FROM api_request_logs
      WHERE api_key_id = ${id}
        AND created_at >= ${startDate.toISOString()}
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `);

    // Get top endpoints
    const topEndpointsResult = await erpDb.execute(sql`
      SELECT 
        endpoint,
        method,
        COUNT(*) as requests,
        AVG(response_time_ms) as avg_response_time
      FROM api_request_logs
      WHERE api_key_id = ${id}
        AND created_at >= ${startDate.toISOString()}
      GROUP BY endpoint, method
      ORDER BY requests DESC
      LIMIT 10
    `);

    // Get recent errors
    const recentErrorsResult = await erpDb.execute(sql`
      SELECT 
        method,
        endpoint,
        status_code,
        error_message,
        created_at
      FROM api_request_logs
      WHERE api_key_id = ${id}
        AND status_code >= 400
        AND created_at >= ${startDate.toISOString()}
      ORDER BY created_at DESC
      LIMIT 20
    `);

    // Get requests by status code
    const statusCodesResult = await erpDb.execute(sql`
      SELECT 
        status_code,
        COUNT(*) as count
      FROM api_request_logs
      WHERE api_key_id = ${id}
        AND created_at >= ${startDate.toISOString()}
      GROUP BY status_code
      ORDER BY count DESC
    `);

    return NextResponse.json({
      success: true,
      data: {
        period,
        startDate: startDate.toISOString(),
        endDate: new Date().toISOString(),
        summary: {
          totalRequests: parseInt(stats.total_requests) || 0,
          successfulRequests: parseInt(stats.successful_requests) || 0,
          clientErrors: parseInt(stats.client_errors) || 0,
          serverErrors: parseInt(stats.server_errors) || 0,
          successRate: stats.total_requests > 0 
            ? ((stats.successful_requests / stats.total_requests) * 100).toFixed(2) + '%'
            : '0%',
          avgResponseTime: Math.round(stats.avg_response_time) || 0,
          maxResponseTime: Math.round(stats.max_response_time) || 0,
          minResponseTime: Math.round(stats.min_response_time) || 0
        },
        timeSeries: timeSeriesResult.map((row: any) => ({
          date: row.date,
          requests: parseInt(row.requests),
          successful: parseInt(row.successful),
          failed: parseInt(row.failed),
          avgResponseTime: Math.round(row.avg_response_time)
        })),
        topEndpoints: topEndpointsResult.map((row: any) => ({
          endpoint: row.endpoint,
          method: row.method,
          requests: parseInt(row.requests),
          avgResponseTime: Math.round(row.avg_response_time)
        })),
        recentErrors: recentErrorsResult.map((row: any) => ({
          method: row.method,
          endpoint: row.endpoint,
          statusCode: row.status_code,
          errorMessage: row.error_message,
          timestamp: row.created_at
        })),
        statusCodes: statusCodesResult.map((row: any) => ({
          code: row.status_code,
          count: parseInt(row.count)
        }))
      }
    });

  } catch (error) {
    console.error('Error fetching API key statistics:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch statistics' },
      { status: 500 }
    );
  }
}