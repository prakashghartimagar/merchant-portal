import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import {
  ApplicationDetail,
  ApplicationDraft,
  ApplicationQuery,
  ApplicationSummary,
  DecisionInput,
  HistoryEntry,
  Page,
  SaveResult,
  SensitiveField,
  UserRef,
} from './models';

/** Thin typed wrapper over the REST API. No state lives here. */
@Injectable({ providedIn: 'root' })
export class ApplicationsApi {
  private readonly http = inject(HttpClient);
  private readonly base = '/api/applications';

  list(q: ApplicationQuery): Observable<Page<ApplicationSummary>> {
    let params = new HttpParams()
      .set('page', q.page)
      .set('pageSize', q.pageSize)
      .set('sort', q.sort)
      .set('dir', q.dir);
    if (q.status) params = params.set('status', q.status);
    if (q.search.trim()) params = params.set('search', q.search.trim());
    if (q.unassigned) params = params.set('unassigned', 'true');
    return this.http.get<Page<ApplicationSummary>>(this.base, { params });
  }

  get(id: string): Observable<ApplicationDetail> {
    return this.http.get<ApplicationDetail>(`${this.base}/${id}`);
  }

  /** Unmasked copy; the server only allows this for the creator of a draft. */
  getForEdit(id: string): Observable<ApplicationDetail> {
    return this.http.get<ApplicationDetail>(`${this.base}/${id}/edit`);
  }

  history(id: string): Observable<HistoryEntry[]> {
    return this.http.get<HistoryEntry[]>(`${this.base}/${id}/history`);
  }

  create(draft: ApplicationDraft): Observable<SaveResult> {
    return this.http.post<SaveResult>(this.base, draft);
  }

  saveDraft(id: string, draft: ApplicationDraft): Observable<SaveResult> {
    return this.http.put<SaveResult>(`${this.base}/${id}/draft`, draft);
  }

  submit(id: string): Observable<ApplicationDetail> {
    return this.http.post<ApplicationDetail>(`${this.base}/${id}/submit`, {});
  }

  reveal(id: string, field: SensitiveField): Observable<{ field: SensitiveField; value: string }> {
    return this.http.post<{ field: SensitiveField; value: string }>(`${this.base}/${id}/reveal`, {
      field,
    });
  }

  recordDecision(id: string, input: DecisionInput): Observable<ApplicationDetail> {
    return this.http.post<ApplicationDetail>(`${this.base}/${id}/decisions`, input);
  }

  assign(id: string, reviewerId: string): Observable<ApplicationDetail> {
    return this.http.put<ApplicationDetail>(`${this.base}/${id}/assignment`, { reviewerId });
  }

  reviewers(): Observable<UserRef[]> {
    return this.http.get<UserRef[]>('/api/reviewers');
  }
}
