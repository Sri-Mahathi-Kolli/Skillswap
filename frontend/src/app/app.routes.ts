import { Routes } from '@angular/router';
import { AuthGuard } from './core/auth.guard';
import { NotificationsComponent } from './notifications/notifications.component';
import { TestNotificationsComponent } from './test-notifications/test-notifications.component';

export const routes: Routes = [
  { path: 'auth', loadChildren: () => import('./auth/auth.module').then(m => m.AuthModule) },
  { path: 'profile', loadChildren: () => import('./profile/profile.module').then(m => m.ProfileModule), canActivate: [AuthGuard] },
  { path: 'skills', loadChildren: () => import('./skills/skills.module').then(m => m.SkillsModule), canActivate: [AuthGuard] },
  { path: 'chat', loadComponent: () => import('./chat/chat.component').then(m => m.ChatComponent), canActivate: [AuthGuard] },
  { path: 'chat/:userId', loadComponent: () => import('./chat/chat.component').then(m => m.ChatComponent), canActivate: [AuthGuard] },
  { path: 'schedule', loadChildren: () => import('./schedule/schedule.module').then(m => m.ScheduleModule), canActivate: [AuthGuard] },
  { path: 'payments', loadChildren: () => import('./payments/payments.module').then(m => m.PaymentsModule), canActivate: [AuthGuard] },
  { path: 'notifications', component: NotificationsComponent },
  { path: 'test-notifications', component: TestNotificationsComponent, canActivate: [AuthGuard] },
  { path: '', redirectTo: '/auth', pathMatch: 'full' },
  { path: '**', redirectTo: '/auth' }
];
