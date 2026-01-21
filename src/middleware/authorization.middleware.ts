import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/errors';

type Role = 'reader' | 'editor';

export const authorize = (...allowedRoles: Role[]) => {
  return (req: Request, _res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        throw new AppError(401, 'UNAUTHORIZED', 'Authentication required');
      }

      if (!allowedRoles.includes(req.user.role)) {
        throw new AppError(403, 'FORBIDDEN', 'Insufficient permissions');
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};
