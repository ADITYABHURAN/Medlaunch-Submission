import { db } from '../database/inMemoryDb';
import {
  Report,
  CreateReportInput,
  UpdateReportInput,
  ComputedReportFields,
  Entry,
  AuditLogEntry,
  Attachment,
} from '../models/report.model';
import { AppError } from '../utils/errors';
import { jobQueue } from './jobQueue.service';
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

    // Trigger async job
    await jobQueue.enqueue('report-created', {
      reportId: updatedReport.id,
      userId,
      title: updatedReport.title,
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
    userRole: 'reader' | 'editor',
    version?: number,
    idempotencyKey?: string
  ): Promise<Report> {
    const existing = await this.getReportById(id);

    // Optimistic concurrency control
    if (version !== undefined && existing.version !== version) {
      throw new AppError(409, 'VERSION_CONFLICT', 'Report has been modified by another user', {
        currentVersion: existing.version,
        providedVersion: version,
      });
    }

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

    // Prepare audit log entry
    const auditEntry: AuditLogEntry = {
      timestamp: new Date().toISOString(),
      userId,
      action: 'UPDATED',
      before: {
        title: existing.title,
        status: existing.status,
        description: existing.description,
        metadata: existing.metadata,
        tags: existing.tags,
      },
      after: updates,
      metadata: {
        forced: updates.force || false,
        idempotencyKey,
      },
    };

    // Remove force flag from actual updates
    const { force, ...actualUpdates } = updates;

    // Append audit log
    const newAuditLog = [...existing.auditLog, auditEntry];

    const updated = db.update(id, {
      ...actualUpdates,
      auditLog: newAuditLog,
    });

    // Trigger async job
    await jobQueue.enqueue('report-updated', {
      reportId: updated.id,
      userId,
      changes: actualUpdates,
    });

    return updated;
  }

  // Get report with view options
  async getReportWithView(
    id: string,
    view?: string,
    include?: string[],
    entriesPage?: number,
    entriesSize?: number,
    sortBy?: string,
    filterPriority?: string
  ): Promise<any> {
    const report = await this.getReportById(id);

    // Summary view
    if (view === 'summary') {
      return {
        id: report.id,
        title: report.title,
        status: report.status,
        ownerId: report.ownerId,
        createdAt: report.createdAt,
        updatedAt: report.updatedAt,
        ...this.computeFields(report),
      };
    }

    // Process includes
    let result: any = { ...report };

    if (include && include.length > 0) {
      // Start with base fields
      result = {
        id: report.id,
        title: report.title,
        status: report.status,
        ownerId: report.ownerId,
        createdAt: report.createdAt,
        updatedAt: report.updatedAt,
        version: report.version,
      };

      // Add requested fields
      if (include.includes('entries')) {
        result.entries = this.filterAndPaginateEntries(
          report.entries,
          entriesPage,
          entriesSize,
          sortBy,
          filterPriority
        );
      }

      if (include.includes('metrics')) {
        result.metrics = this.computeFields(report);
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
    } else {
      // Default: full report with paginated entries
      result.entries = this.filterAndPaginateEntries(
        report.entries,
        entriesPage,
        entriesSize,
        sortBy,
        filterPriority
      );
    }

    return result;
  }

  // Compute derived fields
  private computeFields(report: Report): ComputedReportFields {
    const totalEntries = report.entries.length;
    const completedEntries = report.entries.filter((e: Entry) => e.status === 'completed').length;
    
    // Recent activity: entries from last 7 days
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const recentActivityCount = report.entries.filter(
      (e: Entry) => new Date(e.timestamp) > sevenDaysAgo
    ).length;

    const highPriorityCount = report.entries.filter(
      (e: Entry) => e.priority === 'high' || e.priority === 'critical'
    ).length;

    // Average completion time (mock calculation)
    const completedEntriesWithTime = report.entries.filter((e: Entry) => e.status === 'completed');
    let averageCompletionTime: number | undefined;
    
    if (completedEntriesWithTime.length > 0) {
      // Mock: 24 hours average for all completed entries
      averageCompletionTime = 24;
    }

    return {
      totalEntries,
      completedEntries,
      recentActivityCount,
      highPriorityCount,
      averageCompletionTime,
    };
  }

  // Filter and paginate entries
  private filterAndPaginateEntries(
    entries: Entry[],
    page?: number,
    size?: number,
    sortBy?: string,
    filterPriority?: string
  ): any {
    let filtered = [...entries];

    // Filter by priority
    if (filterPriority) {
      filtered = filtered.filter((e: Entry) => e.priority === filterPriority);
    }

    // Sort
    if (sortBy === 'priority') {
      const priorityOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
      filtered.sort((a: Entry, b: Entry) => priorityOrder[a.priority] - priorityOrder[b.priority]);
    } else if (sortBy === 'recency' || sortBy === 'timestamp') {
      filtered.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    }

    // Paginate
    if (page !== undefined && size !== undefined) {
      const start = page * size;
      const end = start + size;
      const paginatedEntries = filtered.slice(start, end);

      return {
        data: paginatedEntries,
        pagination: {
          page,
          size,
          total: filtered.length,
          totalPages: Math.ceil(filtered.length / size),
        },
      };
    }

    return filtered;
  }

  // Add attachment to report
  async addAttachment(reportId: string, attachment: Attachment): Promise<Report> {
    const report = await this.getReportById(reportId);
    
    const updatedAttachments = [...report.attachments, attachment];
    const updated = db.update(reportId, {
      attachments: updatedAttachments,
    });

    // Trigger async job
    await jobQueue.enqueue('attachment-uploaded', {
      reportId: updated.id,
      attachmentId: attachment.id,
    });

    return updated;
  }
}

export const reportService = new ReportService();
