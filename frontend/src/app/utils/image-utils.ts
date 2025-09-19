// Shared image utility functions for user avatars
import { environment } from '../../environments/environment';

// Track failed images to prevent infinite loops
const failedImages = new Set<string>();

export function getPhotoUrl(photo: string | null | undefined): string {
  if (!photo || photo === 'default-avatar.png') {
    return 'default-avatar.png';
  }

  // If it's already a data URL, return as-is
  if (photo.startsWith('data:image/')) {
    return photo;
  }

  // If it's a long string and does NOT contain a dot (.) and does NOT start with http or /, treat as base64
  if (
    photo.length > 100 &&
    !photo.includes('.') &&
    !photo.startsWith('http') &&
    !photo.startsWith('/') &&
    !photo.startsWith('data:')
  ) {
    return 'data:image/jpeg;base64,' + photo;
  }

  // If already a full URL or known valid path, use as-is
  if (
    photo.startsWith('http') ||
    photo.startsWith('/images') ||
    photo.startsWith('/assets/')
  ) {
    return photo;
  }

  // Otherwise build full URL to backend image
  const apiBase = environment.apiUrl.replace(/\/api$/, '');
  return `${apiBase}/images/${photo}`;
}

export function onImgError(event: Event) {
  const img = event.target as HTMLImageElement;
  const currentSrc = img.src;
  
  // Prevent infinite loops by tracking failed images
  if (failedImages.has(currentSrc)) {
    // This image has already failed, hide it to prevent further attempts
    img.style.display = 'none';
    return;
  }
  
  // Mark this image as failed
  failedImages.add(currentSrc);
  
  // If we're not already trying to load the default avatar, try it
  if (!currentSrc.includes('default-avatar.png')) {
    img.src = 'default-avatar.png';
  } else {
    // Default avatar also failed, hide the image completely
    img.style.display = 'none';
  }
} 