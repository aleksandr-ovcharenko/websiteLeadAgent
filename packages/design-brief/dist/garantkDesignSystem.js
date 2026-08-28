import { designSystemSchema } from './index.js';
export const garantkDesignSystem = designSystemSchema.parse({
    name: 'garantk',
    tokens: {
        colors: {
            'color-bg': '#F7F7F5',
            'color-surface': '#FFFFFF',
            'color-text': '#0B1220',
            'color-text-muted': '#9CA3AF',
            'color-brand': '#B89A5A',
            'color-brand-dark': '#8C7340',
            'color-border': '#ECECE8',
            'color-hero': '#0B1220',
            'color-footer': '#0B1220',
            'gray-50': '#F7F7F5',
            'gray-100': '#ECECE8',
            'gray-400': '#9CA3AF',
            'gray-600': '#4B5563',
            'gray-900': '#0B1220',
            'white': '#FFFFFF',
            'gold-500': '#B89A5A',
            'gold-700': '#8C7340'
        },
        typography: {
            family: 'Inter',
            sizes: {
                xs: 12,
                sm: 14,
                base: 16,
                lg: 20,
                xl: 24,
                '2xl': 32,
                '3xl': 40,
                hero: 56
            },
            lineHeights: {
                base: 1.5,
                tight: 1.2
            }
        },
        spacing: {
            '2': 2,
            '4': 4,
            '8': 8,
            '12': 12,
            '16': 16,
            '24': 24,
            '32': 32,
            '48': 48,
            '64': 64,
            '96': 96,
            '128': 128
        },
        sizes: {
            'container-max': 1440
        },
        radii: {
            none: 0,
            sm: 4,
            md: 8,
            lg: 16
        },
        shadows: {
            none: 'none'
        }
    },
    breakpoints: {
        mobile: 768,
        tablet: 1024,
        desktop: 1440
    }
});
