import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class ComponentIsolationService {
  
  private componentErrors: Map<string, any> = new Map();
  private componentStatus: Map<string, boolean> = new Map();
  
  // Track component errors
  reportComponentError(componentName: string, error: any): void {
    console.warn(`🚨 Component Error in ${componentName}:`, error);
    this.componentErrors.set(componentName, error);
    this.componentStatus.set(componentName, false);
  }
  
  // Check if a component is healthy
  isComponentHealthy(componentName: string): boolean {
    return this.componentStatus.get(componentName) !== false;
  }
  
  // Clear component errors
  clearComponentError(componentName: string): void {
    this.componentErrors.delete(componentName);
    this.componentStatus.set(componentName, true);
  }
  
  // Get all component errors
  getComponentErrors(): Map<string, any> {
    return new Map(this.componentErrors);
  }
  
  // Reset all component statuses
  resetAllComponents(): void {
    this.componentErrors.clear();
    this.componentStatus.clear();
  }
  
  // Safe execution wrapper
  safeExecute<T>(componentName: string, operation: () => T, fallback?: T): T | undefined {
    try {
      const result = operation();
      this.componentStatus.set(componentName, true);
      return result;
    } catch (error) {
      this.reportComponentError(componentName, error);
      return fallback;
    }
  }
} 