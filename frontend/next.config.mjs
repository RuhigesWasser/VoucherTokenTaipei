/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack: (config) => {
    config.resolve.fallback = { fs: false, net: false, tls: false };
    config.externals.push('pino-pretty', 'lokijs', 'encoding');
    return config;
  },
  i18n: {
    defaultLocale: 'zh-hans',
    locales: ['zh-hans', 'en'],
    localeDetection: true
  },
};

export default nextConfig;
