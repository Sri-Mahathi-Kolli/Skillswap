import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { PaymentsComponent } from './payments.component';

const routes: Routes = [
  { path: '', component: PaymentsComponent },
  { path: 'session', loadComponent: () => import('./session-booking/session-booking.component').then(m => m.SessionBookingComponent) },
  { path: 'checkout/:sessionId', loadComponent: () => import('./stripe-checkout/stripe-checkout.component').then(m => m.StripeCheckoutComponent) }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class PaymentsRoutingModule { }
