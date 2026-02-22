import React, { createContext, useState, useContext, useCallback, useEffect, useRef, ReactNode } from 'react';
import { Notification, NotificationContextType, NotificationType } from '../types';

const NotificationContext = createContext<NotificationContextType | null>(null);

interface NotificationProviderProps {
  children: ReactNode;
}

interface ExtendedNotification extends Notification {
  duration?: number;
}

export function NotificationProvider({ children }: NotificationProviderProps) {
  const [notifications, setNotifications] = useState<ExtendedNotification[]>([]);
  const timeoutIds = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  // Cleanup all timeouts on unmount
  useEffect(() => {
    return () => {
      timeoutIds.current.forEach(tid => clearTimeout(tid));
      timeoutIds.current.clear();
    };
  }, []);

  const removeNotification = useCallback((id: number) => {
    const tid = timeoutIds.current.get(id);
    if (tid) {
      clearTimeout(tid);
      timeoutIds.current.delete(id);
    }
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  const addNotification = useCallback((message: string, type: NotificationType = 'info', duration = 5000) => {
    const id = Date.now() + Math.random();
    const notification: ExtendedNotification = { id, message, type, duration };

    setNotifications(prev => [...prev, notification]);

    if (duration > 0) {
      const tid = setTimeout(() => {
        timeoutIds.current.delete(id);
        removeNotification(id);
      }, duration);
      timeoutIds.current.set(id, tid);
    }

    return id;
  }, [removeNotification]);

  const showError = useCallback((message: string, duration?: number) => {
    return addNotification(message, 'error', duration);
  }, [addNotification]);

  const showSuccess = useCallback((message: string, duration?: number) => {
    return addNotification(message, 'success', duration);
  }, [addNotification]);

  const showInfo = useCallback((message: string, duration?: number) => {
    return addNotification(message, 'info', duration);
  }, [addNotification]);

  const showWarning = useCallback((message: string, duration?: number) => {
    return addNotification(message, 'warning', duration);
  }, [addNotification]);

  return (
    <NotificationContext.Provider value={{
      notifications,
      showError,
      showSuccess,
      showInfo,
      showWarning,
      removeNotification
    }}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotification() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotification must be used within NotificationProvider');
  }
  return context;
}
