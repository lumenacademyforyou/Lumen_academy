import React, { createContext, useContext, useState } from 'react';

interface SuperAdminUser {
  id: string;
  name: string;
  email: string;
  role: 'SUPER_ADMIN';
  avatarUrl?: string;
}

interface AuthContextType {
  user: SuperAdminUser | null;
  isAuthenticated: boolean;
  login: (email: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<SuperAdminUser | null>({
    id: 'sa-001',
    name: 'Admin',
    email: 'admin@lumenacademy.edu',
    role: 'SUPER_ADMIN',
  });

  const login = (email: string) => {
    setUser({
      id: 'sa-001',
      name: 'Admin',
      email,
      role: 'SUPER_ADMIN',
    });
  };

  const logout = () => {
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: !!user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
