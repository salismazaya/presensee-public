export function unregister() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.getRegistrations().then(function (registrations) {
      registrations.forEach(async function (registration) {
        await registration.unregister();
        window.location.href = '/';
      });
    });
  }
}

export default {
  unregister
}
