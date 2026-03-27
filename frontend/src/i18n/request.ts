import {getRequestConfig} from 'next-intl/server';
import {hasLocale} from 'next-intl';
import {routing} from './routing';

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
  const adminTopics = (await import(`../../messages/${locale}/admin/topics.json`)).default;

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
      topics: adminTopics,
    },
  };
}

export default getRequestConfig(async ({requestLocale}) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested)
    ? requested
    : routing.defaultLocale;

  return {
    locale,
    timeZone: 'Asia/Kolkata',
    now: new Date(),
    messages: await loadMessages(locale),
  };
});