import 'dotenv/config';

const required = (key) => {
  const v = process.env[key];
  if (!v) throw new Error(`Missing required env var: ${key}`);
  return v;
};

export const config = {
  port: parseInt(process.env.PORT || '3030', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  siteUrl: process.env.SITE_URL || 'https://nalarjati.dev',
  admin: {
    user: process.env.ADMIN_USER || 'admin',
    pass: process.env.ADMIN_PASS || 'changeme',
  },
  smtp: {
    host: process.env.SMTP_HOST || '',
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.MAIL_FROM || 'hello@nalarjati.dev',
    to: process.env.MAIL_TO || 'hello@nalarjati.dev',
    enabled: Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS),
  },
  analytics: {
    enabled: process.env.ANALYTICS_ENABLED === '1',
  },
  paths: {
    root: process.cwd(),
    public: new URL('../public/', import.meta.url).pathname,
    content: new URL('../content/', import.meta.url).pathname,
    data: new URL('../data/', import.meta.url).pathname,
    logs: new URL('../logs/', import.meta.url).pathname,
  },
};

export const isSmtpEnabled = () => config.smtp.enabled;
