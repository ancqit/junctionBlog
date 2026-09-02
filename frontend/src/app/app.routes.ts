import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/feed/feed.component').then((m) => m.FeedComponent),
  },
  {
    path: 'create',
    loadComponent: () => import('./pages/create/create.component').then((m) => m.CreateComponent),
  },
  {
    path: 'profile',
    loadComponent: () =>
      import('./pages/profile/profile.component').then((m) => m.ProfileComponent),
  },
  {
    path: 'login',
    loadComponent: () => import('./pages/login/login.component').then((m) => m.LoginComponent),
  },
  {
    path: 'b/:number',
    loadComponent: () => import('./pages/entry/entry.component').then((m) => m.EntryComponent),
  },
  { path: '**', redirectTo: '' },
];
