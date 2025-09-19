import { Injectable } from '@angular/core';
import { HttpClient, HttpEvent, HttpEventType } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { environment } from '../../environments/environment';

export interface UploadProgress {                         
  progress: number;
  loaded: number;
  total: number;
}

export interface FileUploadResponse {
  filename: string;
  originalName: string;
  mimetype: string;
  size: number;
  url: string;
}

@Injectable({
  providedIn: 'root'
})
export class FileUploadService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  uploadFile(file: File): Observable<FileUploadResponse> {
    const formData = new FormData();
    formData.append('file', file);

    return this.http.post<FileUploadResponse>(`${this.apiUrl}/upload/file`, formData, {
      reportProgress: true,
      observe: 'events'
    }).pipe(
      map((event: HttpEvent<any>) => {
        switch (event.type) {
          case HttpEventType.UploadProgress:
            const progress = Math.round(100 * event.loaded / (event.total || 0));
            return { progress, loaded: event.loaded, total: event.total || 0 } as UploadProgress;
          case HttpEventType.Response:
            return event.body as FileUploadResponse;
          default:
            return null as any;
        }
      }),
      catchError(error => {
        console.error('File upload error:', error);
        return throwError(() => new Error('File upload failed'));
      })
    );
  }

  // Simple upload method that returns just the final response
  uploadFileSimple(file: File): Observable<FileUploadResponse> {
    const formData = new FormData();
    formData.append('file', file);

    return this.http.post<FileUploadResponse>(`${this.apiUrl}/upload/file`, formData);
  }

  uploadMultipleFiles(files: File[]): Observable<FileUploadResponse[]> {
    const formData = new FormData();
    files.forEach((file, index) => {
      formData.append('files', file);
    });

    return this.http.post<FileUploadResponse[]>(`${this.apiUrl}/upload/files`, formData);
  }

  downloadFile(filename: string, originalName?: string): Observable<Blob> {
    let url = `${this.apiUrl}/files/download/${filename}`;
    if (originalName) {
      url += `?originalName=${encodeURIComponent(originalName)}`;
    }
    return this.http.get(url, {
      responseType: 'blob'
    });
  }

  getFileUrl(filename: string): string {
    return `${this.apiUrl}/files/${filename}`;
  }

  // Helper method to create a download link
  createDownloadLink(filename: string, originalName: string): void {
    console.log('📥 Creating download link for:', filename, 'with original name:', originalName);
    this.downloadFile(filename, originalName).subscribe({
      next: (blob) => {
        console.log('📥 File downloaded successfully, creating download link');
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = originalName;
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
        console.log('📥 Download link created and clicked');
      },
      error: (error) => {
        console.error('❌ Error downloading file:', error);
        // Fallback to direct URL download
        const directUrl = `${this.apiUrl}/files/download/${filename}`;
        console.log('📥 Trying fallback direct URL download:', directUrl);
        const link = document.createElement('a');
        link.href = directUrl;
        link.download = originalName;
        link.target = '_blank';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    });
  }
} 