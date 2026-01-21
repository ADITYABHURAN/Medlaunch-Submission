import { Request, Response, NextFunction } from 'express';
import { handleError } from '../utils/errors';
import logger from '../utils/logger';

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
) => {
  logger.error('Error occurred', {
    requestId: req.id,
    error: err.message,
    stack: err.stack,
  });

  handleError(err, req, res);
};
