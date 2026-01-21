import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { JWTPayload } from '../models/user.model';
import { AppError } from '../utils/errors';

declare global {
  namespace Express {
    interface Request {
      user?: JWTPayload;
    }
  }
}

export const authenticate = (req: Request, _res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AppError(401, 'UNAUTHORIZED', 'Missing or invalid authorization header');
    }

    const token = authHeader.substring(7);
    const secret = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';

    try {
      const decoded = jwt.verify(token, secret) as JWTPayload;
      req.user = decoded;
      next();
    } catch (error) {
      throw new AppError(401, 'INVALID_TOKEN', 'Invalid or expired token');
    }
  } catch (error) {
    next(error);
  }
};
