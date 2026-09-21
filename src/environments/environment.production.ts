/** Public demo https://headless.quickpod.org: live mode against the lab Process Center (proxied by the nginx vhost of the host). */
export const environment = {
  mode: 'live' as 'live' | 'demo',
  restBase: '/rest/bpm/wle/v1',
  bpmBase: '/bpm',
  /** Sign-on: 'basic' = credentials as basic authentication on every call (traditional BAW); 'zen' = CP4BA identity token (Bearer) + BPMCSRFToken. */
  authMode: 'basic' as 'basic' | 'zen',
  /** Zen platform API base (CP4BA only; proxied to the cpd route): /v1/preauth/validateAuth lives under it. */
  zenBase: '/zen',
  appTitle: 'Headless Portal',
  scopeApps: ['HDLS'] as string[],
  scopeTeams: ['Managers', 'Finance', 'Operations', 'Support', 'All Users'] as string[],
  /** No account is shown on the login page (user decision 2026-09-11: credentials are communicated manually). */
  demoUsers: [] as string[],
  demoPassword: '',
};
