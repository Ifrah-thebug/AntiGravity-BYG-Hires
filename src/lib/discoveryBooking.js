export function getDiscoveryBookingUrl() {
  const username = String(import.meta.env.VITE_CAL_USERNAME || 'aaqibhr').trim().toLowerCase();
  const slug = String(import.meta.env.VITE_CAL_DISCOVERY_SLUG || 'discovery-call').trim().toLowerCase();
  return `https://cal.com/${username}/${slug}`;
}
