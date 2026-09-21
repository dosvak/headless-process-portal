/** Live mode: every call goes to a Process Center / Process Server (through the dev proxy or an nginx location). */
export const environment = {
  mode: 'live' as 'live' | 'demo',
  restBase: '/rest/bpm/wle/v1',
  bpmBase: '/bpm',
  appTitle: 'Headless Portal',
  /** Application scope: only tasks, instances, processes and teams of these process applications are shown (empty = everything the engine offers). */
  scopeApps: ['HDLS'] as string[],
  scopeTeams: ['Managers', 'Finance', 'Operations', 'Support', 'All Users'] as string[],
  demoUsers: [] as string[],
  demoPassword: '',
};
