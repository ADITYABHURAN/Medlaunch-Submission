import express, { Express } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { requestLogger } from './utils/requestLogger';
import { errorHandler } from './middleware/error.middleware';
import authRoutes from './routes/auth.routes';
import reportsRoutes from './routes/reports.routes';
import logger from './utils/logger';

dotenv.config();

const app: Express = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(requestLogger);

app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

app.use('/auth', authRoutes);
app.use('/reports', reportsRoutes);

app.use((req, res) => {
  res.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: 'Endpoint not found',
      path: req.path,
    },
  });
});

app.use(errorHandler);

if (require.main === module) {
  app.listen(PORT, () => {
    logger.info(`Server running on port ${PORT}`);
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

export default app;
