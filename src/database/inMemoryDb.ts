import { Report } from '../models/report.model';
import { AppError } from '../utils/errors';
import { v4 as uuidv4 } from 'uuid';

class InMemoryDatabase {
  private reports: Map<string, Report> = new Map();
  private businessKeyIndex: Map<string, string> = new Map();

  create(report: Omit<Report, 'id' | 'createdAt' | 'updatedAt' | 'version' | 'entries' | 'comments' | 'attachments' | 'auditLog'>): Report {
    const businessKey = this.getBusinessKey(report.title, report.ownerId);
    
    if (this.businessKeyIndex.has(businessKey)) {
      throw new AppError(409, 'DUPLICATE_REPORT', 'A report with this title and owner already exists');
    }

    const now = new Date().toISOString();
    const newReport: Report = {
      ...report,
      id: uuidv4(),
      createdAt: now,
      updatedAt: now,
      version: 1,
      entries: [],
      comments: [],
      attachments: [],
      auditLog: [],
      tags: report.tags || [],
    };

    this.reports.set(newReport.id, newReport);
    this.businessKeyIndex.set(businessKey, newReport.id);

    return newReport;
  }

  getById(id: string): Report | undefined {
    return this.reports.get(id);
  }

  update(id: string, updates: Partial<Report>): Report {
    const existing = this.reports.get(id);
    if (!existing) {
      throw new AppError(404, 'REPORT_NOT_FOUND', 'Report not found');
    }
    if (updates.title || updates.ownerId) {
      const oldBusinessKey = this.getBusinessKey(existing.title, existing.ownerId);
      const newTitle = updates.title || existing.title;
      const newOwnerId = updates.ownerId || existing.ownerId;
      const newBusinessKey = this.getBusinessKey(newTitle, newOwnerId);

      if (oldBusinessKey !== newBusinessKey) {
        if (this.businessKeyIndex.has(newBusinessKey) && this.businessKeyIndex.get(newBusinessKey) !== id) {
          throw new AppError(409, 'DUPLICATE_REPORT', 'A report with this title and owner already exists');
        }
        this.businessKeyIndex.delete(oldBusinessKey);
        this.businessKeyIndex.set(newBusinessKey, id);
      }
    }

    const updated: Report = {
      ...existing,
      ...updates,
      id: existing.id,
      createdAt: existing.createdAt,
      updatedAt: new Date().toISOString(),
      version: existing.version + 1,
    };

    this.reports.set(id, updated);
    return updated;
  }

  delete(id: string): boolean {
    const report = this.reports.get(id);
    if (!report) {
      return false;
    }

    const businessKey = this.getBusinessKey(report.title, report.ownerId);
    this.businessKeyIndex.delete(businessKey);
    return this.reports.delete(id);
  }

  getAll(): Report[] {
    return Array.from(this.reports.values());
  }

  private getBusinessKey(title: string, ownerId: string): string {
    return `${title.toLowerCase()}:${ownerId}`;
  }

  clear(): void {
    this.reports.clear();
    this.businessKeyIndex.clear();
  }
}

export const db = new InMemoryDatabase();
