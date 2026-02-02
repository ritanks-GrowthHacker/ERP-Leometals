/**
 * Universal Data Mapper for Warehouse Manager
 * Converts snake_case from PostgreSQL to camelCase for frontend
 */

export function mapSnakeToCamel<T = any>(obj: any): T {
  if (obj === null || obj === undefined) return obj;
  
  if (Array.isArray(obj)) {
    return obj.map(item => mapSnakeToCamel(item)) as T;
  }
  
  if (typeof obj === 'object') {
    const mapped: any = {};
    for (const key in obj) {
      const camelKey = key.replace(/_([a-z])/g, (g) => g[1].toUpperCase());
      mapped[camelKey] = mapSnakeToCamel(obj[key]);
    }
    return mapped as T;
  }
  
  return obj;
}

export function mapCamelToSnake<T = any>(obj: any): T {
  if (obj === null || obj === undefined) return obj;
  
  if (Array.isArray(obj)) {
    return obj.map(item => mapCamelToSnake(item)) as T;
  }
  
  if (typeof obj === 'object') {
    const mapped: any = {};
    for (const key in obj) {
      const snakeKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
      mapped[snakeKey] = mapCamelToSnake(obj[key]);
    }
    return mapped as T;
  }
  
  return obj;
}
