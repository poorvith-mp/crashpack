// Local preview instrumentation only. Never copied into site-dist.
const params = new URLSearchParams(location.search);
document.documentElement.dataset.networkAttempts = '0';
const denied = () => {
  document.documentElement.dataset.networkAttempts = String(Number(document.documentElement.dataset.networkAttempts) + 1);
  throw new Error('Unexpected network API use in static website');
};
window.fetch = denied;
XMLHttpRequest.prototype.open = denied;
navigator.sendBeacon = denied;
window.WebSocket = denied;
window.EventSource = denied;
new PerformanceObserver(() => {
  document.documentElement.dataset.resourceUrls = JSON.stringify(performance.getEntriesByType('resource').map(entry => entry.name));
}).observe({ type: 'resource', buffered: true });
const copy = navigator.clipboard.writeText.bind(navigator.clipboard);
navigator.clipboard.writeText = async text => {
  await copy(text);
  document.documentElement.dataset.copiedText = text;
};
if (params.has('reduced')) {
  const original = window.matchMedia.bind(window);
  window.matchMedia = query => query.includes('prefers-reduced-motion') ? original('all') : original(query);
}
if (params.has('clipboard-fail')) {
  Object.defineProperty(navigator, 'clipboard', { value: { writeText: async () => { throw new Error('Synthetic permission denial'); } } });
}
