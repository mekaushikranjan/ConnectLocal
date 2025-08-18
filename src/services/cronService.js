import cron from 'node-cron';
import ScheduledPostsService from './scheduledPostsService.js';


class CronService {
  constructor() {
    this.jobs = new Map();
  }

  /**
   * Initialize all cron jobs
   */
  init() {
    this.startScheduledPostsJob();
  }

  /**
   * Start the scheduled posts publishing job
   * Runs every minute to check for posts that need to be published
   */
  startScheduledPostsJob() {
    const job = cron.schedule('* * * * *', async () => {
      try {
        await ScheduledPostsService.publishScheduledPosts();
      } catch (error) {
        // Error in scheduled posts cron job
      }
    }, {
      scheduled: true,
      timezone: 'UTC'
    });

    this.jobs.set('scheduledPosts', job);
  }

  /**
   * Stop all cron jobs
   */
  stop() {
    this.jobs.forEach((job, name) => {
      job.stop();
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
