import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { CacheFirst, ExpirationPlugin, NetworkFirst, Serwist, StaleWhileRevalidate } from "serwist";

// TypeScript: inform the compiler about the serwist precache manifest injected at build time
declare global {
  interface ServiceWorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    // --- App shell pages (NetworkFirst: sempre tenta a rede, cai no cache offline) ---
    {
      matcher: ({ request }) => request.mode === "navigate",
      handler: new NetworkFirst({
        cacheName: "pages",
        plugins: [
          new ExpirationPlugin({ maxEntries: 50, maxAgeSeconds: 7 * 24 * 60 * 60 }),
        ],
      }),
    },

    // --- Tiles de mapa (StaleWhileRevalidate: serve do cache imediatamente, atualiza em background) ---
    {
      matcher: ({ url }) =>
        url.hostname.includes("tile.openstreetmap.org") ||
        url.hostname.includes("cartodb-basemaps") ||
        url.hostname.includes("basemaps.cartocdn.com") ||
        url.hostname.includes("tiles.stadiamaps.com") ||
        url.hostname.includes("tile.opentopomap.org"),
      handler: new CacheFirst({
        cacheName: "map-tiles",
        plugins: [
          new ExpirationPlugin({
            maxEntries: 500,
            maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
            purgeOnQuotaError: true,
          }),
        ],
      }),
    },

    // --- Assets estáticos (CacheFirst: ícones, fontes, imagens) ---
    {
      matcher: ({ request }) =>
        request.destination === "image" ||
        request.destination === "font",
      handler: new CacheFirst({
        cacheName: "static-assets",
        plugins: [
          new ExpirationPlugin({
            maxEntries: 200,
            maxAgeSeconds: 30 * 24 * 60 * 60,
            purgeOnQuotaError: true,
          }),
        ],
      }),
    },

    // --- Fotos do Firebase Storage (CacheFirst: fotos já sincronizadas não mudam) ---
    {
      matcher: ({ url }) =>
        url.hostname.includes("firebasestorage.googleapis.com"),
      handler: new CacheFirst({
        cacheName: "firebase-photos",
        plugins: [
          new ExpirationPlugin({
            maxEntries: 300,
            maxAgeSeconds: 30 * 24 * 60 * 60,
            purgeOnQuotaError: true,
          }),
        ],
      }),
    },

    // --- API do Next.js / Firebase Firestore (NetworkFirst) ---
    {
      matcher: ({ url }) =>
        url.pathname.startsWith("/api/") ||
        url.hostname.includes("firestore.googleapis.com"),
      handler: new NetworkFirst({
        cacheName: "api-cache",
        plugins: [
          new ExpirationPlugin({ maxEntries: 100, maxAgeSeconds: 60 * 60 }),
        ],
      }),
    },

    // --- Nominatim / Geocodificação (StaleWhileRevalidate) ---
    {
      matcher: ({ url }) => url.hostname.includes("nominatim.openstreetmap.org"),
      handler: new StaleWhileRevalidate({
        cacheName: "geocoding-cache",
        plugins: [
          new ExpirationPlugin({ maxEntries: 200, maxAgeSeconds: 7 * 24 * 60 * 60 }),
        ],
      }),
    },

    // --- Estratégias padrão do Next.js (JS, CSS gerados pelo build) ---
    ...defaultCache,
  ],
});

serwist.addEventListeners();
