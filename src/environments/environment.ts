/** Live mode: every call goes to a Process Center / Process Server (through the dev proxy or an nginx location). */
export const environment = {
  mode: 'live' as 'live' | 'demo',
  restBase: '/rest/bpm/wle/v1',
  bpmBase: '/bpm',
  /** Sign-on: 'basic' = credentials as basic authentication on every call (traditional BAW); 'zen' = CP4BA identity token (Bearer) + BPMCSRFToken. */
  authMode: 'basic' as 'basic' | 'zen',
  /** Zen platform API base (CP4BA only; proxied to the cpd route): /v1/preauth/validateAuth lives under it. */
  zenBase: '/zen',
  appTitle: 'Headless Portal',
  /** Application scope: only tasks, instances, processes and teams of these process applications are shown (empty = everything the engine offers). */
  scopeApps: ['HDLS'] as string[],
  scopeTeams: ['Managers', 'Finance', 'Operations', 'Support', 'All Users'] as string[],
  demoUsers: [] as string[],
  demoPassword: '',
};
