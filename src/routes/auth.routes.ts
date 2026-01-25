import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { JWTPayload } from '../models/user.model';

const router = Router();

router.post('/token', (req: Request, res: Response) => {
  const { username, role } = req.body;

  if (!username || !role) {
    return res.status(400).json({
      error: {
        code: 'INVALID_INPUT',
        message: 'Username and role are required',
      },
    });
  }

  if (role !== 'reader' && role !== 'editor') {
    return res.status(400).json({
      error: {
        code: 'INVALID_ROLE',
        message: 'Role must be either "reader" or "editor"',
      },
    });
  }

  const payload: JWTPayload = {
    userId: `user-${Date.now()}`,
    username,
    role,
  };

  const secret = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';
  const token = jwt.sign(payload, secret, { expiresIn: '24h' });

  return res.json({
    token,
    expiresIn: '24h',
    user: payload,
  });
});

export default router;
