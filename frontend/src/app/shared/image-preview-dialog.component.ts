import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';

@Component({
  selector: 'app-image-preview-dialog',
  standalone: true,
  imports: [CommonModule, MatButtonModule],
  template: `
    <div class="image-preview-container">
      <div class="image-preview-header">
        <h3>{{ data.expertName }}'s Profile</h3>
        <button mat-icon-button (click)="close()" class="close-button">
          <span class="close-icon">×</span>
        </button>
      </div>
      <div class="image-preview-content">
        <img [src]="data.imageUrl" [alt]="data.expertName + ' profile image'" 
             (error)="onImgError($event)" class="preview-image">
      </div>
      <div class="image-preview-actions">
        <button mat-button (click)="close()">Close</button>
      </div>
    </div>
  `,
  styles: [`
    .image-preview-container {
      display: flex;
      flex-direction: column;
      max-width: 100%;
      max-height: 100%;
    }
    
    .image-preview-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px;
      border-bottom: 1px solid #e0e0e0;
    }
    
    .image-preview-header h3 {
      margin: 0;
      color: #333;
    }
    
    .close-button {
      background: none;
      border: none;
      font-size: 24px;
      cursor: pointer;
      color: #666;
      padding: 4px;
      border-radius: 4px;
      transition: background-color 0.2s;
    }
    
    .close-button:hover {
      background-color: #f0f0f0;
    }
    
    .close-icon {
      display: block;
      line-height: 1;
    }
    
    .image-preview-content {
      flex: 1;
      display: flex;
      justify-content: center;
      align-items: center;
      padding: 20px;
      background: #f8f9fa;
    }
    
    .preview-image {
      max-width: 100%;
      max-height: 100%;
      object-fit: cover;
      border-radius: 50%;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      width: 300px;
      height: 300px;
    }
    
    .image-preview-actions {
      display: flex;
      justify-content: center;
      padding: 16px;
      border-top: 1px solid #e0e0e0;
    }
    
    .image-preview-actions button {
      background: #6c47c7;
      color: white;
      border: none;
      padding: 8px 16px;
      border-radius: 4px;
      cursor: pointer;
      font-weight: 500;
      transition: background-color 0.2s;
    }
    
    .image-preview-actions button:hover {
      background: #5a3db8;
    }
  `]
})
export class ImagePreviewDialogComponent {
  constructor(
    public dialogRef: MatDialogRef<ImagePreviewDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { imageUrl: string; expertName: string }
  ) {}

  close(): void {
    this.dialogRef.close();
  }

  onImgError(event: any): void {
  event.target.src = 'default-avatar.png';
  }
} 