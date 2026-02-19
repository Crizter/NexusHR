import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import { ROLE_PERMISSIONS } from '@/lib/config';
import type { Role, Permission } from '@/lib/config';

/**
 * User interface representing the authenticated user in our multi-tenant system
 */
interface User {
  id: string;
  orgId: string; // Organization ID for multi-tenant support
  name: string;
  email: string;
  role: Role;
  token?: string; // Optional JWT token for future API integration
}

/**
 * AuthContext type definition containing all authentication-related values and functions
 */
interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (userData: User) => Promise<void>;
  logout: () => void;
  hasPermission: (permission: Permission) => boolean;
}

/**
 * Props for the AuthProvider component
 */
interface AuthProviderProps {
  children: ReactNode;
}

// Create the authentication context
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Session storage key for persisting user data
const STORAGE_KEY = 'nexus_user';

/**
 * AuthProvider component that manages authentication state and provides auth context
 * Handles user persistence, session management, and permission checking
 */
export function AuthProvider({ children }: AuthProviderProps): JSX.Element {
  // Authentication state management
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  /**
   * Effect to restore user session from sessionStorage on component mount
   * Checks for existing user data and restores the session if valid
   */
  useEffect(() => {
    const restoreSession = (): void => {
      try {
        // Attempt to retrieve stored user data
        const storedUser = sessionStorage.getItem(STORAGE_KEY);
        
        if (storedUser) {
          // Parse and validate the stored user data
          const parsedUser: User = JSON.parse(storedUser);
          
          // Basic validation to ensure the user object has required properties
          if (
            parsedUser.id &&
            parsedUser.orgId &&
            parsedUser.name &&
            parsedUser.email &&
            parsedUser.role
          ) {
            setUser(parsedUser);
          } else {
            // Invalid user data, clear storage
            console.warn('Invalid user data in sessionStorage, clearing...');
            sessionStorage.removeItem(STORAGE_KEY);
          }
        }
      } catch (error) {
        // Handle JSON parsing errors or other issues
        console.error('Error restoring user session:', error);
        sessionStorage.removeItem(STORAGE_KEY);
      } finally {
        // Always set loading to false after attempting to restore session
        setIsLoading(false);
      }
    };

    restoreSession();
  }, []);

  /**
   * Logs in a user by setting the user state and persisting to sessionStorage
   * @param userData - The user data to authenticate and store
   */
  const login = async (userData: User): Promise<void> => {
    try {
      // Input validation
      if (!userData.id || !userData.orgId || !userData.email || !userData.role) {
        throw new Error('Invalid user data: missing required fields');
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(userData.email)) {
        throw new Error('Invalid email format');
      }

      // Validate role
      const validRoles = Object.values(ROLE_PERMISSIONS);
      if (!Object.keys(ROLE_PERMISSIONS).includes(userData.role)) {
        throw new Error('Invalid user role');
      }

      // TODO: Future API integration point
      // const response = await apiClient.login(userData);
      // const { token } = response.data;
      // userData.token = token;

      // Set user state
      setUser(userData);
      
      // Persist user data to sessionStorage
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(userData));
      
      // TODO: Set up token refresh interval if using JWT
      // setupTokenRefresh(token);
      
    } catch (error) {
      console.error('Login failed:', error);
      throw error; // Re-throw to allow caller to handle the error
    }
  };

  /**
   * Logs out the current user by clearing state and sessionStorage
   * Performs cleanup of authentication-related data
   */
  const logout = (): void => {
    // Clear user state
    setUser(null);
    
    // Remove user data from sessionStorage
    sessionStorage.removeItem(STORAGE_KEY);
    
    // TODO: Additional cleanup for future features
    // - Clear any cached API data
    // - Cancel ongoing requests
    // - Clear token refresh intervals
    // - Notify the server about logout (if needed)
    
    console.log('User logged out successfully');
  };

  /**
   * Checks if the current user has a specific permission
   * @param permission - The permission to check against the user's role
   * @returns True if user has permission, false otherwise
   */
  const hasPermission = (permission: Permission): boolean => {
    // Check if user is authenticated
    if (!user) {
      return false;
    }

    // Validate permission parameter
    if (!permission) {
      console.warn('hasPermission called with invalid permission:', permission);
      return false;
    }

    // Get permissions for the user's role
    const userPermissions = ROLE_PERMISSIONS[user.role];
    
    if (!userPermissions) {
      console.warn('No permissions found for role:', user.role);
      return false;
    }

    // Check if the permission exists in the user's role permissions
    return userPermissions.includes(permission);
  };

  // Context value object containing all auth-related data and functions
  const contextValue: AuthContextType = {
    user,
    isLoading,
    login,
    logout,
    hasPermission,
  };

  // Show loading screen while checking for existing session
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
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}

/**
 * Custom hook to consume the AuthContext
 * @returns AuthContext value
 * @throws Error if used outside of AuthProvider
 */
export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  
  return context;
}

/**
 * Higher-order component to protect routes that require authentication
 * @param WrappedComponent - Component to wrap with authentication check
 * @returns Protected component
 */
export function withAuth<T extends object>(
  WrappedComponent: React.ComponentType<T>
): React.ComponentType<T> {
  return function AuthenticatedComponent(props: T): JSX.Element {
    const { user } = useAuth();
    
    if (!user) {
      // Redirect to login or show unauthorized message
      return (
        <div className="h-screen flex items-center justify-center bg-white">
          <div className="text-center">
            <h2 className="text-2xl font-semibold text-gray-900 mb-2">
              Access Denied
            </h2>
            <p className="text-gray-600">
              Please log in to access this page.
            </p>
          </div>
        </div>
      );
    }
    
    return <WrappedComponent {...props} />;
  };
}

/**
 * Component to protect content based on permissions
 */
interface ProtectedContentProps {
  children: ReactNode;
  permission: Permission;
  fallback?: ReactNode;
}

export function ProtectedContent({ 
  children, 
  permission, 
  fallback = null 
}: ProtectedContentProps): JSX.Element | null {
  const { hasPermission } = useAuth();
  
  if (!hasPermission(permission)) {
    return fallback as JSX.Element | null;
  }
  
  return children as JSX.Element;
}

// Export types for use in other components
export type { User, AuthContextType };