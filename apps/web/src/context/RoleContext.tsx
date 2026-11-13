'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import { usePathname, useRouter } from 'next/navigation';

export type UserRole = 'ADMIN' | 'ESTUDIANTE';

export interface StudentProfile {
  nombre: string;
  codigoOrden: string;
  contratoCodigo: string;
  universidad: string;
  asesorNombre: string;
  telegramUsername: string;
  telegramChatId: string;
  telegramBotUrl: string;
}

export interface RoleContextValue {
  isAuthenticated: boolean;
  role: UserRole;
  studentProfile: StudentProfile | null;
  loginModalOpen: boolean;
  loginModalDefaultTab: UserRole;
  openLoginModal: (defaultTab?: UserRole) => void;
  closeLoginModal: () => void;
  loginAsStudent: (queryOrProfile?: string | Partial<StudentProfile>) => void;
  loginAsAdmin: () => void;
  logout: () => void;
  setRole: (newRole: UserRole) => void;
  toggleRole: () => void;
}

const KNOWN_STUDENTS: Record<string, StudentProfile> = {
  HARRY: {
    nombre: 'Harry Sánchez',
    codigoOrden: 'ORD-2026-0042',
    contratoCodigo: 'CTR-2026-0042',
    universidad: 'Universidad Nacional de Trujillo (UNT)',
    asesorNombre: 'Dr. Carlos Alberto Méndez Vargas',
    telegramUsername: '@hartonai',
    telegramChatId: '8740415165',
    telegramBotUrl: 'https://t.me/inbestiga_tesis_bot',
  },
  ALESSY: {
    nombre: 'Alessy Tania',
    codigoOrden: 'ORD-2026-0001',
    contratoCodigo: 'CTR-2026-0001',
    universidad: 'Universidad Nacional Mayor de San Marcos (UNMSM)',
    asesorNombre: 'Dra. Elena Sofía Ríos Delgado',
    telegramUsername: '@alessy_tania',
    telegramChatId: '5190823411',
    telegramBotUrl: 'https://t.me/inbestiga_tesis_bot',
  },
};

const STORAGE_KEY = 'inbestiga_auth_session';

interface StoredSession {
  isAuthenticated: boolean;
  role: UserRole;
  studentProfile: StudentProfile | null;
}

function resolveStudentProfile(
  input?: string | Partial<StudentProfile>,
): StudentProfile {
  if (!input) return KNOWN_STUDENTS.HARRY;
  if (typeof input === 'string') {
    const q = input.trim().toUpperCase();
    if (!q) return KNOWN_STUDENTS.HARRY;
    if (q.includes('0001') || q.includes('ALESSY')) {
      return KNOWN_STUDENTS.ALESSY;
    }
    if (q.includes('0042') || q.includes('HARRY') || q.includes('HARTONAI')) {
      return KNOWN_STUDENTS.HARRY;
    }
    const isOrder = q.startsWith('ORD-');
    const isTg = input.trim().startsWith('@');
    return {
      nombre: isTg
        ? `Tesista (${input.trim()})`
        : isOrder
          ? `Tesista (${q})`
          : input.trim(),
      codigoOrden: isOrder ? q : 'ORD-2026-0042',
      contratoCodigo: isOrder ? q.replace('ORD-', 'CTR-') : 'CTR-2026-0042',
      universidad: 'Universidad Nacional de Trujillo (UNT)',
      asesorNombre: 'Dr. Carlos Alberto Méndez Vargas',
      telegramUsername: isTg ? input.trim() : '@hartonai',
      telegramChatId: '8740415165',
      telegramBotUrl: 'https://t.me/inbestiga_tesis_bot',
    };
  }
  return {
    ...KNOWN_STUDENTS.HARRY,
    ...input,
  };
}

const RoleContext = createContext<RoleContextValue | undefined>(undefined);

export function RoleProvider({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [role, setRoleState] = useState<UserRole>('ESTUDIANTE');
  const [studentProfile, setStudentProfile] = useState<StudentProfile | null>(
    null,
  );
  const [loginModalOpen, setLoginModalOpen] = useState<boolean>(false);
  const [loginModalDefaultTab, setLoginModalDefaultTab] =
    useState<UserRole>('ESTUDIANTE');
  const [hydrated, setHydrated] = useState<boolean>(false);

  const pathname = usePathname();
  const router = useRouter();

  const persistSession = (session: StoredSession | null) => {
    try {
      if (!session || !session.isAuthenticated) {
        window.localStorage.removeItem(STORAGE_KEY);
      } else {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
      }
    } catch {
      // ignore storage errors
    }
  };

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed: StoredSession = JSON.parse(raw);
        if (parsed && parsed.isAuthenticated) {
          setIsAuthenticated(true);
          setRoleState(parsed.role === 'ADMIN' ? 'ADMIN' : 'ESTUDIANTE');
          setStudentProfile(parsed.studentProfile || null);
        }
      }
    } catch {
      // ignore parse errors
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    if (pathname?.startsWith('/admin') && (!isAuthenticated || role !== 'ADMIN')) {
      router.replace('/');
    }
  }, [hydrated, isAuthenticated, role, pathname, router]);

  const openLoginModal = useCallback((defaultTab: UserRole = 'ESTUDIANTE') => {
    setLoginModalDefaultTab(defaultTab);
    setLoginModalOpen(true);
  }, []);

  const closeLoginModal = useCallback(() => {
    setLoginModalOpen(false);
  }, []);

  const loginAsStudent = useCallback(
    (queryOrProfile?: string | Partial<StudentProfile>) => {
      const resolved = resolveStudentProfile(queryOrProfile);
      setIsAuthenticated(true);
      setRoleState('ESTUDIANTE');
      setStudentProfile(resolved);
      setLoginModalOpen(false);
      persistSession({
        isAuthenticated: true,
        role: 'ESTUDIANTE',
        studentProfile: resolved,
      });
      if (pathname?.startsWith('/admin')) {
        router.replace('/');
      }
    },
    [pathname, router],
  );

  const loginAsAdmin = useCallback(() => {
    setIsAuthenticated(true);
    setRoleState('ADMIN');
    setStudentProfile(null);
    setLoginModalOpen(false);
    persistSession({
      isAuthenticated: true,
      role: 'ADMIN',
      studentProfile: null,
    });
  }, []);

  const logout = useCallback(() => {
    setIsAuthenticated(false);
    setRoleState('ESTUDIANTE');
    setStudentProfile(null);
    setLoginModalOpen(false);
    persistSession(null);
    if (pathname?.startsWith('/admin')) {
      router.replace('/');
    }
  }, [pathname, router]);

  const setRole = useCallback(
    (newRole: UserRole) => {
      if (newRole === 'ADMIN') {
        loginAsAdmin();
      } else {
        setIsAuthenticated(false);
        setRoleState('ESTUDIANTE');
        setStudentProfile(null);
        persistSession(null);
        if (pathname?.startsWith('/admin')) {
          router.replace('/');
        }
      }
    },
    [loginAsAdmin, pathname, router],
  );

  const toggleRole = useCallback(() => {
    if (isAuthenticated && role === 'ADMIN') {
      logout();
    } else {
      loginAsAdmin();
    }
  }, [isAuthenticated, role, logout, loginAsAdmin]);

  return (
    <RoleContext.Provider
      value={{
        isAuthenticated,
        role,
        studentProfile,
        loginModalOpen,
        loginModalDefaultTab,
        openLoginModal,
        closeLoginModal,
        loginAsStudent,
        loginAsAdmin,
        logout,
        setRole,
        toggleRole,
      }}
    >
      {children}
    </RoleContext.Provider>
  );
}

export function useRole(): RoleContextValue {
  const ctx = useContext(RoleContext);
  if (!ctx) {
    throw new Error('useRole debe utilizarse dentro de un <RoleProvider>');
  }
  return ctx;
}
