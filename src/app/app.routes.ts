import { Routes } from '@angular/router';
import { authGuard } from './core/auth/auth.guard';

/** Lazy routes: the login page and the shell with every portal area. */
export const routes: Routes = [
  { path: 'login', loadComponent: () => import('./features/login/login').then(m => m.LoginPage), title: 'Sign in' },
  {
    path: '', canActivate: [authGuard], loadComponent: () => import('./core/layout/shell').then(m => m.ShellComponent),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'work' },
      { path: 'work', loadComponent: () => import('./features/work/work').then(m => m.WorkPage), title: 'Work' },
      { path: 'task/:id', loadComponent: () => import('./features/task/task').then(m => m.TaskPage), title: 'Task' },
      { path: 'launch', loadComponent: () => import('./features/launch/launch').then(m => m.LaunchPage), title: 'Launch' },
      { path: 'instances', loadComponent: () => import('./features/instances/instances').then(m => m.InstancesPage), title: 'Instances' },
      { path: 'instance/:id', loadComponent: () => import('./features/instances/instance').then(m => m.InstancePage), title: 'Instance' },
      { path: 'dashboards', loadComponent: () => import('./features/dashboards/dashboards').then(m => m.DashboardsPage), title: 'Dashboards' },
      { path: 'search', loadComponent: () => import('./features/search/search').then(m => m.SearchPage), title: 'Search' },
      { path: 'profile', loadComponent: () => import('./features/profile/profile').then(m => m.ProfilePage), title: 'Profile' },
      { path: 'teams', loadComponent: () => import('./features/teams/teams').then(m => m.TeamsPage), title: 'Teams' },
    ],
  },
  { path: '**', redirectTo: 'work' },
];
