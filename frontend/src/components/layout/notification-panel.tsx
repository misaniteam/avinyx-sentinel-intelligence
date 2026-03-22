'use client';

import {
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
} from '@/lib/api/hooks';
import { useTranslations, useFormatter } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  CheckCheck,
  Info,
  AlertTriangle,
  AlertCircle,
} from 'lucide-react';
import type { Notification } from '@/types';

interface NotificationPanelProps {
  notifications: Notification[];
  isLoading: boolean;
}

export function NotificationPanel({ notifications, isLoading }: NotificationPanelProps) {
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();
  const unreadCount = notifications.filter((n) => !n.read).length;
  const t = useTranslations("navigation");
  const tc = useTranslations("common");
  const format = useFormatter();

  const getIcon = (type: string) => {
    switch (type) {
      case 'alert':
        return <AlertCircle className="h-4 w-4 text-destructive" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      default:
        return <Info className="h-4 w-4 text-blue-500" />;
    }
  };

  const formatTime = (timestamp: string | number) => {
    const date =
      typeof timestamp === 'number' ? new Date(timestamp) : new Date(timestamp);
    return format.relativeTime(date);
  };

  return (
    <div className="w-80">
      <div className="flex items-center justify-between p-3">
        <h4 className="font-semibold text-sm">{t("notifications")}</h4>
        {unreadCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="text-xs h-7"
            onClick={() => markAllRead.mutate()}
            disabled={markAllRead.isPending}
          >
            <CheckCheck className="h-3 w-3 mr-1" />
            {t("markAllRead")}
          </Button>
        )}
      </div>
      <Separator />
      <div className="max-h-80 overflow-y-auto">
        {isLoading ? (
          <div className="p-4 text-center text-sm text-muted-foreground">
            {tc("loading")}
          </div>
        ) : notifications.length === 0 ? (
          <div className="p-4 text-center text-sm text-muted-foreground">
            {t("noNotifications")}
          </div>
        ) : (
          notifications.map((notification) => (
            <div
              key={notification.id}
              className={`flex gap-3 p-3 cursor-pointer hover:bg-muted/50 ${
                !notification.read
                  ? 'bg-muted/30 border-l-2 border-primary'
                  : ''
              }`}
              onClick={() =>
                !notification.read && markRead.mutate(notification.id)
              }
            >
              <div className="mt-0.5">{getIcon(notification.type)}</div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">
                  {notification.title}
                </p>
                <p className="text-xs text-muted-foreground line-clamp-2">
                  {notification.message}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {formatTime(notification.created_at)}
                </p>
              </div>
              {!notification.read && (
                <div className="w-2 h-2 rounded-full bg-primary mt-1.5 shrink-0" />
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
