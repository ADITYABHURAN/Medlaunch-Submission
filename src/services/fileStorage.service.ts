import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import { AppError } from '../utils/errors';
import logger from '../utils/logger';

interface StoredFile {
  storageKey: string;
  filename: string;
  path: string;
}

class FileStorageService {
  private uploadDir: string;
  private downloadTokens: Map<string, { storageKey: string; expiresAt: Date }> = new Map();

  constructor() {
    this.uploadDir = process.env.UPLOAD_DIR || './uploads';
    this.ensureUploadDir();
  }

  private ensureUploadDir() {
    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
      logger.info('Created upload directory', { path: this.uploadDir });
    }
  }

  async store(file: Express.Multer.File): Promise<StoredFile> {
    const storageKey = uuidv4();
    const extension = path.extname(file.originalname);
    const filename = `${storageKey}${extension}`;
    const filePath = path.join(this.uploadDir, filename);

    try {
      fs.writeFileSync(filePath, file.buffer);
      
      logger.info('File stored', {
        storageKey,
        filename,
        originalName: file.originalname,
        size: file.size,
      });

      return {
        storageKey,
        filename,
        path: filePath,
      };
    } catch (error: any) {
      logger.error('Failed to store file', {
        error: error.message,
        originalName: file.originalname,
      });
      throw new AppError(500, 'FILE_STORAGE_ERROR', 'Failed to store file');
    }
  }

  async retrieve(storageKey: string): Promise<Buffer> {
    const files = fs.readdirSync(this.uploadDir);
    const file = files.find((f: string) => f.startsWith(storageKey));

    if (!file) {
      throw new AppError(404, 'FILE_NOT_FOUND', 'File not found');
    }

    const filePath = path.join(this.uploadDir, file);
    return fs.readFileSync(filePath);
  }

  async delete(storageKey: string): Promise<void> {
    const files = fs.readdirSync(this.uploadDir);
    const file = files.find((f: string) => f.startsWith(storageKey));

    if (file) {
      const filePath = path.join(this.uploadDir, file);
      fs.unlinkSync(filePath);
      logger.info('File deleted', { storageKey });
    }
  }

  generateDownloadToken(storageKey: string, expiresInMinutes = 60): string {
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + expiresInMinutes * 60 * 1000);

    this.downloadTokens.set(token, { storageKey, expiresAt });

    // Clean up expired tokens
    this.cleanupExpiredTokens();

    logger.info('Download token generated', {
      token,
      storageKey,
      expiresAt: expiresAt.toISOString(),
    });

    return token;
  }

  validateDownloadToken(token: string): string | null {
    const tokenData = this.downloadTokens.get(token);

    if (!tokenData) {
      return null;
    }

    if (tokenData.expiresAt < new Date()) {
      this.downloadTokens.delete(token);
      return null;
    }

    return tokenData.storageKey;
  }

  private cleanupExpiredTokens() {
    const now = new Date();
    for (const [token, data] of this.downloadTokens.entries()) {
      if (data.expiresAt < now) {
        this.downloadTokens.delete(token);
      }
    }
  }

  validateFile(file: Express.Multer.File): void {
    const maxSize = parseInt(process.env.MAX_FILE_SIZE || '5242880', 10); // 5MB default
    
    if (file.size > maxSize) {
      throw new AppError(400, 'FILE_TOO_LARGE', `File size exceeds maximum of ${maxSize} bytes`);
    }

    const allowedMimeTypes = [
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/gif',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/plain',
      'text/csv',
    ];

    if (!allowedMimeTypes.includes(file.mimetype)) {
      throw new AppError(400, 'INVALID_FILE_TYPE', 'File type not allowed');
    }
  }
}

export const fileStorage = new FileStorageService();
