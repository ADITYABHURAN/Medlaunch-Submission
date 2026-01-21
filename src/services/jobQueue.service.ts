import logger from '../utils/logger';

interface Job {
  id: string;
  type: string;
  payload: any;
  retries: number;
  maxRetries: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  createdAt: string;
  processedAt?: string;
  error?: string;
}

class JobQueue {
  private jobs: Map<string, Job> = new Map();
  private processing = false;

  async enqueue(type: string, payload: any, maxRetries = 3): Promise<string> {
    const jobId = `job-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const job: Job = {
      id: jobId,
      type,
      payload,
      retries: 0,
      maxRetries,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };

    this.jobs.set(jobId, job);
    
    logger.info('Job enqueued', {
      jobId,
      type,
      payload,
    });

    // Start processing if not already running
    if (!this.processing) {
      this.processQueue();
    }

    return jobId;
  }

  private async processQueue() {
    this.processing = true;

    while (true) {
      const pendingJob = Array.from(this.jobs.values()).find(
        (job) => job.status === 'pending' || (job.status === 'failed' && job.retries < job.maxRetries)
      );

      if (!pendingJob) {
        this.processing = false;
        break;
      }

      await this.processJob(pendingJob);
    }
  }

  private async processJob(job: Job) {
    job.status = 'processing';
    
    logger.info('Processing job', {
      jobId: job.id,
      type: job.type,
      attempt: job.retries + 1,
    });

    try {
      // Simulate async work
      await this.executeJob(job);
      
      job.status = 'completed';
      job.processedAt = new Date().toISOString();
      
      logger.info('Job completed', {
        jobId: job.id,
        type: job.type,
      });
    } catch (error: any) {
      job.retries++;
      
      if (job.retries >= job.maxRetries) {
        job.status = 'failed';
        job.error = error.message;
        
        logger.error('Job failed permanently', {
          jobId: job.id,
          type: job.type,
          error: error.message,
          retries: job.retries,
        });
      } else {
        job.status = 'pending';
        
        logger.warn('Job failed, will retry', {
          jobId: job.id,
          type: job.type,
          error: error.message,
          retries: job.retries,
          maxRetries: job.maxRetries,
        });
      }
    }
  }

  private async executeJob(job: Job): Promise<void> {
    // Simulate processing time
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Mock implementation based on job type
    switch (job.type) {
      case 'report-created':
        logger.info('Executing report-created job', { reportId: job.payload.reportId });
        // Simulate sending notification, updating analytics, etc.
        break;
      
      case 'report-updated':
        logger.info('Executing report-updated job', { reportId: job.payload.reportId });
        break;
      
      case 'attachment-uploaded':
        logger.info('Executing attachment-uploaded job', { 
          reportId: job.payload.reportId,
          attachmentId: job.payload.attachmentId,
        });
        // Simulate virus scanning, thumbnail generation, etc.
        break;
      
      default:
        logger.warn('Unknown job type', { type: job.type });
    }

    // Simulate random failures for testing retry logic (10% failure rate)
    if (Math.random() < 0.1) {
      throw new Error('Simulated job failure');
    }
  }

  getJob(jobId: string): Job | undefined {
    return this.jobs.get(jobId);
  }

  getAllJobs(): Job[] {
    return Array.from(this.jobs.values());
  }
}

export const jobQueue = new JobQueue();
