/**
 * Database Error Handler
 * Converts PostgreSQL errors into user-friendly error messages
 */

export interface DbError {
  message: string;
  statusCode: number;
  code?: string;
}

/**
 * Parse PostgreSQL error and return user-friendly message
 */
export function handleDatabaseError(error: any): DbError {
  // PostgreSQL error codes
  const pgError = error?.cause || error;
  const errorCode = pgError?.code;
  const detail = pgError?.detail || '';
  const constraintName = pgError?.constraint_name || '';
  const tableName = pgError?.table_name || '';

  // Foreign Key Violation (23503)
  if (errorCode === '23503') {
    // Extract the referenced table from detail message
    if (detail.includes('erp_organizations')) {
      return {
        message: 'Organization not found or not properly set up in the ERP system',
        statusCode: 400,
        code: '23503',
      };
    }
    if (detail.includes('products')) {
      return {
        message: 'Product not found or has been deleted',
        statusCode: 400,
        code: '23503',
      };
    }
    if (detail.includes('warehouses')) {
      return {
        message: 'Warehouse not found or has been deleted',
        statusCode: 400,
        code: '23503',
      };
    }
    if (detail.includes('suppliers')) {
      return {
        message: 'Supplier not found or has been deleted',
        statusCode: 400,
        code: '23503',
      };
    }
    if (detail.includes('customers')) {
      return {
        message: 'Customer not found or has been deleted',
        statusCode: 400,
        code: '23503',
      };
    }
    if (detail.includes('product_categories')) {
      return {
        message: 'Product category not found or has been deleted',
        statusCode: 400,
        code: '23503',
      };
    }
    if (detail.includes('units_of_measure')) {
      return {
        message: 'Unit of measure not found',
        statusCode: 400,
        code: '23503',
      };
    }
    
    return {
      message: 'Referenced record does not exist. Please check your data and try again.',
      statusCode: 400,
      code: '23503',
    };
  }

  // Unique Violation (23505)
  if (errorCode === '23505') {
    if (constraintName.includes('sku') || detail.includes('sku')) {
      return {
        message: 'A product with this SKU already exists',
        statusCode: 409,
        code: '23505',
      };
    }
    if (constraintName.includes('barcode') || detail.includes('barcode')) {
      return {
        message: 'A product with this barcode already exists',
        statusCode: 409,
        code: '23505',
      };
    }
    if (constraintName.includes('code') || detail.includes('code')) {
      return {
        message: 'A record with this code already exists',
        statusCode: 409,
        code: '23505',
      };
    }
    if (constraintName.includes('email') || detail.includes('email')) {
      return {
        message: 'This email address is already registered',
        statusCode: 409,
        code: '23505',
      };
    }
    if (constraintName.includes('product_id') && constraintName.includes('warehouse_id')) {
      return {
        message: 'A reorder rule for this product and warehouse combination already exists',
        statusCode: 409,
        code: '23505',
      };
    }
    if (tableName === 'reorder_rules') {
      return {
        message: 'A reorder rule for this product and warehouse already exists',
        statusCode: 409,
        code: '23505',
      };
    }
    
    return {
      message: 'A record with these values already exists',
      statusCode: 409,
      code: '23505',
    };
  }

  // Not Null Violation (23502)
  if (errorCode === '23502') {
    const columnName = pgError?.column_name || 'field';
    return {
      message: `Required field '${columnName}' cannot be empty`,
      statusCode: 400,
      code: '23502',
    };
  }

  // Check Constraint Violation (23514)
  if (errorCode === '23514') {
    return {
      message: 'Invalid value provided. Please check your input and try again.',
      statusCode: 400,
      code: '23514',
    };
  }

  // Invalid Text Representation (22P02)
  if (errorCode === '22P02') {
    return {
      message: 'Invalid data format. Please check your input.',
      statusCode: 400,
      code: '22P02',
    };
  }

  // Undefined Table (42P01)
  if (errorCode === '42P01') {
    return {
      message: 'Database table not found. Please contact support.',
      statusCode: 500,
      code: '42P01',
    };
  }

  // Undefined Column (42703)
  if (errorCode === '42703') {
    return {
      message: 'Database schema mismatch. Please contact support.',
      statusCode: 500,
      code: '42703',
    };
  }

  // Division by Zero (22012)
  if (errorCode === '22012') {
    return {
      message: 'Invalid calculation attempted. Please check your numeric values.',
      statusCode: 400,
      code: '22012',
    };
  }

  // Numeric Value Out of Range (22003)
  if (errorCode === '22003') {
    return {
      message: 'Number value is too large or too small',
      statusCode: 400,
      code: '22003',
    };
  }

  // String Data Right Truncation (22001)
  if (errorCode === '22001') {
    return {
      message: 'Text value is too long for this field',
      statusCode: 400,
      code: '22001',
    };
  }

  // Connection errors
  if (error.message?.includes('ECONNREFUSED') || error.message?.includes('connection')) {
    return {
      message: 'Database connection error. Please try again later.',
      statusCode: 503,
    };
  }

  // Generic database error
  if (errorCode) {
    return {
      message: 'A database error occurred. Please try again.',
      statusCode: 500,
      code: errorCode,
    };
  }

  // Unknown error
  return {
    message: 'An unexpected error occurred. Please try again.',
    statusCode: 500,
  };
}

/**
 * Log database error details (for debugging)
 */
export function logDatabaseError(context: string, error: any): void {
  const pgError = error?.cause || error;
  console.error(`[DB Error] ${context}:`, {
    code: pgError?.code,
    severity: pgError?.severity,
    message: pgError?.message || error.message,
    detail: pgError?.detail,
    constraint: pgError?.constraint_name,
    table: pgError?.table_name,
    column: pgError?.column_name,
  });
}
