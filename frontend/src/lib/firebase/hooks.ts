'use client';

import { useState, useEffect } from 'react';
import { ref, onValue, query, limitToLast } from 'firebase/database';
import { getFirebaseDb } from './config';
import { useTenant } from '@/lib/tenant/tenant-provider';
import type { WorkerStatus, Notification } from '@/types';

export function useWorkerStatus() {
  const { tenantId } = useTenant();
  const [workers, setWorkers] = useState<Record<string, WorkerStatus>>({});
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const db = getFirebaseDb();
    if (!db || !tenantId) {
      setIsLoading(false);
      return;
    }

    const workersRef = ref(db, `sentinel/workers/${tenantId}`);
    const unsubscribe = onValue(
      workersRef,
      (snapshot) => {
        const data = snapshot.val();
        setWorkers(data || {});
        setIsLoading(false);
      },
      () => {
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, [tenantId]);

  return { workers, isLoading };
}

export function useNotifications() {
  const { tenantId } = useTenant();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const db = getFirebaseDb();
    if (!db || !tenantId) {
      setIsLoading(false);
      return;
    }

    const notifRef = query(
      ref(db, `sentinel/notifications/${tenantId}`),
      limitToLast(50)
    );

    const unsubscribe = onValue(
      notifRef,
      (snapshot) => {
        const data = snapshot.val();
        if (!data) {
          setNotifications([]);
          setIsLoading(false);
          return;
        }
        const list: Notification[] = Object.entries(data).map(
          ([id, val]: [string, unknown]) => ({
            id,
            ...(val as Omit<Notification, 'id'>),
          })
        );
        // Sort by created_at descending
        list.sort((a, b) => {
          const aTime =
            typeof a.created_at === 'number'
              ? a.created_at
              : new Date(a.created_at).getTime();
          const bTime =
            typeof b.created_at === 'number'
              ? b.created_at
              : new Date(b.created_at).getTime();
          return bTime - aTime;
        });
        setNotifications(list);
        setIsLoading(false);
      },
      () => {
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, [tenantId]);

  return { notifications, isLoading };
}

export function useNotificationCount(notifications: Notification[]): number {
  return notifications.filter((n) => !n.read).length;
}
