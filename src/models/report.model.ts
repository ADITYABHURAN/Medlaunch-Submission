import { z } from 'zod';

export const EntrySchema = z.object({
  id: z.string(),
  priority: z.enum(['low', 'medium', 'high', 'critical']),
  timestamp: z.string().datetime(),
  value: z.any(),
  status: z.enum(['pending', 'active', 'completed', 'cancelled']),
  notes: z.string().optional(),
});

export const AttachmentSchema = z.object({
  id: z.string(),
  filename: z.string(),
  originalName: z.string(),
  mimeType: z.string(),
  size: z.number(),
  uploadedAt: z.string().datetime(),
  uploadedBy: z.string(),
  storageKey: z.string(),
  downloadToken: z.string().optional(),
  tokenExpiresAt: z.string().datetime().optional(),
});

export const AuditLogEntrySchema = z.object({
  timestamp: z.string().datetime(),
  userId: z.string(),
  action: z.string(),
  before: z.any().optional(),
  after: z.any().optional(),
  metadata: z.record(z.any()).optional(),
});

export const CommentSchema = z.object({
  id: z.string(),
  text: z.string(),
  author: z.string(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime().optional(),
});

export const ReportSchema = z.object({
  id: z.string(),
  title: z.string().min(1).max(200),
  status: z.enum(['draft', 'in_progress', 'under_review', 'finalized', 'archived']),
  ownerId: z.string(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  version: z.number(),
  metadata: z.record(z.any()).optional(),
  entries: z.array(EntrySchema).default([]),
  comments: z.array(CommentSchema).default([]),
  attachments: z.array(AttachmentSchema).default([]),
  auditLog: z.array(AuditLogEntrySchema).default([]),
  tags: z.array(z.string()).default([]),
  description: z.string().optional(),
});

export const CreateReportSchema = z.object({
  title: z.string().min(1).max(200),
  ownerId: z.string(),
  status: z.enum(['draft', 'in_progress', 'under_review', 'finalized', 'archived']).default('draft'),
  description: z.string().optional(),
  metadata: z.record(z.any()).optional(),
  tags: z.array(z.string()).default([]),
});

export const UpdateReportSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  status: z.enum(['draft', 'in_progress', 'under_review', 'finalized', 'archived']).optional(),
  description: z.string().optional(),
  metadata: z.record(z.any()).optional(),
  tags: z.array(z.string()).optional(),
  entries: z.array(EntrySchema).optional(),
  comments: z.array(CommentSchema).optional(),
  force: z.boolean().optional(),
});

export type Entry = z.infer<typeof EntrySchema>;
export type Attachment = z.infer<typeof AttachmentSchema>;
export type AuditLogEntry = z.infer<typeof AuditLogEntrySchema>;
export type Comment = z.infer<typeof CommentSchema>;
export type Report = z.infer<typeof ReportSchema>;
export type CreateReportInput = z.infer<typeof CreateReportSchema>;
export type UpdateReportInput = z.infer<typeof UpdateReportSchema>;
