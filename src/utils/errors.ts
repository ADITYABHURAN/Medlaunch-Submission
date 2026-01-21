import { Request, Response } from 'express';

export interface ApiError {
  error: {
    code: string;
    message: string;
    details?: any;
    requestId?: string;
  };
}

export class AppError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
    public details?: any
  ) {
    super(message);
    this.name = 'AppError';
    Error.captureStackTrace(this, this.constructor);
  }
}

export const formatErrorResponse = (
  _statusCode: number,
  code: string,
  message: string,
  requestId?: string,
  details?: any
): ApiError => {
  return {
    error: {
      code,
      message,
      ...(details && { details }),
      ...(requestId && { requestId }),
    },
  };
};

export const handleError = (err: Error, req: Request, res: Response) => {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json(
      formatErrorResponse(err.statusCode, err.code, err.message, req.id, err.details)
    );
  }

  // Default to 500 for unknown errors
  return res.status(500).json(
    formatErrorResponse(500, 'INTERNAL_ERROR', 'An unexpected error occurred', req.id)
  );
};
