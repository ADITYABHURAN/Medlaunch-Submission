export interface User {
  id: string;
  username: string;
  email: string;
  role: 'reader' | 'editor';
}

export interface JWTPayload {
  userId: string;
  username: string;
  role: 'reader' | 'editor';
  iat?: number;
  exp?: number;
}
