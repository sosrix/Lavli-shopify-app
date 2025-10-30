import {jobs, SubscriptionMonitorJob} from '~/jobs';
import {logger} from '~/utils/logger.server';
import {config} from 'config';

/**
 * Manual Subscription Monitor Service
 * 
 * Use this to manually trigger subscription monitoring for external webhooks.
 * This is designed to work with INLINE scheduler without creating infinite loops.
 * 
 * Usage:
 * 1. Import this service in your route or service
 * 2. Call triggerSubscriptionMonitoring(shop) when you want to check for new subscriptions
 * 3. For production with CLOUD_TASKS scheduler, the auto-scheduling will work normally
 */
export class ManualSubscriptionMonitorService {
  private static runningShops = new Set<string>();

  /**
   * Trigger a one-time subscription monitoring check for a specific shop
   */
  static async triggerSubscriptionMonitoring(shop: string): Promise<void> {
    // Prevent duplicate runs for the same shop
    if (this.runningShops.has(shop)) {
      logger.info({shop}, 'Subscription monitoring already running for this shop');
      return;
    }

    this.runningShops.add(shop);

    try {
      logger.info({shop, scheduler: config.jobs.scheduler}, 'Manually triggering subscription monitoring');

      await jobs.enqueue(
        new SubscriptionMonitorJob({
          shop,
          payload: {
            lastChecked: new Date(Date.now() - 15 * 60 * 1000).toISOString(), // Check last 15 minutes
          },
        })
      );

      logger.info({shop}, 'Subscription monitoring job queued successfully');
    } catch (error) {
      logger.error(
        {shop, error: error instanceof Error ? error.message : String(error)},
        'Failed to trigger subscription monitoring'
      );
      throw error;
    } finally {
      // Remove shop from running set after a delay to prevent rapid re-triggering
      setTimeout(() => {
        this.runningShops.delete(shop);
      }, 60 * 1000); // 1 minute cooldown
    }
  }

  /**
   * Trigger monitoring for all shops (use with caution)
   */
  static async triggerForAllShops(shops: string[]): Promise<void> {
    logger.info({shopCount: shops.length}, 'Triggering subscription monitoring for all shops');

    const promises = shops.map(shop => this.triggerSubscriptionMonitoring(shop));
    const results = await Promise.allSettled(promises);

    const successful = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;

    logger.info({successful, failed, total: shops.length}, 'Completed subscription monitoring for all shops');
  }

  /**
   * Check if monitoring is currently running for a shop
   */
  static isRunning(shop: string): boolean {
    return this.runningShops.has(shop);
  }

  /**
   * Get list of shops currently being monitored
   */
  static getRunningShops(): string[] {
    return Array.from(this.runningShops);
  }
}