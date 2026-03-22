import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';

// Load English messages for tests
import common from './messages/en/common.json';
import auth from './messages/en/auth.json';
import navigation from './messages/en/navigation.json';
import dashboard from './messages/en/dashboard.json';
import analytics from './messages/en/analytics.json';
import campaigns from './messages/en/campaigns.json';
import voters from './messages/en/voters.json';
import reports from './messages/en/reports.json';
import notifications from './messages/en/notifications.json';
import superAdmin from './messages/en/superAdmin.json';
import validation from './messages/en/validation.json';
import adminUsers from './messages/en/admin/users.json';
import adminRoles from './messages/en/admin/roles.json';
import adminDataSources from './messages/en/admin/dataSources.json';
import adminIngestedData from './messages/en/admin/ingestedData.json';
import adminSettings from './messages/en/admin/settings.json';
import adminWorkers from './messages/en/admin/workers.json';

const messages: Record<string, any> = {
  common,
  auth,
  navigation,
  dashboard,
  analytics,
  campaigns,
  voters,
  reports,
  notifications,
  superAdmin,
  validation,
  admin: {
    users: adminUsers,
    roles: adminRoles,
    dataSources: adminDataSources,
    ingestedData: adminIngestedData,
    settings: adminSettings,
    workers: adminWorkers,
  },
};

function getNestedValue(obj: any, path: string): any {
  return path.split('.').reduce((acc, key) => acc?.[key], obj);
}

function interpolate(template: string, values?: Record<string, any>): string {
  if (!values) return template;
  return template.replace(/\{(\w+)\}/g, (_, key) => String(values[key] ?? `{${key}}`));
}

// Mock next-intl — loads actual English messages so tests see real text
vi.mock('next-intl', () => ({
  useTranslations: (namespace?: string) => {
    const base = namespace ? getNestedValue(messages, namespace) : messages;
    const t = (key: string, values?: Record<string, any>) => {
      const value = getNestedValue(base, key);
      if (typeof value === 'string') return interpolate(value, values);
      return key;
    };
    return t;
  },
  useLocale: () => 'en',
  useFormatter: () => ({
    dateTime: (date: Date, options?: any) => date.toLocaleDateString('en-US', options),
    relativeTime: (date: Date) => 'just now',
  }),
  NextIntlClientProvider: ({ children }: { children: React.ReactNode }) => children,
}));
