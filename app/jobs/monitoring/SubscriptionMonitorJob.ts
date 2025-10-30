import {jobs} from '~/jobs';
import {SubscriptionEventNotificationService} from '~/services/SubscriptionEventNotificationService';
import {Job} from '~/lib/jobs';
import {unauthenticated} from '~/shopify.server';
import type {Jobs} from '~/types';

const SUBSCRIPTION_MONITOR_QUERY = `#graphql
  query SubscriptionMonitor($cursor: String) {
    subscriptionContracts(first: 50, after: $cursor, sortKey: CREATED_AT, reverse: true) {
      edges {
        node {
          id
          status
          createdAt
          customer {
            id
          }
          originOrder {
            id
          }
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`;

interface MonitoredSubscription {
  id: string;
  status: string;
  createdAt: string;
  customerId?: string;
  orderId?: string;
}

export class SubscriptionMonitorJob extends Job<
  Jobs.Parameters<{
    lastChecked?: string;
    cursor?: string;
  }>
> {
  public queue: string = 'monitoring';

  async perform(): Promise<void> {
    const {shop, payload} = this.parameters;
    const {lastChecked, cursor} = payload;

    this.logger.info(
      {shop, lastChecked, cursor},
      'Starting subscription monitoring for new subscriptions'
    );

    try {
      const {admin} = await unauthenticated.admin(shop);
      const notificationService = new SubscriptionEventNotificationService(shop);

      const response = await admin.graphql(SUBSCRIPTION_MONITOR_QUERY, {
        variables: {
          cursor: cursor || null,
        },
      });

      const json = await response.json();
      const subscriptionContracts = json.data?.subscriptionContracts;

      if (!subscriptionContracts) {
        this.logger.error({shop, json}, 'Failed to fetch subscription contracts');
        return;
      }

      const newSubscriptions: MonitoredSubscription[] = [];
      const cutoffTime = lastChecked ? new Date(lastChecked) : new Date(Date.now() - 60 * 60 * 1000); // 1 hour ago if no lastChecked

      for (const edge of subscriptionContracts.edges) {
        const subscription = edge.node;
        const createdAt = new Date(subscription.createdAt);

        // Only process subscriptions created after our last check
        if (createdAt > cutoffTime) {
          newSubscriptions.push({
            id: subscription.id,
            status: subscription.status,
            createdAt: subscription.createdAt,
            customerId: subscription.customer?.id,
            orderId: subscription.originOrder?.id,
          });
        }
      }

      this.logger.info(
        {shop, newSubscriptionsCount: newSubscriptions.length},
        'Found new subscriptions to notify'
      );

      // Send webhook notifications for new subscriptions
      for (const subscription of newSubscriptions) {
        await notificationService.notifySubscriptionCreated({
          subscriptionContractId: subscription.id,
          customerId: subscription.customerId,
          orderId: subscription.orderId,
          status: subscription.status,
        }, 'monitoring');
      }

      // Schedule next monitoring run (every 5 minutes)
      const nextRunTime = Math.floor((Date.now() + 5 * 60 * 1000) / 1000);
      jobs.enqueue(
        new SubscriptionMonitorJob({
          shop,
          payload: {
            lastChecked: new Date().toISOString(),
            cursor: subscriptionContracts.pageInfo.hasNextPage ? subscriptionContracts.pageInfo.endCursor : undefined,
          },
        }),
        { 
          scheduleTime: {
            seconds: nextRunTime,
          }
        }
      );

      this.logger.info(
        {shop, nextRun: new Date(nextRunTime * 1000).toISOString()},
        'Scheduled next subscription monitoring run'
      );

    } catch (error) {
      this.logger.error(
        {shop, error: error instanceof Error ? error.message : String(error)},
        'Failed to monitor subscriptions'
      );
      throw error;
    }
  }
}