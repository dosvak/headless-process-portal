/** Demo mode: stubbed APIs and data, no Process Center / Process Portal dependency (https://headless.dosvak.com). */
export const environment = {
  mode: 'demo' as 'live' | 'demo',
  restBase: '/rest/bpm/wle/v1',
  bpmBase: '/bpm',
  appTitle: 'Headless Portal',
  /** Application scope: only tasks, instances, processes and teams of these process applications are shown (empty = everything the engine offers). */
  scopeApps: ['HDLS'] as string[],
  scopeTeams: ['Managers', 'Finance', 'Operations', 'Support', 'All Users'] as string[],
  demoUsers: ['celladmin', 'alice', 'bob', 'carol'],
  demoPassword: 'demo',
};
