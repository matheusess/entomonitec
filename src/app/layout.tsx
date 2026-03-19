import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Sistema de Vigilância Entomológica",
  description: "Plataforma para monitoramento e controle vetorial de mosquitos transmissores de doenças",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "EntomoVigilância",
  },
  icons: {
    icon: [
      { url: "/icons/icon-192x192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512x512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/icons/icon-152x152.png", sizes: "152x152", type: "image/png" },
      { url: "/icons/icon-192x192.png", sizes: "192x192", type: "image/png" },
    ],
  },
  other: {
    "mobile-web-app-capable": "yes",
    "apple-mobile-web-app-capable": "yes",
    "apple-mobile-web-app-status-bar-style": "default",
  },
};

export const viewport: Viewport = {
  themeColor: "#16a34a",
  width: "device-width",
  initialScale: 1,
  minimumScale: 1,
  viewportFit: "cover",
};

const chunkRecoveryBootstrap = `
(function () {
  try {
    var isLocal = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";

    var cleanupServiceWorkerCaches = function () {
      if (!("serviceWorker" in navigator)) return Promise.resolve();

      return navigator.serviceWorker.getRegistrations()
        .then(function (registrations) {
          return Promise.all(
            registrations.map(function (registration) {
              return registration.unregister();
            })
          );
        })
        .then(function () {
          if (!("caches" in window)) return;
          return caches.keys().then(function (keys) {
            return Promise.all(
              keys
                .filter(function (name) {
                  return name.indexOf("serwist") >= 0 || name.indexOf("next") >= 0 || name.indexOf("_next") >= 0;
                })
                .map(function (name) {
                  return caches.delete(name);
                })
            );
          });
        });
    };

    var recoverFromChunkError = function () {
      var flag = "chunk-bootstrap-recovery-attempted";
      if (sessionStorage.getItem(flag) === "1") return;

      sessionStorage.setItem(flag, "1");
      cleanupServiceWorkerCaches().finally(function () {
        window.location.reload();
      });
    };

    window.addEventListener(
      "error",
      function (event) {
        var message = (event && event.message) || "";
        if (message.indexOf("ChunkLoadError") >= 0 || message.indexOf("Loading chunk") >= 0) {
          recoverFromChunkError();
        }
      },
      true
    );

    if (isLocal) {
      var localCleanupFlag = "localhost-sw-cleanup-done";
      if (sessionStorage.getItem(localCleanupFlag) !== "1") {
        sessionStorage.setItem(localCleanupFlag, "1");
        cleanupServiceWorkerCaches().finally(function () {
          window.location.reload();
        });
      }
    }
  } catch (error) {
    // no-op
  }
})();
`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <head>
        <script dangerouslySetInnerHTML={{ __html: chunkRecoveryBootstrap }} />
      </head>
      <body className={inter.className}>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
