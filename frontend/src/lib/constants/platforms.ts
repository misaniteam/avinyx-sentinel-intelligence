import {
  Globe,
  Youtube,
  Twitter,
  Rss,
  Newspaper,
  MessageCircle,
  FileUp,
  Facebook,
} from "lucide-react";

export const platformConfig: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  brand24: { label: "Brand24", icon: Globe, color: "bg-blue-100 text-blue-800" },
  youtube: { label: "YouTube", icon: Youtube, color: "bg-red-100 text-red-800" },
  twitter: { label: "Twitter", icon: Twitter, color: "bg-sky-100 text-sky-800" },
  news_rss: { label: "News RSS", icon: Rss, color: "bg-orange-100 text-orange-800" },
  news_api: { label: "News API", icon: Newspaper, color: "bg-purple-100 text-purple-800" },
  reddit: { label: "Reddit", icon: MessageCircle, color: "bg-amber-100 text-amber-800" },
  file_upload: { label: "File Upload", icon: FileUp, color: "bg-emerald-100 text-emerald-800" },
  facebook_import: { label: "Import Facebook Posts", icon: Facebook, color: "bg-blue-100 text-blue-800" },
  facebook: { label: "Facebook", icon: Facebook, color: "bg-blue-100 text-blue-800" },
};
