import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatTabsModule } from '@angular/material/tabs';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatSelectModule } from '@angular/material/select';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';

import { PaymentsRoutingModule } from './payments-routing.module';
import { PaymentsComponent } from './payments.component';
import { OverviewTabComponent } from './overview-tab/overview-tab.component';
import { HistoryTabComponent } from './history-tab/history-tab.component';
import { IncomeTabComponent } from './income-tab/income-tab.component';
import { StripeCheckoutComponent } from './stripe-checkout/stripe-checkout.component';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    MatTabsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatTableModule,
    MatSelectModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatInputModule,
    MatFormFieldModule,
    PaymentsRoutingModule,
    PaymentsComponent,
    OverviewTabComponent,
    HistoryTabComponent,
    IncomeTabComponent,
    StripeCheckoutComponent
  ]
})
export class PaymentsModule { }
