import cron from 'node-cron';
import ScheduledPostsService from './scheduledPostsService.js';
import logger from '../utils/logger.js';

class CronService {
  constructor() {
    this.jobs = new Map();
  }

  /**
   * Initialize all cron jobs
   */
  init() {
    this.startScheduledPostsJob();
    logger.info('Cron service initialized');
  }

  /**
   * Start the scheduled posts publishing job
   * Runs every minute to check for posts that need to be published
   */
  startScheduledPostsJob() {
    const job = cron.schedule('* * * * *', async () => {
      try {
        logger.debug('Running scheduled posts check...');
        await ScheduledPostsService.publishScheduledPosts();
      } catch (error) {
        logger.error('Error in scheduled posts cron job:', error);
      }
    }, {
      scheduled: true,
      timezone: 'UTC'
    });

    this.jobs.set('scheduledPosts', job);
    logger.info('Scheduled posts cron job started');
  }

  /**
   * Stop all cron jobs
   */
  stop() {
    this.jobs.forEach((job, name) => {
      job.stop();
      logger.info(`Stopped cron job: ${name}`);
    });
    this.jobs.clear();
  }

  /**
   * Stop a specific cron job
   */
  stopJob(jobName) {
    const job = this.jobs.get(jobName);
    if (job) {
      job.stop();
      this.jobs.delete(jobName);
      logger.info(`Stopped cron job: ${jobName}`);
    }
  }

  /**
   * Get status of all cron jobs
   */
  getStatus() {
    const status = {};
    this.jobs.forEach((job, name) => {
      status[name] = {
        running: job.running,
        nextDate: job.nextDate(),
        lastDate: job.lastDate()
      };
    });
    return status;
  }
}

export default new CronService();
