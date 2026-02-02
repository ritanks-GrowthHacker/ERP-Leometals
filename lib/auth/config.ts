// Centralized JWT configuration
export const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this-in-production-env';
export const JWT_EXPIRES_IN = '2h';
