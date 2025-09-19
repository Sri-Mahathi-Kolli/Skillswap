import { HttpRequest, HttpHandlerFn, HttpEvent, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, switchMap } from 'rxjs/operators';
import { inject } from '@angular/core';

export function httpInterceptorFn(
  req: HttpRequest<any>,
  next: HttpHandlerFn
): Observable<HttpEvent<any>> {
  
  // Get token directly from localStorage to avoid circular dependency
  const token = localStorage.getItem('accessToken');
  
  let authReq = req;
  if (token) {
    authReq = req.clone({
      setHeaders: { Authorization: `Bearer ${token}` }
    });
  }
  
  return next(authReq).pipe(
    catchError((error: HttpErrorResponse) => {
      // Only handle 401 errors for API endpoints, not for auth endpoints
      if (error.status === 401 && !req.url.includes('/auth/')) {
        console.log('401 error on API endpoint, attempting token refresh');
        
        // For now, just return the error and let the component handle it
        // We'll implement a proper refresh mechanism without circular dependency
        return throwError(() => error);
      }
      return throwError(() => error);
    })
  );
}
