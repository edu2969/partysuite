import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
    return {
        name: 'PartySuite',
        short_name: 'PartySuite',
        description: 'Control de acceso y gestión de eventos',
        start_url: '/welcome',
        display: 'standalone',
        background_color: '#380E6B',
        theme_color: '#380E6B',
        orientation: 'portrait',
        icons: [
            {
                src: '/icons/icon-192.png',
                sizes: '192x192',
                type: 'image/png',
            },
            {
                src: '/icons/icon-512.png',
                sizes: '512x512',
                type: 'image/png',
            },
        ],
    }
}