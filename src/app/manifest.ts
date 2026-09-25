import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'WA CRM — WhatsApp CRM',
    short_name: 'WA CRM',
    description: 'Production Mobile WhatsApp CRM for chatting, labels, pipelines, and contacts',
    start_url: '/inbox',
    display: 'standalone',
    background_color: '#020617',
    theme_color: '#020617',
    orientation: 'portrait',
    icons: [
      {
        src: '/icon',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/icon',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
  };
}
