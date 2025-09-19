import { Component, OnInit, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { PaymentService, PaymentSettings } from '../services/payment.service';

@Component({
  selector: 'app-payment-settings',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatSlideToggleModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule
  ],
  template: `
    <div class="payment-settings">
      <div class="settings-header">
        <mat-icon>payment</mat-icon>
        <h3>Payment Settings</h3>
      </div>

      <div class="payment-toggle-wrapper">
        <div class="toggle-question">
          <h4>How do you want to offer your sessions?</h4>
        </div>
        
        <div class="toggle-container">
          <div class="toggle-options">
            <label class="toggle-option" [class.active]="!settings.stripeEnabled">
              <input type="radio" [value]="false" [(ngModel)]="settings.stripeEnabled" (change)="onModeChange()">
              <div class="option-content">
                <mat-icon>favorite</mat-icon>
                <span class="option-title">Free</span>
                <span class="option-subtitle">Help others learn</span>
              </div>
            </label>
            
            <label class="toggle-option" [class.active]="settings.stripeEnabled">
              <input type="radio" [value]="true" [(ngModel)]="settings.stripeEnabled" (change)="onModeChange()">
              <div class="option-content">
                <mat-icon>monetization_on</mat-icon>
                <span class="option-title">Paid</span>
                <span class="option-subtitle">Earn from teaching</span>
              </div>
            </label>
          </div>
          
          <div class="explanation">
            <p *ngIf="!settings.stripeEnabled" class="free-explanation">
              <mat-icon>info</mat-icon>
              Your sessions are free. Students can book directly without payment.
            </p>
            <p *ngIf="settings.stripeEnabled" class="paid-explanation">
              <mat-icon>info</mat-icon>
              Students will pay your set prices before booking sessions with you.
            </p>
          </div>
        </div>
      </div>

      <div *ngIf="settings.stripeEnabled" class="pricing-setup">
        <div style="background: #fcfcfd; border-radius: 8px; box-shadow: 0 1px 4px rgba(33,150,243,0.04); padding: 12px 16px; margin-bottom: 14px; border: 1px solid #f0f2f5; display: flex; flex-direction: column; align-items: flex-start;">
          <h4 style="color: #222; margin: 0 0 6px 0; font-size: 1rem; font-weight: 600; letter-spacing: 0.1px; display: flex; align-items: center; gap: 4px;">
            <mat-icon style="font-size: 1.1rem; color: #1976d2; vertical-align: middle;">attach_money</mat-icon>
            Set Your Custom Session Rates
          </h4>
          <p style="color: #555; font-size: 0.97rem; margin-bottom: 0;">Add any session duration and amount you want. All changes are saved to your profile and reflected in the UI.</p>
        </div>

        <div class="custom-pricing-list">
          <div class="custom-pricing-row">
            <mat-form-field appearance="outline" style="width: 120px; margin-right: 10px;">
              <mat-label>Duration (min)</mat-label>
              <input matInput type="number" [value]="40" disabled>
            </mat-form-field>
            <mat-form-field appearance="outline" style="width: 120px; margin-right: 10px;">
              <mat-label>Amount ($)</mat-label>
              <input matInput type="number" [(ngModel)]="customPricing[0].amount" min="0" (ngModelChange)="onCustomPricingChange()">
            </mat-form-field>
          </div>
        </div>

        <div class="pricing-tips">
          <div class="tip-item">
            <mat-icon>lightbulb</mat-icon>
            <span>Set any session length and price you want</span>
          </div>
        </div>
      </div>

      <div class="actions">
        <button 
          mat-raised-button 
          color="primary" 
          class="save-button"
          (click)="saveSettings()"
          [disabled]="!hasChanges || saving"
          [class.has-changes]="hasChanges && !saving">
          <mat-icon *ngIf="saving">hourglass_empty</mat-icon>
          <mat-icon *ngIf="!saving && hasChanges">save</mat-icon>
          <mat-icon *ngIf="!saving && !hasChanges">check</mat-icon>
          {{saving ? 'Saving Changes...' : (hasChanges ? 'Save Payment Settings' : 'Settings Saved')}}
        </button>
        <div class="save-hint" *ngIf="hasChanges && !saving">
          <mat-icon>info</mat-icon>
          <span>You have unsaved changes</span>
        </div>
      </div>

      <div *ngIf="message" 
           class="message" 
           [ngClass]="messageType"
           [style.background]="messageType === 'success' ? 'linear-gradient(90deg, #e8f5e9 0%, #ffffff 100%)' : 'linear-gradient(90deg, #ffeaea 0%, #ffffff 100%)'"
           [style.color]="messageType === 'success' ? '#388e3c' : '#d32f2f'"
           style="border-radius: 14px; border-left: 5px solid; padding: 18px 28px; margin-bottom: 18px; box-shadow: 0 4px 12px rgba(76,175,80,0.10); display: flex; align-items: center; gap: 12px; font-size: 1.08rem; font-weight: 500;">
        <mat-icon style="font-size: 1.7rem; color: inherit;">{{messageType === 'success' ? 'check_circle' : 'error'}}</mat-icon>
        <span>{{message}}</span>
      </div>
    </div>
  `,
  styles: [`
    .payment-settings {
      padding: 20px;
      max-width: 600px;
    }

    .settings-header {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 20px;
    }

    .settings-header h3 {
      margin: 0;
      color: #333;
    }

    .payment-toggle-wrapper {
      margin-bottom: 30px;
    }

    .toggle-question h4 {
      margin: 0 0 20px 0;
      font-size: 16px;
      font-weight: 500;
      color: #333;
    }

    .toggle-container {
      background: white;
      border: 1px solid #e0e0e0;
      border-radius: 8px;
      padding: 20px;
    }

    .toggle-options {
      display: flex;
      gap: 15px;
      margin-bottom: 15px;
    }

    .toggle-option {
      flex: 1;
      cursor: pointer;
      border: 2px solid #e0e0e0;
      border-radius: 8px;
      padding: 20px 15px;
      text-align: center;
      transition: all 0.3s ease;
      background: #fafafa;
    }

    .toggle-option input[type="radio"] {
      display: none;
    }

    .toggle-option:hover {
      border-color: #2196f3;
      background: #f5f5f5;
    }

    .toggle-option.active {
      border-color: #2196f3;
      background: #e3f2fd;
      box-shadow: 0 2px 8px rgba(33, 150, 243, 0.2);
    }

    .option-content {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
    }

    .option-content mat-icon {
      font-size: 32px;
      width: 32px;
      height: 32px;
      color: #666;
      transition: color 0.3s ease;
    }

    .toggle-option.active .option-content mat-icon {
      color: #2196f3;
    }

    .option-title {
      font-size: 16px;
      font-weight: 600;
      color: #333;
      display: block;
    }

    .option-subtitle {
      font-size: 12px;
      color: #666;
      display: block;
    }

    .toggle-option.active .option-title {
      color: #2196f3;
    }

    .explanation {
      padding: 15px;
      border-radius: 6px;
      background: #f8f9fa;
    }

    .explanation p {
      margin: 0;
      display: flex;
      align-items: center;
      gap: 10px;
      font-size: 14px;
      color: #555;
    }

    .explanation mat-icon {
      font-size: 18px !important;
      width: 18px !important;
      height: 18px !important;
      color: #2196f3 !important;
    }

    .free-explanation {
      background: #f1f8e9;
      border-left: 3px solid #4caf50;
      padding-left: 15px;
    }

    .paid-explanation {
      background: #fff3e0;
      border-left: 3px solid #ff9800;
      padding-left: 15px;
    }

    .pricing-setup {
      margin-bottom: 30px;
    }

    .pricing-header {
      margin-bottom: 25px;
      text-align: center;
    }

    .pricing-header h4 {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      margin: 0 0 10px 0;
      font-size: 18px;
      color: #333;
    }

    .pricing-header p {
      margin: 0;
      color: #666;
      font-size: 14px;
    }

    .pricing-cards {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 20px;
      margin-bottom: 25px;
    }

    .pricing-card {
      background: white;
      border: 2px solid #e0e0e0;
      border-radius: 12px;
      padding: 25px 20px;
      text-align: center;
      transition: all 0.3s ease;
      position: relative;
    }

    .pricing-card:hover {
      border-color: #2196f3;
      box-shadow: 0 4px 12px rgba(33, 150, 243, 0.15);
    }

    .pricing-card.popular {
      border-color: #4caf50;
      background: linear-gradient(135deg, #f1f8e9 0%, #ffffff 100%);
    }

    .popular-badge {
      position: absolute;
      top: -10px;
      left: 50%;
      transform: translateX(-50%);
      background: #4caf50;
      color: white;
      padding: 4px 12px;
      border-radius: 12px;
      font-size: 11px;
      font-weight: 600;
    }

    .card-header {
      margin-bottom: 20px;
    }

    .card-header mat-icon {
      font-size: 32px;
      width: 32px;
      height: 32px;
      color: #2196f3;
      margin-bottom: 8px;
    }

    .card-header h5 {
      margin: 0 0 5px 0;
      font-size: 16px;
      font-weight: 600;
      color: #333;
    }

    .duration {
      font-size: 12px;
      color: #666;
      background: #f5f5f5;
      padding: 4px 8px;
      border-radius: 12px;
    }

    .price-input-group {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 5px;
      margin-bottom: 10px;
      background: #fafafa;
      padding: 15px;
      border-radius: 8px;
    }

    .currency-symbol {
      font-size: 18px;
      font-weight: bold;
      color: #333;
    }

    .price-input {
      border: none;
      background: transparent;
      font-size: 24px;
      font-weight: bold;
      width: 80px;
      text-align: center;
      color: #2196f3;
      outline: none;
    }

    .price-input::placeholder {
      color: #ccc;
    }

    .per-session {
      font-size: 12px;
      color: #666;
    }

    .suggested-price {
      font-size: 11px;
      color: #4caf50;
      font-style: italic;
    }

    .pricing-tips {
      background: #f8f9fa;
      padding: 20px;
      border-radius: 8px;
      border-left: 4px solid #2196f3;
    }

    .tip-item {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 10px;
      font-size: 14px;
      color: #555;
    }

    .tip-item:last-child {
      margin-bottom: 0;
    }

    .tip-item mat-icon {
      font-size: 16px !important;
      width: 16px !important;
      height: 16px !important;
      color: #2196f3 !important;
      color: #4caf50;
    }

    .actions {
      text-align: center;
      margin: 30px 0 20px 0;
      padding: 20px;
      background: #f8f9fa;
      border-radius: 8px;
      border: 1px solid #e0e0e0;
    }

    .save-button {
      padding: 15px 40px !important;
      font-size: 16px !important;
      font-weight: 600 !important;
      min-width: 200px;
      transition: all 0.3s ease !important;
    }

    .save-button.has-changes {
      background-color: #4caf50 !important;
      transform: scale(1.05);
      box-shadow: 0 4px 12px rgba(76, 175, 80, 0.3) !important;
    }

    .save-button:disabled {
      opacity: 0.6 !important;
      transform: scale(1) !important;
    }

    .save-hint {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      margin-top: 10px;
      color: #ff9800;
      font-size: 14px;
      font-weight: 500;
    }

    .save-hint mat-icon {
      font-size: 18px !important;
      width: 18px !important;
      height: 18px !important;
    }

    .message {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 12px 15px;
      border-radius: 8px;
      font-size: 14px;
    }

    .message.success {
      background-color: #e8f5e8;
      color: #4caf50;
      border: 1px solid #c8e6c9;
    }

    .message.error {
      background-color: #ffeaea;
      color: #f44336;
      border: 1px solid #ffcdd2;
    }

    ::ng-deep .mat-mdc-form-field {
      width: 100%;
    }

    ::ng-deep .mat-mdc-slide-toggle {
      --mdc-switch-selected-track-color: #4caf50;
    }
  `]
})
export class PaymentSettingsComponent implements OnInit {
  customPricing: { duration: number; amount: number }[] = [{ duration: 40, amount: 0 }];
  @Input() userId: string = '';
  @Output() settingsChange = new EventEmitter<PaymentSettings>();

  settings: PaymentSettings = {
    stripeEnabled: false,
    pricing: {
      thirtyMin: 0,
      sixtyMin: 0,
      ninetyMin: 0
    },
    currency: 'USD'
  };

  originalSettings: PaymentSettings | null = null;
  saving = false;
  hasChanges = false;
  message = '';
  messageType: 'success' | 'error' = 'success';

  constructor(private paymentService: PaymentService) {}

  ngOnInit(): void {
    this.loadSettings();
    this.paymentService.paymentSettings$.subscribe(settings => {
      if (settings) {
        this.customPricing = settings.customPricing && settings.customPricing.length > 0
          ? settings.customPricing
          : [{ duration: 40, amount: 0 }];
      } else {
        this.customPricing = [{ duration: 40, amount: 0 }];
      }
    });
  }

    loadSettings(): void {
    this.paymentService.paymentSettings$.subscribe({
      next: (settings) => {
        if (settings) {
          // Ensure pricing object exists
          const safeSettings = {
            ...settings,
            pricing: settings.pricing || {
              thirtyMin: 0,
              sixtyMin: 0,
              ninetyMin: 0
            },
            customPricing: settings.customPricing && settings.customPricing.length > 0
              ? settings.customPricing
              : [{ duration: 40, amount: 0 }]
          };
          this.settings = { ...safeSettings };
          this.originalSettings = { ...safeSettings };
          this.customPricing = safeSettings.customPricing;
          this.hasChanges = false;
        } else {
          this.customPricing = [{ duration: 40, amount: 0 }];
        }
      },
      error: (error) => {
        console.error('Error loading payment settings:', error);
        this.message = 'Failed to load payment settings';
        this.messageType = 'error';
      }
    });
    // Trigger initial load
    this.paymentService.loadPaymentSettings();
  }

    onStripeToggle(): void {
      this.checkForChanges();
      if (!this.settings.stripeEnabled) {
        // Reset pricing when disabled
        this.settings.pricing = {
          thirtyMin: 0,
          sixtyMin: 0,
          ninetyMin: 0
        };
      }
    }

  togglePaymentMode(): void {
    this.settings.stripeEnabled = !this.settings.stripeEnabled;
    this.onStripeToggle();
  }

  setPaymentMode(enabled: boolean): void {
  this.settings.stripeEnabled = enabled;
  this.onStripeToggle();
  // Always enforce single 40min duration
  this.customPricing = [{ duration: 40, amount: this.customPricing[0]?.amount || 0 }];
  this.hasChanges = true;
  }

  onModeChange(): void {
    this.onStripeToggle();
  }

  onPricingChange(): void {
    // Ensure pricing object exists
    if (!this.settings.pricing) {
      this.settings.pricing = {
        thirtyMin: 0,
        sixtyMin: 0,
        ninetyMin: 0
      };
    }
    this.checkForChanges();
  }

  checkForChanges(): void {
    if (!this.originalSettings) {
      this.hasChanges = false;
      return;
    }

    this.hasChanges = JSON.stringify(this.settings) !== JSON.stringify(this.originalSettings);
  }

  getFormattedPrice(duration: number): string {
    let price = 0;
    switch (duration) {
      case 30:
        price = this.settings.pricing.thirtyMin;
        break;
      case 60:
        price = this.settings.pricing.sixtyMin;
        break;
      case 90:
        price = this.settings.pricing.ninetyMin;
        break;
    }

    if (price === 0) {
      return 'Free';
    }

    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: this.settings.currency
    }).format(price);
  }

  addCustomPricing() {
  // Disabled: Only one duration allowed
  }
  removeCustomPricing(index: number) {
  // Disabled: Only one duration allowed
  }
  onCustomPricingChange() {
    this.hasChanges = true;
  }
  saveSettings(): void {
    this.saving = true;
    this.message = '';
    // Save both legacy and custom pricing
  const payload: any = { ...this.settings, customPricing: this.customPricing ?? [] };
    this.paymentService.updatePaymentSettings(payload).subscribe(
      (updatedSettings) => {
        this.saving = false;
        // Ensure customPricing is present in the UI state
        const mergedSettings = {
          ...updatedSettings,
          customPricing: this.customPricing
        };
        this.originalSettings = { ...mergedSettings };
        this.settings = { ...mergedSettings };
        this.hasChanges = false;
        this.message = 'Payment settings saved successfully!';
        this.messageType = 'success';
        this.settingsChange.emit(mergedSettings);
        // Update the payment service state
        this.paymentService.loadPaymentSettings();
        // Force reload of page to ensure new amount is reflected everywhere
        setTimeout(() => {
          window.location.reload();
        }, 500);
      },
      (error) => {
        this.saving = false;
        this.message = 'Failed to save payment settings. Please try again.';
        this.messageType = 'error';
        setTimeout(() => {
          this.message = '';
        }, 5000);
      }
    );
  }

}
