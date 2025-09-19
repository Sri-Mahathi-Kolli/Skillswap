import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface Skill {
  id: string;
  name: string;
  category: string;
  description: string;
  rating: number;
  price: number;
  tags: string[];
  mentor: {
    id: string;
    name: string;
    email: string;
    avatar: string;
    sessionRates: {
      thirtyMin: number;
      sixtyMin: number;
      ninetyMin: number;
    };
    stripeEnabled: boolean;
    currency: string;
  };
}

export interface SkillCategory {
  id: string;
  name: string;
  count: number;
}

export interface SkillSearchParams {
  search?: string;
  category?: string;
  level?: string;
  minPrice?: number;
  maxPrice?: number;
}

@Injectable({
  providedIn: 'root'
})
export class SkillsService {
  private apiUrl = 'http://localhost:3000/api';

  constructor(private http: HttpClient) {}

  getSkills(params?: SkillSearchParams): Observable<Skill[]> {
    let url = `${this.apiUrl}/skills`;
    if (params) {
      const queryParams = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        if (value) queryParams.append(key, value.toString());
      });
      url += `?${queryParams.toString()}`;
    }
    return this.http.get<Skill[]>(url);
  }

  getSkillById(id: string): Observable<Skill> {
    return this.http.get<Skill>(`${this.apiUrl}/skills/${id}`);
  }

  getCategories(): Observable<SkillCategory[]> {
    return this.http.get<SkillCategory[]>(`${this.apiUrl}/skills/categories`);
  }

  getPopularSkills(): Observable<string[]> {
    return this.http.get<string[]>(`${this.apiUrl}/skills/popular`);
  }

  connectWithExpert(skillId: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/skills/${skillId}/connect`, {});
  }

  messageExpert(skillId: string, message: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/skills/${skillId}/message`, { message });
  }

  addSkill(skillData: Partial<Skill>): Observable<Skill> {
    return this.http.post<Skill>(`${this.apiUrl}/skills`, skillData);
  }

  updateSkill(id: string, skillData: Partial<Skill>): Observable<Skill> {
    return this.http.put<Skill>(`${this.apiUrl}/skills/${id}`, skillData);
  }

  deleteSkill(id: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/skills/${id}`);
  }

  updateUserSkill(skillId: string, skillData: any): Observable<any> {
    return this.http.put(`${this.apiUrl}/users/me/skills/${skillId}`, skillData);
  }

  deleteUserSkill(skillId: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/users/me/skills/${skillId}`);
  }
} 