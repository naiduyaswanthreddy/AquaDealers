import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.js',
      registerType: 'prompt',
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,ico,svg}', '**/icon-*.png', '**/apple-touch-icon.png'],
        // Explicitly exclude the large branding images (4–5 MB each).
        // They will still be served via the NetworkFirst Supabase/CDN cache strategy.
        globIgnores: [
          '**/logo.png',
          '**/favicon.png',
          '**/full_logo.png',
          '**/full prawn.png',
          '**/full logo white.png',
        ],
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
      },
      manifest: {
        id: '/',
        name: 'AquaDealers',
        short_name: 'AquaDealers',
        description: 'Billing, stock, purchase and farmer dues management for aqua feed and medicine dealers.',
        lang: 'en-IN',
        dir: 'ltr',
        theme_color: '#1B6CA8',
        background_color: '#ffffff',
        display: 'standalone',
        display_override: ['standalone', 'minimal-ui', 'browser'],
        orientation: 'portrait',
        start_url: '/?source=pwa',
        scope: '/',
        prefer_related_applications: false,
        categories: ['business', 'productivity', 'finance'],
        icons: [
          {
            src: '/icon-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: '/icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: '/icon-maskable-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable'
          }
        ]
      },
      devOptions: {
        // Disabled in dev — prevents confusing cache issues during development
        enabled: false,
        type: 'module',
      }
    })
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    host: true,
  },
  build: {
    // Warn when any chunk exceeds 500KB (gzip)
    chunkSizeWarningLimit: 500,
    // Enable source maps for Sentry error tracking
    sourcemap: true,
    // Target modern browsers (matches Supabase client requirements)
    target: 'es2020',
    rollupOptions: {
      output: {
        // Manual chunk splitting — keeps vendor libs separate from app code
        // so users only re-download changed chunks on update
        manualChunks: (id) => {
          // ── Core React runtime (tiny, always needed) ──────────────────
          if (id.includes('node_modules/react/') || id.includes('node_modules/react-dom/')) {
            return 'vendor-react';
          }
          // ── Zustand state management (must be in initial bundle) ───────
          if (id.includes('node_modules/zustand')) {
            return 'vendor-state';
          }
          // ── React Router ──────────────────────────────────────────────
          if (id.includes('node_modules/react-router')) {
            return 'vendor-router';
          }
          // ── TanStack Query ────────────────────────────────────────────
          if (id.includes('node_modules/@tanstack/react-query') ||
              id.includes('node_modules/@tanstack/query')) {
            return 'vendor-query';
          }
          // ── Supabase client ───────────────────────────────────────────
          if (id.includes('node_modules/@supabase/')) {
            return 'vendor-supabase';
          }
          // ── PDF / export — heavy, only used on demand ─────────────────
          if (id.includes('node_modules/jspdf') ||
              id.includes('node_modules/html2canvas')) {
            return 'vendor-pdf';
          }
          // ── Excel export — largest library in the bundle ──────────────
          if (id.includes('node_modules/xlsx')) {
            return 'vendor-xlsx';
          }
          // ── Charts — only used on /reports and /dashboard ─────────────
          if (id.includes('node_modules/recharts') ||
              id.includes('node_modules/d3-')) {
            return 'vendor-charts';
          }
          // ── Framer Motion ─────────────────────────────────────────────
          if (id.includes('node_modules/framer-motion')) {
            return 'vendor-motion';
          }
          // ── Admin portal — dealers never visit /admin ─────────────────
          if (id.includes('/src/admin/')) {
            return 'feature-admin';
          }
          // ── Daily book feature set ────────────────────────────────────
          if (id.includes('/src/features/dailyBook/')) {
            return 'feature-daily-book';
          }
          // ── Reports ───────────────────────────────────────────────────
          if (id.includes('/src/features/reports/')) {
            return 'feature-reports';
          }
          // ── Billing (largest feature) ─────────────────────────────────
          if (id.includes('/src/features/billing/')) {
            return 'feature-billing';
          }
          // ── Suppliers / Purchases ─────────────────────────────────────
          if (id.includes('/src/features/suppliers/') ||
              id.includes('/src/features/purchases/')) {
            return 'feature-suppliers';
          }
        },
      },
    },
  },
});
