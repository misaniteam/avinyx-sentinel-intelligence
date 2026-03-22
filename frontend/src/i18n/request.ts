import { getRequestConfig } from 'next-intl/server';
import { routing } from './routing';

async function loadMessages(locale: string) {
  const common = (await import(`../../messages/${locale}/common.json`)).default;
  const auth = (await import(`../../messages/${locale}/auth.json`)).default;
  const navigation = (await import(`../../messages/${locale}/navigation.json`)).default;
  const dashboard = (await import(`../../messages/${locale}/dashboard.json`)).default;
  const analytics = (await import(`../../messages/${locale}/analytics.json`)).default;
  const campaigns = (await import(`../../messages/${locale}/campaigns.json`)).default;
  const voters = (await import(`../../messages/${locale}/voters.json`)).default;
  const reports = (await import(`../../messages/${locale}/reports.json`)).default;
  const notifications = (await import(`../../messages/${locale}/notifications.json`)).default;
  const superAdmin = (await import(`../../messages/${locale}/superAdmin.json`)).default;
  const validation = (await import(`../../messages/${locale}/validation.json`)).default;
  const adminUsers = (await import(`../../messages/${locale}/admin/users.json`)).default;
  const adminRoles = (await import(`../../messages/${locale}/admin/roles.json`)).default;
  const adminDataSources = (await import(`../../messages/${locale}/admin/dataSources.json`)).default;
  const adminIngestedData = (await import(`../../messages/${locale}/admin/ingestedData.json`)).default;
  const adminSettings = (await import(`../../messages/${locale}/admin/settings.json`)).default;
  const adminWorkers = (await import(`../../messages/${locale}/admin/workers.json`)).default;

  return {
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
}

export default getRequestConfig(async ({ requestLocale }) => {
  let locale = await requestLocale;

  if (!locale || !routing.locales.includes(locale as (typeof routing.locales)[number])) {
    locale = routing.defaultLocale;
  }

  return {
    locale,
    messages: await loadMessages(locale),
  };
});
