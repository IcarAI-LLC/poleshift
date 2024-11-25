// src/renderer/hooks/useUI.ts

import { useContext } from 'react';
import { UIContext, UIContextType } from '../contexts/UIContext';

const useUI = (): UIContextType => {
  const context = useContext(UIContext);
  if (!context) {
    throw new Error('useUI must be used within a UIProvider');
  }
  return context;
};

export default useUI;
