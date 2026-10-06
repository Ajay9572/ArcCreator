/* Hand-drawn line-icon set for architecture components. Each entry is the
   INNER markup of a 24x24 viewBox icon (no outer <svg>) so it can be dropped
   into a <symbol> and reused with <use>. */

const ICON_DEFS = {
  user: '<circle cx="12" cy="8" r="3.4"/><path d="M5 20c0-3.6 3.1-6.2 7-6.2s7 2.6 7 6.2"/>',
  browser: '<rect x="3" y="4.5" width="18" height="15" rx="2"/><path d="M3 8.5h18"/><circle cx="6" cy="6.5" r="0.6" fill="currentColor" stroke="none"/><circle cx="8.5" cy="6.5" r="0.6" fill="currentColor" stroke="none"/>',
  mobile: '<rect x="7.5" y="2" width="9" height="20" rx="2"/><line x1="10.5" y1="19" x2="13.5" y2="19"/>',
  server: '<rect x="3" y="4" width="18" height="7" rx="1.5"/><rect x="3" y="13" width="18" height="7" rx="1.5"/><circle cx="7" cy="7.5" r="0.9" fill="currentColor" stroke="none"/><circle cx="7" cy="16.5" r="0.9" fill="currentColor" stroke="none"/>',
  microservice: '<rect x="9" y="2" width="6" height="6" rx="1.4"/><rect x="2" y="15" width="6" height="6" rx="1.4"/><rect x="16" y="15" width="6" height="6" rx="1.4"/><path d="M11 8l-4 7M13 8l4 7M8 18h8"/>',
  gateway: '<rect x="6" y="4" width="12" height="16" rx="2"/><path d="M2 12h4M18 12h4M4.5 9.5L2 12l2.5 2.5M19.5 9.5L22 12l-2.5 2.5"/>',
  loadbalancer: '<circle cx="12" cy="4.5" r="2"/><circle cx="5" cy="19" r="2"/><circle cx="12" cy="19" r="2"/><circle cx="19" cy="19" r="2"/><path d="M12 6.5v4M12 10.5L5 17M12 10.5v6M12 10.5l7 6.5"/>',
  container: '<rect x="3" y="14" width="18" height="6.5" rx="1.2"/><rect x="6.2" y="9" width="4" height="4"/><rect x="10.8" y="9" width="4" height="4"/><rect x="8.5" y="4.2" width="4" height="4"/>',
  kubernetes: '<path d="M12 2.3l8.2 4.5v10.4L12 21.7l-8.2-4.5V6.8L12 2.3z"/><circle cx="12" cy="12" r="3.2"/>',
  function: '<path d="M9.5 4.2c-2 0-3 1.1-3 3.1v2.4c0 1.1-.9 2-2 2.3 1.1.3 2 1.2 2 2.3v2.4c0 2 1 3.1 3 3.1"/><path d="M14.5 4.2c2 0 3 1.1 3 3.1v2.4c0 1.1.9 2 2 2.3-1.1.3-2 1.2-2 2.3v2.4c0 2-1 3.1-3 3.1"/>',
  database: '<ellipse cx="12" cy="5.5" rx="8" ry="3"/><path d="M4 5.5v13c0 1.7 3.6 3 8 3s8-1.3 8-3v-13"/><path d="M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3"/>',
  cache: '<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M13 6.5l-5.2 6.3h4l-1 5.2 5.4-6.3h-4.2z" fill="currentColor" stroke="none"/>',
  storage: '<path d="M4.5 8L6 4.5h12L19.5 8"/><path d="M4.5 8h15l-1.4 11a2 2 0 0 1-2 1.8H7.9a2 2 0 0 1-2-1.8L4.5 8z"/><path d="M9.5 11.5v6M14.5 11.5v6"/>',
  queue: '<rect x="2" y="8.5" width="5.6" height="7" rx="1"/><rect x="9.2" y="6" width="5.6" height="12" rx="1"/><rect x="16.4" y="8.5" width="5.6" height="7" rx="1"/>',
  cdn: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3c2.6 2.5 2.6 15.5 0 18M12 3c-2.6 2.5-2.6 15.5 0 18"/>',
  dns: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="1.3" fill="currentColor" stroke="none"/><path d="M12 3.5v4M12 16.5v4M3.5 12h4M16.5 12h4"/>',
  network: '<circle cx="12" cy="4.8" r="2"/><circle cx="5" cy="17.5" r="2"/><circle cx="19" cy="17.5" r="2"/><path d="M12 6.8L6.3 15.7M12 6.8l5.7 8.9M7.5 17.5h9"/>',
  firewall: '<path d="M12 2.8l7.2 3v6.1c0 5.1-3.4 8.3-7.2 9.3-3.8-1-7.2-4.2-7.2-9.3V5.8l7.2-3z"/><path d="M9 12l2 2 3.6-4"/>',
  auth: '<rect x="5" y="10.5" width="14" height="9.5" rx="2"/><path d="M8 10.5v-4a4 4 0 0 1 8 0v4"/><circle cx="12" cy="15" r="1.3" fill="currentColor" stroke="none"/>',
  monitoring: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M6 14.5l3-3.2 2.2 2.2 4-5 2.8 3"/>',
  notification: '<path d="M12 3.2a5 5 0 0 0-5 5v3.3c0 1.1-.4 2.1-1.2 2.8L4.5 15.6h15l-1.3-1.3c-.8-.7-1.2-1.7-1.2-2.8V8.2a5 5 0 0 0-5-5z"/><path d="M9.6 18.8a2.5 2.5 0 0 0 4.8 0"/>',
  analytics: '<rect x="4" y="10.5" width="3.4" height="9.5" rx="0.8"/><rect x="10.3" y="5.5" width="3.4" height="14.5" rx="0.8"/><rect x="16.6" y="13.5" width="3.4" height="6.5" rx="0.8"/>',
  ml: '<circle cx="12" cy="12" r="9"/><circle cx="8.5" cy="9" r="1.2" fill="currentColor" stroke="none"/><circle cx="15.5" cy="9" r="1.2" fill="currentColor" stroke="none"/><circle cx="12" cy="15.5" r="1.2" fill="currentColor" stroke="none"/><path d="M8.5 9l3.5 6.5 3.5-6.5M8.5 9h7"/>',
  cloud: '<path d="M7.2 18.2h10a4 4 0 0 0 .5-7.96A6 6 0 0 0 6.1 9.1 4.4 4.4 0 0 0 7.2 18.2z"/>',
  generic: '<rect x="4.5" y="4.5" width="15" height="15" rx="3"/><circle cx="12" cy="12" r="2.2"/>'
};

/* Palette / dropdown ordering + default labels + visual grouping */
const ICON_META = [
  { id: 'user', label: 'User', group: 'client' },
  { id: 'browser', label: 'Browser', group: 'client' },
  { id: 'mobile', label: 'Mobile App', group: 'client' },
  { id: 'loadbalancer', label: 'Load Balancer', group: 'network' },
  { id: 'cdn', label: 'CDN', group: 'network' },
  { id: 'dns', label: 'DNS', group: 'network' },
  { id: 'firewall', label: 'Firewall', group: 'network' },
  { id: 'network', label: 'Network', group: 'network' },
  { id: 'gateway', label: 'API Gateway', group: 'compute' },
  { id: 'server', label: 'Server', group: 'compute' },
  { id: 'microservice', label: 'Service', group: 'compute' },
  { id: 'container', label: 'Container', group: 'compute' },
  { id: 'kubernetes', label: 'Kubernetes', group: 'compute' },
  { id: 'function', label: 'Function', group: 'compute' },
  { id: 'database', label: 'Database', group: 'data' },
  { id: 'cache', label: 'Cache', group: 'data' },
  { id: 'storage', label: 'Storage', group: 'data' },
  { id: 'queue', label: 'Queue', group: 'messaging' },
  { id: 'notification', label: 'Notifications', group: 'messaging' },
  { id: 'auth', label: 'Auth', group: 'platform' },
  { id: 'monitoring', label: 'Monitoring', group: 'platform' },
  { id: 'analytics', label: 'Analytics', group: 'platform' },
  { id: 'ml', label: 'ML Model', group: 'platform' },
  { id: 'cloud', label: 'Cloud', group: 'platform' },
  { id: 'generic', label: 'Generic', group: 'generic' }
];

const TYPE_GROUP = {};
const TYPE_LABEL = {};
ICON_META.forEach(m => { TYPE_GROUP[m.id] = m.group; TYPE_LABEL[m.id] = m.label; });

