import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface User {
  id: string;
  email: string;
  name: string;
  phone?: string;
  profilePicture?: string | null;
  organizationId: string;
  organizationName: string;
  departmentId: string;
  departmentName: string;
  roleId: string;
  isApiUser?: boolean;
  // Warehouse Manager fields
  role?: 'admin' | 'warehouse_manager' | 'location_manager' | 'user' | 'viewer';
  warehouseId?: string;
  warehouseLocationId?: string;
  isWarehouseManager?: boolean;
  managerType?: 'warehouse_manager' | 'location_manager';
}

interface AuthState {
  token: string | null;
  user: User | null;
  setAuth: (token: string, user: User) => void;
  setUser: (user: User) => void;
  clearAuth: () => void;
  logout: () => void;
  isAuthenticated: () => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      token: null,
      user: null,
      
      setAuth: (token: string, user: User) => {
        set({ token, user });
      },
      
      setUser: (user: User) => {
        set({ user });
      },
      
      clearAuth: () => {
        set({ token: null, user: null });
      },
      
      logout: () => {
        set({ token: null, user: null });
        if (typeof window !== 'undefined') {
          localStorage.removeItem('authToken');
        }
      },
      
      isAuthenticated: () => {
        const { token, user } = get();
        return !!token && !!user;
      },
    }),
    {
      name: 'erp-auth-storage',
    }
  )
);
