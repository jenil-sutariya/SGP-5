import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type RoleName =
  | 'ADMIN'
  | 'INSTITUTE_ADMIN'
  | 'DEPARTMENT_HEAD'
  | 'FACULTY'
  | 'STUDENT'
  | 'SCHEDULER';

export interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: { name: RoleName };
  departmentId?: string | null;
  instituteId?: string | null;
  institute?: { id: string; code: string; name: string } | null;
  faculty?: { id: string } | null;
  student?: { id: string; sectionId?: string | null; batchId?: string | null } | null;
}

interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  setAuth: (user: AuthUser, accessToken: string, refreshToken: string) => void;
  setTokens: (accessToken: string, refreshToken: string) => void;
  setUser: (user: AuthUser) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      setAuth: (user, accessToken, refreshToken) => set({ user, accessToken, refreshToken }),
      setTokens: (accessToken, refreshToken) => set({ accessToken, refreshToken }),
      setUser: (user) => set({ user }),
      logout: () => set({ user: null, accessToken: null, refreshToken: null }),
    }),
    { name: 'smartsched-auth' }
  )
);

interface ThemeState {
  theme: 'light' | 'dark' | 'system';
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      theme: 'system',
      setTheme: (theme) => set({ theme }),
    }),
    { name: 'smartsched-theme' }
  )
);
