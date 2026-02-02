/**
 * Sanitizes UUID values by converting empty strings to null
 * PostgreSQL UUID columns reject empty strings but accept null
 * 
 * @param value - The value to sanitize (can be string, null, or undefined)
 * @returns null if value is empty string, undefined, or null; otherwise returns the original value
 */
export function sanitizeUuid(value: string | null | undefined): string | null | undefined {
  if (value === '' || value === null || value === undefined) {
    return null;
  }
  return value;
}

/**
 * Sanitizes multiple UUID fields in an object
 * Useful for batch processing of form data before database insertion
 * 
 * @param data - The data object containing UUID fields
 * @param uuidFields - Array of field names that should be treated as UUIDs
 * @returns A new object with sanitized UUID fields
 */
export function sanitizeUuids<T extends Record<string, any>>(
  data: T,
  uuidFields: string[]
): T {
  const sanitized: Record<string, any> = { ...data };
  
  uuidFields.forEach((field) => {
    if (field in sanitized) {
      sanitized[field] = sanitizeUuid(sanitized[field]);
    }
  });
  
  return sanitized as T;
}
