/** CP4BA validation build (branch cp4ba): live mode against a Cloud Pak for Business Automation Workflow server / authoring
 *  environment. The dev proxy (proxy.conf.cp4ba.js) maps /rest, /bpm, /ops, /teamworks to the BAW route (with its URL prefix)
 *  and /zen to the Zen (cpd) route. authMode 'zen' exchanges the login credentials for a Zen identity token; 'basic' keeps the
 *  traditional basic authentication (works on the BAW route for LDAP users). Switch with HP_AUTH_MODE at build time is not
 *  possible in Angular: edit this file or keep two copies. */
export const environment = {
  mode: 'live' as 'live' | 'demo',
  restBase: '/rest/bpm/wle/v1',
  bpmBase: '/bpm',
  authMode: 'zen' as 'basic' | 'zen',
  zenBase: '/zen',
  appTitle: 'Headless Portal (CP4BA)',
  scopeApps: ['HDLS'] as string[],
  scopeTeams: ['Managers', 'Finance', 'Operations', 'Support', 'All Users'] as string[],
  demoUsers: [] as string[],
  demoPassword: '',
};
