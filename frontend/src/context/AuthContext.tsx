'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authApi, userApi, doctorApi } from '@/lib/api';
import { ROLES } from '@/lib/types';

export interface AuthUser {
  userId: number;
  username: string;
  roleId: number;
  token: string;
  profilePicturePath?: string;
}

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  /** True if the current Staff user has been confirmed to have a doctor profile */
  isActualDoctor: boolean;
  login: (username: string, password: string) => Promise<void>;
  registerUser: (username: string, password: string, firstName?: string, middleName?: string, lastName?: string) => Promise<void>;
  logout: () => void;
  updateUser: (updated: Partial<AuthUser>) => void;
  refreshUser: () => Promise<void>;
  isAdmin: () => boolean;
  /** Returns true for ANY Staff role (includes both doctors and receptionists) */
  isStaff: () => boolean;
  /** Returns true only for Staff who have a doctor profile */
  isDoctor: () => boolean;
  /** Returns true for Staff who do NOT have a doctor profile (receptionist) */
  isReceptionist: () => boolean;
  isPatient: () => boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [isActualDoctor, setIsActualDoctor] = useState(false);

  const updateUser = useCallback((updated: Partial<AuthUser>) => {
    setUser((prev) => {
      if (!prev) return null;
      const next = { ...prev, ...updated };
      localStorage.setItem('medibook_user', JSON.stringify(next));
      return next;
    });
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const res = await userApi.getProfile();
      if (res.data) {
        const raw = res.data as Record<string, unknown>;
        const pic = (res.data.profilePicturePath || raw.profile_picture_path || '') as string;
        const uName = (res.data.userName || raw.user_name) as string | undefined;
        setUser((prev) => {
          if (!prev) return null;
          const next: AuthUser = {
            ...prev,
            profilePicturePath: pic || prev.profilePicturePath,
            username: uName || prev.username,
          };
          localStorage.setItem('medibook_user', JSON.stringify(next));
          return next;
        });
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    const stored = localStorage.getItem('medibook_user');
    const token = localStorage.getItem('medibook_token');
    if (stored && token) {
      try {
        const parsed = JSON.parse(stored);
        setUser(parsed);
      } catch {
        localStorage.removeItem('medibook_user');
        localStorage.removeItem('medibook_token');
      }
    }
    setLoading(false);
  }, []);

  // Fetch updated profile once authenticated
  useEffect(() => {
    if (user?.token) {
      refreshUser();
    }
  }, [user?.token, refreshUser]);

  // Check if Staff user has a doctor profile (to distinguish Doctor vs Receptionist)
  useEffect(() => {
    if (user?.roleId === ROLES.STAFF) {
      doctorApi.getMyProfile()
        .then(() => setIsActualDoctor(true))
        .catch(() => setIsActualDoctor(false));
    } else {
      setIsActualDoctor(false);
    }
  }, [user?.userId, user?.roleId]);

  const login = useCallback(async (username: string, password: string) => {
    const res = await authApi.login({ username, password });
    const data = res.data;
    const authUser: AuthUser = {
      userId: data.userId,
      username: data.username,
      roleId: data.roleId,
      token: data.token,
    };
    localStorage.setItem('medibook_token', data.token);
    localStorage.setItem('medibook_user', JSON.stringify(authUser));
    // Store token in cookie for middleware
    document.cookie = `medibook_token=${data.token}; path=/; max-age=86400`;
    setUser(authUser);

    // Fetch full profile in background
    try {
      const profRes = await userApi.getProfile();
      if (profRes.data) {
        const raw = profRes.data as Record<string, unknown>;
        const pic = (profRes.data.profilePicturePath || raw.profile_picture_path || '') as string;
        if (pic) {
          authUser.profilePicturePath = pic;
          localStorage.setItem('medibook_user', JSON.stringify(authUser));
          setUser({ ...authUser });
        }
      }
    } catch {
      // ignore
    }
  }, []);

  const registerUser = useCallback(async (username: string, password: string, firstName?: string, middleName?: string, lastName?: string) => {
    const res = await authApi.registerUser({ username, password, firstName, middleName, lastName });
    const data = res.data;
    const authUser: AuthUser = {
      userId: data.userId,
      username: data.username,
      roleId: data.roleId,
      token: data.token,
    };
    localStorage.setItem('medibook_token', data.token);
    localStorage.setItem('medibook_user', JSON.stringify(authUser));
    document.cookie = `medibook_token=${data.token}; path=/; max-age=86400`;
    setUser(authUser);
  }, []);

  const logout = useCallback(() => {
    authApi.logout().catch(() => {});
    localStorage.removeItem('medibook_token');
    localStorage.removeItem('medibook_user');
    document.cookie = 'medibook_token=; path=/; max-age=0';
    setUser(null);
    setIsActualDoctor(false);
    window.location.href = '/login';
  }, []);

  const isAdmin        = useCallback(() => user?.roleId === ROLES.ADMIN, [user]);
  const isStaff        = useCallback(() => user?.roleId === ROLES.STAFF, [user]);
  const isDoctor       = useCallback(() => user?.roleId === ROLES.STAFF && isActualDoctor, [user, isActualDoctor]);
  const isReceptionist = useCallback(() => user?.roleId === ROLES.STAFF && !isActualDoctor, [user, isActualDoctor]);
  const isPatient      = useCallback(() => user?.roleId === ROLES.USER, [user]);

  return (
    <AuthContext.Provider value={{
      user, loading, isActualDoctor,
      login, registerUser, logout, updateUser, refreshUser,
      isAdmin, isStaff, isDoctor, isReceptionist, isPatient,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
