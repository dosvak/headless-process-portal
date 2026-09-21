/** Public demo https://portaldemo.dosvak.com: live mode against a dedicated, isolated BAW 26 Workflow Server (proxied by the nginx vhost
 *  of the host; the engine is reachable only from the portal). The demo accounts have team roles in the sample application only. */
export const environment = {
  mode: 'live' as 'live' | 'demo',
  restBase: '/rest/bpm/wle/v1',
  bpmBase: '/bpm',
  appTitle: 'Headless Portal - Demo',
  scopeApps: ['HDLS'] as string[],
  scopeTeams: ['Managers', 'Finance', 'Operations', 'Support', 'All Users'] as string[],
  /** Published demo accounts (one per team of the sample application + a plain requester); reset nightly. */
  demoUsers: ['demo.manager', 'demo.finance', 'demo.ops', 'demo.support', 'demo.user'] as string[],
  demoPassword: 'demo1234',
};
