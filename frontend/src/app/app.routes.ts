import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/console/console.component').then((m) => m.ConsoleComponent),
  },
  {
    path: 'profile',
    loadComponent: () =>
      import('./pages/profile/profile.component').then((m) => m.ProfileComponent),
  },
  {
    path: 'login',
    loadComponent: () =>
      import('./pages/login/login.component').then((m) => m.LoginComponent),
  },
  {
    path: 'b/:number',
    loadComponent: () =>
      import('./pages/entry/entry.component').then((m) => m.EntryComponent),
  },
  { path: '**', redirectTo: '' },
];
