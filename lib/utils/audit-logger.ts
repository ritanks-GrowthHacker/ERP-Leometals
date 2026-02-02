/**
 * Audit Logger Utility
 * Use this to create audit log entries throughout the application
 */

import { getAuthToken } from './token';

interface AuditLogParams {
  entityType: string;
  entityId: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'VIEW' | 'EXPORT' | 'IMPORT';
  changes?: any;
}

/**
 * Create an audit log entry
 * Call this function whenever a significant action is performed
 * 
 * @example
 * await createAuditLog({
 *   entityType: 'products',
 *   entityId: product.id,
 *   action: 'UPDATE',
 *   changes: { before: oldData, after: newData }
 * });
 */
export async function createAuditLog(params: AuditLogParams): Promise<void> {
  try {
    // Get the session token from localStorage
    const token = getAuthToken();
    
    if (!token) {
      console.warn('No auth token found for audit logging');
      return;
    }

    const response = await fetch('/api/erp/audit/logs', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      console.error('Failed to create audit log:', await response.text());
    }
  } catch (error) {
    console.error('Error creating audit log:', error);
    // Don't throw - audit logging should not break the main operation
  }
}

/**
 * Fetch audit logs with filters
 */
export async function fetchAuditLogs(params: {
  type?: string;
  entityId?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
}): Promise<any> {
  try {
    const token = getAuthToken();
    
    if (!token) {
      throw new Error('No auth token found');
    }

    const queryParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        queryParams.append(key, value.toString());
      }
    });

    const response = await fetch(`/api/erp/audit/logs?${queryParams.toString()}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch audit logs');
    }

    return await response.json();
  } catch (error) {
    console.error('Error fetching audit logs:', error);
    throw error;
  }
}

/**
 * Fetch entities for dropdown selection
 */
export async function fetchAuditEntities(type: 'customers' | 'products' | 'warehouses', search?: string): Promise<any> {
  try {
    const token = getAuthToken();
    
    if (!token) {
      throw new Error('No auth token found');
    }

    const queryParams = new URLSearchParams({ type });
    if (search) {
      queryParams.append('search', search);
    }

    const response = await fetch(`/api/erp/audit/entities?${queryParams.toString()}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch entities');
    }

    return await response.json();
  } catch (error) {
    console.error('Error fetching entities:', error);
    throw error;
  }
}
