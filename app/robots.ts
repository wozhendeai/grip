import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/api/',
        '/settings/',
        '/@modal/',
        '/dashboard/',
        '/wallet/',
        '/claim/',
      ],
    },
    sitemap: 'https://usegrip.xyz/sitemap.xml',
  };
}
