/** Public demo https://headless.quickpod.org: live mode against the lab Process Center (proxied by the nginx vhost of the host). */
export const environment = {
  mode: 'live' as 'live' | 'demo',
  restBase: '/rest/bpm/wle/v1',
  bpmBase: '/bpm',
  appTitle: 'Headless Portal',
  scopeApps: ['HDLS'] as string[],
  scopeTeams: ['Managers', 'Finance', 'Operations', 'Support', 'All Users'] as string[],
  /** No account is shown on the login page (user decision 2026-09-11: credentials are communicated manually). */
  demoUsers: [] as string[],
  demoPassword: '',
};
