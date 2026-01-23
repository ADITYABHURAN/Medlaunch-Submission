import { db } from '../database/inMemoryDb';
import {
  Report,
  CreateReportInput,
  UpdateReportInput,
  AuditLogEntry,
  Attachment,
} from '../models/report.model';
import { AppError } from '../utils/errors';
import logger from '../utils/logger';

export class ReportService {
  // Create a new report
  async createReport(input: CreateReportInput, userId: string): Promise<Report> {
    logger.info('Creating report', { input, userId });

    const report = db.create(input);

    // Add audit log entry
    const auditEntry: AuditLogEntry = {
      timestamp: new Date().toISOString(),
      userId,
      action: 'CREATED',
      after: input,
    };

    const updatedReport = db.update(report.id, {
      auditLog: [auditEntry],
    });

    return updatedReport;
  }

  // Get report by ID
  async getReportById(id: string): Promise<Report> {
    const report = db.getById(id);

    if (!report) {
      throw new AppError(404, 'REPORT_NOT_FOUND', 'Report not found');
    }

    return report;
  }

  // Update report with business rules
  async updateReport(
    id: string,
    updates: UpdateReportInput,
    userId: string,
    userRole: 'reader' | 'editor'
  ): Promise<Report> {
    const existing = await this.getReportById(id);

    // Business Rule: FINALIZED status protection
    if (existing.status === 'finalized') {
      if (userRole !== 'editor') {
        throw new AppError(403, 'FORBIDDEN', 'Only editors can modify finalized reports');
      }

      if (!updates.force) {
        throw new AppError(400, 'FORCE_REQUIRED', 'Finalized reports require force=true to edit');
      }

      logger.warn('Forced edit on finalized report', {
        reportId: id,
        userId,
        userRole,
      });
    }

    // Create audit log entry
    const auditEntry: AuditLogEntry = {
      timestamp: new Date().toISOString(),
      userId,
      action: 'UPDATED',
      before: {
        title: existing.title,
        status: existing.status,
        description: existing.description,
      },
      after: updates,
    };

    // Remove force flag from actual updates
    const { force, ...actualUpdates } = updates;

    // Update report with new audit log
    const newAuditLog = [...existing.auditLog, auditEntry];

    const updated = db.update(id, {
      ...actualUpdates,
      auditLog: newAuditLog,
    });

    return updated;
  }

  // Get report with optional filtering
  async getReportWithView(
    id: string,
    view?: string,
    include?: string[]
  ): Promise<any> {
    const report = await this.getReportById(id);

    // Summary view - just basic info
    if (view === 'summary') {
      return {
        id: report.id,
        title: report.title,
        status: report.status,
        ownerId: report.ownerId,
        createdAt: report.createdAt,
        updatedAt: report.updatedAt,
        totalEntries: report.entries.length,
      };
    }

    // If include is specified, return only those fields
    if (include && include.length > 0) {
      const result: any = {
        id: report.id,
        title: report.title,
        status: report.status,
        ownerId: report.ownerId,
        createdAt: report.createdAt,
        updatedAt: report.updatedAt,
        version: report.version,
      };

      if (include.includes('entries')) {
        result.entries = report.entries;
      }
      if (include.includes('comments')) {
        result.comments = report.comments;
      }
      if (include.includes('attachments')) {
        result.attachments = report.attachments;
      }
      if (include.includes('metadata')) {
        result.metadata = report.metadata;
      }
      if (include.includes('tags')) {
        result.tags = report.tags;
      }
      if (include.includes('auditLog')) {
        result.auditLog = report.auditLog;
      }

      return result;
    }

    // Default: return full report
    return report;
  }

  // Add attachment to report
  async addAttachment(reportId: string, attachment: Attachment): Promise<Report> {
    const report = await this.getReportById(reportId);
    
    const updatedAttachments = [...report.attachments, attachment];
    const updated = db.update(reportId, {
      attachments: updatedAttachments,
    });

    return updated;
  }
}

export const reportService = new ReportService();
