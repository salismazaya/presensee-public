export async function unregister() {
  if ("caches" in window) {
    const cacheNames = await caches.keys();

    if ("serviceWorker" in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      for (const registration of registrations) {
        await registration.unregister();
      }
      cacheNames.forEach((cacheName) => {
        caches.delete(cacheName);
      });
      window.location.href = "/";
    }
  }
}

export function register() {
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("/sw.js", { scope: "/" });
    });
  }
}

export default {
  unregister,
  register,
};
