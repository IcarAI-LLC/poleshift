// src/hooks/useOnlineStatus.ts

import { useState, useEffect, useCallback } from 'react';

export const useOnlineStatus = (synchronizeData: () => void) => {
  const [isOnline, setIsOnline] = useState(window.navigator.onLine);

  const handleOnline = useCallback(async () => {
    setIsOnline(true);
    await synchronizeData();
  }, [synchronizeData]);

  const handleOffline = () => {
    setIsOnline(false);
  };

  useEffect(() => {
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Perform synchronization immediately if already online
    if (isOnline) {
      synchronizeData();
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [handleOnline, isOnline, synchronizeData]);

  return isOnline;
};
