import { Router, Request, Response, NextFunction } from 'express';
import { reportService } from '../services/report.service';
import { fileStorage } from '../services/fileStorage.service';
import { CreateReportSchema, UpdateReportSchema, Attachment } from '../models/report.model';
import { authenticate } from '../middleware/auth.middleware';
import { authorize } from '../middleware/authorization.middleware';
import { AppError } from '../utils/errors';
import { v4 as uuidv4 } from 'uuid';
import multer from 'multer';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

router.get(
  '/:id',
  authenticate,
  authorize('reader', 'editor'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const view = req.query.view as string | undefined;
      const include = req.query.include
        ? (req.query.include as string).split(',')
        : undefined;

      const report = await reportService.getReportWithView(id, view, include);
      return res.json(report);
    } catch (error) {
      return next(error);
    }
  }
);

router.put(
  '/:id',
  authenticate,
  authorize('editor'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const validated = UpdateReportSchema.parse(req.body);
      const updated = await reportService.updateReport(
        id,
        validated,
        req.user!.userId,
        req.user!.role
      );
      return res.json(updated);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return next(new AppError(400, 'VALIDATION_ERROR', 'Invalid input', error.errors));
      }
      return next(error);
    }
  }
);

router.post(
  '/',
  authenticate,
  authorize('editor'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const validated = CreateReportSchema.parse(req.body);
      const report = await reportService.createReport(validated, req.user!.userId);
      res.status(201).location(`/reports/${report.id}`).json(report);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        next(new AppError(400, 'VALIDATION_ERROR', 'Invalid input', error.errors));
      } else {
        next(error);
      }
    }
  }
);

router.post(
  '/:id/attachment',
  authenticate,
  authorize('editor'),
  upload.single('file'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;

      if (!req.file) {
        throw new AppError(400, 'NO_FILE', 'No file provided');
      }

      fileStorage.validateFile(req.file);
      const stored = await fileStorage.store(req.file);
      const downloadToken = fileStorage.generateDownloadToken(stored.storageKey, 60);
      const tokenExpiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();

      const attachment: Attachment = {
        id: uuidv4(),
        filename: stored.filename,
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
        size: req.file.size,
        uploadedAt: new Date().toISOString(),
        uploadedBy: req.user!.userId,
        storageKey: stored.storageKey,
        downloadToken,
        tokenExpiresAt,
      };

      await reportService.addAttachment(id, attachment);

      res.status(201).json({
        attachment,
        downloadUrl: `/reports/${id}/attachments/${attachment.id}/download?token=${downloadToken}`,
      });
    } catch (error) {
      next(error);
    }
  }
);

router.get(
  '/:id/attachments/:attachmentId/download',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id, attachmentId } = req.params;
      const token = req.query.token as string;

      if (!token) {
        throw new AppError(401, 'TOKEN_REQUIRED', 'Download token required');
      }

      const storageKey = fileStorage.validateDownloadToken(token);
      if (!storageKey) {
        throw new AppError(401, 'INVALID_TOKEN', 'Invalid or expired download token');
      }

      const report = await reportService.getReportById(id);
      const attachment = report.attachments.find((a: Attachment) => a.id === attachmentId);

      if (!attachment) {
        throw new AppError(404, 'ATTACHMENT_NOT_FOUND', 'Attachment not found');
      }

      if (attachment.storageKey !== storageKey) {
        throw new AppError(403, 'FORBIDDEN', 'Token does not match attachment');
      }

      const fileBuffer = await fileStorage.retrieve(storageKey);

      res.setHeader('Content-Type', attachment.mimeType);
      res.setHeader('Content-Disposition', `attachment; filename="${attachment.originalName}"`);
      res.send(fileBuffer);
    } catch (error) {
      next(error);
    }
  }
);

export default router;
