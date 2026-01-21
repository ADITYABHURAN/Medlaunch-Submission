import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import logger from './logger';

declare global {
  namespace Express {
    interface Request {
      id: string;
    }
  }
}

export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
  req.id = uuidv4();
  
  logger.info('Incoming request', {
    requestId: req.id,
    method: req.method,
    path: req.path,
    query: req.query,
    ip: req.ip,
  });

  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info('Request completed', {
      requestId: req.id,
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
    });
  });

  next();
};
