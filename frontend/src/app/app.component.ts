import { Component } from '@angular/core';
import { RouterOutlet, RouterLink, Router } from '@angular/router';
import { AuthService, User } from './core/services/auth.service';
import { Observable } from 'rxjs';
import { CommonModule, AsyncPipe } from '@angular/common';
import { getPhotoUrl, onImgError } from './utils/image-utils';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { ImagePreviewDialogComponent } from './shared/image-preview-dialog.component';
import { NotificationComponent } from './shared/notification.component';


@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, AsyncPipe, RouterOutlet, RouterLink, MatDialogModule, MatButtonModule, NotificationComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent {
  title = 'frontend';
  isNavOpen = false;
  currentYear = new Date().getFullYear();
  user$: Observable<User | null>;
  getPhotoUrl = getPhotoUrl;
  onImgError = onImgError;

  constructor(public authService: AuthService, private router: Router, private dialog: MatDialog) {
    this.user$ = this.authService.currentUser$;
  }

  logout() {
    this.authService.logout();
    this.router.navigate(['/auth']);
  }

  // Method to open image preview dialog
  openImagePreview(imageUrl: string, userName: string, event: Event) {
    event.stopPropagation(); // Prevent event bubbling
    
  if (!imageUrl || imageUrl === 'default-avatar.png') {
      return; // Don't open preview for default images
    }

    this.dialog.open(ImagePreviewDialogComponent, {
      data: {
        imageUrl: imageUrl,
        expertName: userName
      },
      maxWidth: '90vw',
      maxHeight: '90vh',
      width: 'auto',
      height: 'auto',
      panelClass: 'image-preview-dialog'
    });
  }
}
