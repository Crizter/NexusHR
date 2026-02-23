import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from 'react';
import { Loader2 } from 'lucide-react';
import { ROLE_PERMISSIONS } from '@/lib/config';
import type { Role, Permission } from '@/lib/config';


// ============================================================================
// Types
// ============================================================================

export interface User {
  id:     string;
  orgId:  string;
  name:   string;
  email:  string;
  role:   Role;
  token?: string;
}

interface AuthContextType {
  user:           User | null;
  isLoading:      boolean;
  login:          (userData: User) => Promise<void>;
  logout:         () => void;
  hasPermission:  (permission: Permission) => boolean;
    setUser:        React.Dispatch<React.SetStateAction<User | null>>;  
}

interface AuthProviderProps {
  children: ReactNode;
}

// ============================================================================
// Constants
// ============================================================================

const AuthContext  = createContext<AuthContextType | undefined>(undefined);
const STORAGE_KEY  = 'nexus_user';

// ============================================================================
// Helpers
// ============================================================================

/** Persist the user (including token) to sessionStorage */
const persistUser = (userData: User): void => {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(userData));
};

/** Remove the user from sessionStorage */
const clearPersistedUser = (): void => {
  sessionStorage.removeItem(STORAGE_KEY);
};

/** Read + validate the stored user. Returns null if missing or corrupt. */
const readPersistedUser = (): User | null => {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    const parsed: User = JSON.parse(raw);

    // Validate all required fields are present
    if (
      parsed.id    &&
      parsed.orgId &&
      parsed.name  &&
      parsed.email &&
      parsed.role
    ) {
      return parsed;
    }

    console.warn('[AuthContext] Incomplete user in sessionStorage — clearing');
    clearPersistedUser();
    return null;

  } catch (err) {
    console.error('[AuthContext] Failed to parse sessionStorage:', err);
    clearPersistedUser();
    return null;
  }
};

// ============================================================================
// Provider
// ============================================================================

export function AuthProvider({ children }: AuthProviderProps): JSX.Element {
  const [user,      setUser]      = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // ── Restore session on mount ──────────────────────────────────────────────
  useEffect(() => {
    const restored = readPersistedUser();
    if (restored) {
      setUser(restored);
    }
    setIsLoading(false);
  }, []);

  // ── login ─────────────────────────────────────────────────────────────────
  /**
   * Called after api.login() resolves.
   * Stores { ...apiUser, token } in state AND sessionStorage so the
   * axios interceptor can read it on every subsequent request.
   */
  const login = async (userData: User): Promise<void> => {
    if (
      !userData.id    ||
      !userData.orgId ||
      !userData.name  ||
      !userData.email ||
      !userData.role
    ) {
      throw new Error('Invalid user data: missing required fields');
    }

    setUser(userData);
    persistUser(userData);        // ← token is inside userData, stored here
  };

  // ── logout ────────────────────────────────────────────────────────────────
  /**
   * Clears in-memory state AND sessionStorage so the axios interceptor
   * stops sending the Authorization header immediately.
   */
  const logout = (): void => {
    setUser(null);
    clearPersistedUser();         // ← removes token from sessionStorage
  };

  // ── hasPermission ─────────────────────────────────────────────────────────
  const hasPermission = (permission: Permission): boolean => {
    if (!user || !permission) return false;

    const userPermissions = ROLE_PERMISSIONS[user.role];
    if (!userPermissions) {
      console.warn('[AuthContext] No permissions found for role:', user.role);
      return false;
    }

    return (userPermissions as readonly Permission[]).includes(permission);
  };
   // ── Update persisted user whenever user state changes ─────────
    const setUserAndPersist: React.Dispatch<React.SetStateAction<User | null>> = (action) => {
    setUser(prev => {
      const next = typeof action === 'function' ? action(prev) : action;
      if (next) persistUser(next);
      else clearPersistedUser();
      return next;
    });
  };


  // ── Loading screen ────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-white">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-gray-600" />
          <p className="text-gray-600 text-sm">Loading NexusHR...</p>
        </div>
      </div>
    );
  }

    return (
    <AuthContext.Provider value={{
      user,
      isLoading,
      login,
      logout,
      hasPermission,
      setUser: setUserAndPersist,    // ← expose it
    }}>
      {children}
    </AuthContext.Provider>
  );
}

// ============================================================================
// Hooks & Utilities
// ============================================================================

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

// ─── HOC ──────────────────────────────────────────────────────────────────────
export function withAuth<T extends object>(
  WrappedComponent: React.ComponentType<T>
): React.ComponentType<T> {
  return function AuthenticatedComponent(props: T): JSX.Element {
    const { user } = useAuth();

    if (!user) {
      return (
        <div className="h-screen flex items-center justify-center bg-white">
          <div className="text-center">
            <h2 className="text-2xl font-semibold text-gray-900 mb-2">
              Access Denied
            </h2>
            <p className="text-gray-600">Please log in to access this page.</p>
          </div>
        </div>
      );
    }

    return <WrappedComponent {...props} />;
  };
}

// ─── Permission gate ──────────────────────────────────────────────────────────
interface ProtectedContentProps {
  children:    ReactNode;
  permission:  Permission;
  fallback?:   ReactNode;
}

export function ProtectedContent({
  children,
  permission,
  fallback = null,
}: ProtectedContentProps): JSX.Element | null {
  const { hasPermission } = useAuth();
  if (!hasPermission(permission)) return fallback as JSX.Element | null;
  return children as JSX.Element;
}

export type { AuthContextType };