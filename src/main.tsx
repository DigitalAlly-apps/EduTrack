import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

const isStaleAssetError = (value: unknown) => {
  const message = value instanceof Error ? value.message : String(value ?? "");
  return /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|Loading chunk|CSS chunk|stylesheet/i.test(message);
};

const recoverFromStaleAssets = async () => {
  const key = "edutrack_asset_recovery";
  if (sessionStorage.getItem(key) === "1") return;
  sessionStorage.setItem(key, "1");

  try {
    const registrations = await navigator.serviceWorker?.getRegistrations();
    await Promise.all((registrations ?? []).map(registration => registration.unregister()));
  } catch {
    // Ignore cleanup failures; a reload still gives the browser a chance to refetch assets.
  }

  try {
    const names = await caches.keys();
    await Promise.all(names.map(name => caches.delete(name)));
  } catch {
    // Cache API can be unavailable in some browsers/private modes.
  }

  window.location.reload();
};

window.addEventListener("error", event => {
  const target = event.target as HTMLElement | null;
  const isAssetElement = target?.tagName === "SCRIPT" || target?.tagName === "LINK";
  if (isAssetElement || isStaleAssetError(event.error || event.message)) {
    void recoverFromStaleAssets();
  }
}, true);

window.addEventListener("unhandledrejection", event => {
  if (isStaleAssetError(event.reason)) {
    event.preventDefault();
    void recoverFromStaleAssets();
  }
});

// PWA: Guard against service worker in iframe/preview contexts
const isInIframe = (() => {
  try {
    return window.self !== window.top;
  } catch (e) {
    return true;
  }
})();

const isPreviewHost =
  window.location.hostname.includes("id-preview--") ||
  window.location.hostname.includes("lovableproject.com");

const shouldDisableServiceWorker = import.meta.env.DEV || isPreviewHost || isInIframe;

if (shouldDisableServiceWorker) {
  navigator.serviceWorker?.getRegistrations().then(async (registrations) => {
    await Promise.all(registrations.map((r) => r.unregister()));
    try {
      const names = await caches.keys();
      await Promise.all(names.map(name => caches.delete(name)));
    } catch {
      // Cache API can be unavailable in some browsers/private modes.
    }
  });
}

createRoot(document.getElementById("root")!).render(<App />);
