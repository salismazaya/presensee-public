// import { registerSW } from 'virtual:pwa-register'

// // registerSW({
// //   immediate: true
// // })


export async function unregister() {
  if ("caches" in window) {
    const cacheNames = await caches.keys();

    if ("serviceWorker" in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      for (const registration of registrations) {
        await registration.unregister();
      }
      cacheNames.forEach((cacheName) => {
        caches.delete(cacheName).then(console.log);
      });
    }
  }
}

export function register(): Promise<void> {
  return new Promise(resolve => {
    // if ("serviceWorker" in navigator) {
    // window.addEventListener("load", () => {
    //   console.log("LOAD")
    navigator.serviceWorker
      .register("/sw.js", { scope: "/" }).finally(() => resolve())
    // });
    // }
  })

}

export default {
  unregister,
  register,
};
