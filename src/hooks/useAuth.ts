// src/renderer/hooks/useAuth.ts

import { useContext } from 'react';
import { AuthContext, AuthContextType } from '../contexts/AuthContext';

const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default useAuth;
