import { Component, Inject, PLATFORM_ID } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../core/services/auth.service';
import { isPlatformBrowser } from '@angular/common';

@Component({
  selector: 'app-auth',
  standalone: true,
  imports: [FormsModule, CommonModule],
  templateUrl: './auth.component.html',
  styleUrls: ['./auth.component.css']
})
export class AuthComponent {
  isLogin = true;
  isResetPassword = false;
  email = '';
  password = '';
  name = '';
  
  // Reset password fields
  oldPassword = '';
  newPassword = '';
  confirmPassword = '';
  
  // Profile fields for registration
  title = '';
  location = '';
  timezone = '';
  about = '';
  skills: { name: string, level: string }[] = [];
  
  loading = false;
  errorMessage = '';
  public photoFile: File | null = null;
  public photoPreview: string | ArrayBuffer | null = null;
  successMessage = '';

  constructor(
    private authService: AuthService,
    @Inject(PLATFORM_ID) private platformId: Object,
    private router: Router
  ) {
    // If user is already authenticated, redirect to skills page
    if (this.authService.isAuthenticated()) {
      this.router.navigate(['/skills']);
    }
  }

  public onPhotoSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      this.photoFile = input.files[0];
      const reader = new FileReader();
      reader.onload = e => this.photoPreview = reader.result;
      reader.readAsDataURL(this.photoFile);
    }
  }

  addSkill() {
    this.skills.push({ name: '', level: '' });
  }

  removeSkill(index: number) {
    this.skills.splice(index, 1);
  }

  showResetPassword() {
    this.isResetPassword = true;
    this.isLogin = false;
    this.errorMessage = '';
    this.successMessage = '';
  }

  backToLogin() {
    this.isResetPassword = false;
    this.isLogin = true;
    this.errorMessage = '';
    this.successMessage = '';
    this.oldPassword = '';
    this.newPassword = '';
    this.confirmPassword = '';
  }

  onResetPassword() {
    this.loading = true;
    this.errorMessage = '';

    // Validate fields
    if (!this.email || this.email.trim() === '') {
      this.errorMessage = 'Email is required.';
      this.loading = false;
      return;
    }

    if (!this.oldPassword || this.oldPassword.trim() === '') {
      this.errorMessage = 'Current password is required.';
      this.loading = false;
      return;
    }

    if (!this.newPassword || this.newPassword.trim() === '') {
      this.errorMessage = 'New password is required.';
      this.loading = false;
      return;
    }

    if (this.newPassword.length < 6) {
      this.errorMessage = 'New password must be at least 6 characters long.';
      this.loading = false;
      return;
    }

    if (this.newPassword !== this.confirmPassword) {
      this.errorMessage = 'New password and confirm password do not match.';
      this.loading = false;
      return;
    }

    this.authService.resetPassword(this.email, this.oldPassword, this.newPassword)
      .subscribe({
        next: (response) => {
          console.log('Password reset successful:', response);
          this.successMessage = 'Password updated successfully! Please sign in with your new password.';
          this.backToLogin();
          setTimeout(() => {
            this.successMessage = '';
          }, 4000);
        },
        error: (error) => {
          console.error('Password reset failed:', error);
          this.errorMessage = error.error?.message || 'Password reset failed. Please check your current password and try again.';
          this.loading = false;
        },
        complete: () => {
          this.loading = false;
        }
      });
  }

  onSubmit() {
    this.loading = true;
    this.errorMessage = '';

    if (this.isLogin) {
      this.authService.login({ email: this.email, password: this.password })
        .subscribe({
          next: (response) => {
            console.log('Login successful:', response);
            // Retrieve skills from localStorage if available
            let storedSkills: string | null = null;
            if (isPlatformBrowser(this.platformId)) {
              storedSkills = localStorage.getItem('skills');
            }
            if (storedSkills) {
              response.user.skills = JSON.parse(storedSkills);
            }
            // Redirect to skills page after successful login
            this.router.navigate(['/skills']);
            // Optionally, fetch current user to update observable and header
            this.authService.getCurrentUser().subscribe();
          },
          error: (error) => {
            console.error('Login failed:', error);
            this.errorMessage = error.error?.message || 'Login failed. Please try again.';
            this.loading = false;
          },
          complete: () => {
            this.loading = false;
          }
        });
    } else {
      // Validate email is filled
      if (!this.email || this.email.trim() === '') {
        this.errorMessage = 'Email is required.';
        this.loading = false;
        return;
      }
      // Validate location is filled
      if (!this.location || this.location.trim() === '') {
        this.errorMessage = 'Location is required.';
        this.loading = false;
        return;
      }
      // Validate at least one skill is added and all skills have name and level
      if (this.skills.length === 0 || this.skills.some(skill => !skill.name.trim() || !skill.level.trim())) {
        this.errorMessage = 'Please add at least one skill and fill in both name and level for each skill.';
        this.loading = false;
        return;
      }
      const formData = new FormData();
      formData.append('name', this.name);
      formData.append('email', this.email);
      formData.append('password', this.password);
      formData.append('title', this.title);
      formData.append('location', this.location);
      formData.append('timezone', this.timezone);
      formData.append('about', this.about);
      formData.append('skills', JSON.stringify(this.skills));
      if (this.photoFile) {
        formData.append('photo', this.photoFile);
      }

             this.authService.register(formData)
        .subscribe({
          next: (response) => {
            // Store skills in localStorage for profile reflection
            if (isPlatformBrowser(this.platformId)) {
              localStorage.setItem('skills', JSON.stringify(this.skills));
            }
            // Show success toast and redirect to sign in
            this.successMessage = 'Registration successful! Please sign in.';
            this.isLogin = true;
            this.errorMessage = '';
            setTimeout(() => {
              this.successMessage = '';
            }, 4000);
          },
          error: (error) => {
            console.error('Registration failed:', error);
            this.errorMessage = error.error?.message || 'Registration failed. Please try again.';
            this.loading = false;
          },
          complete: () => {
            this.loading = false;
          }
        });
    }
  }
}
