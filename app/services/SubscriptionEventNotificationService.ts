import {jobs, ExternalWebhookJob} from '~/jobs';
import type {Jobs} from '~/types';
import {logger} from '~/utils/logger.server';

interface SubscriptionEventData {
  subscriptionContractId: string;
  customerId?: string;
  orderId?: string;
  status?: string;
  [key: string]: any;
}

export class SubscriptionEventNotificationService {
  constructor(
    private shop: string,
  ) {}

  async notifySubscriptionCreated(data: SubscriptionEventData, source = 'direct') {
    logger.info(
      {shop: this.shop, subscriptionContractId: data.subscriptionContractId, source},
      'Sending external webhook for subscription created (direct)'
    );

    const externalWebhookParams: Jobs.Parameters<{
      event: string;
      subscriptionData: any;
    }> = {
      shop: this.shop,
      payload: {
        event: 'subscription-created',
        subscriptionData: {
          admin_graphql_api_id: data.subscriptionContractId,
          admin_graphql_api_customer_id: data.customerId,
          admin_graphql_api_origin_order_id: data.orderId,
          status: data.status || 'ACTIVE',
          source: source, // 'direct', 'storefront', 'admin', etc.
          timestamp: new Date().toISOString(),
          ...data,
        },
      },
    };

    jobs.enqueue(new ExternalWebhookJob(externalWebhookParams));
  }

  async notifySubscriptionUpdated(data: SubscriptionEventData, eventType: string, source = 'direct') {
    logger.info(
      {shop: this.shop, subscriptionContractId: data.subscriptionContractId, eventType, source},
      'Sending external webhook for subscription updated (direct)'
    );

    const externalWebhookParams: Jobs.Parameters<{
      event: string;
      subscriptionData: any;
    }> = {
      shop: this.shop,
      payload: {
        event: eventType,
        subscriptionData: {
          admin_graphql_api_id: data.subscriptionContractId,
          admin_graphql_api_customer_id: data.customerId,
          status: data.status,
          source: source,
          timestamp: new Date().toISOString(),
          ...data,
        },
      },
    };

    jobs.enqueue(new ExternalWebhookJob(externalWebhookParams));
  }

  async notifyBillingAttempt(data: SubscriptionEventData, success: boolean, source = 'direct') {
    const eventType = success ? 'subscription-billing-attempt-success' : 'subscription-billing-attempt-failure';
    
    logger.info(
      {shop: this.shop, subscriptionContractId: data.subscriptionContractId, success, source},
      'Sending external webhook for billing attempt (direct)'
    );

    const externalWebhookParams: Jobs.Parameters<{
      event: string;
      subscriptionData: any;
    }> = {
      shop: this.shop,
      payload: {
        event: eventType,
        subscriptionData: {
          admin_graphql_api_id: data.subscriptionContractId,
          admin_graphql_api_customer_id: data.customerId,
          admin_graphql_api_order_id: data.orderId,
          ready: success,
          source: source,
          timestamp: new Date().toISOString(),
          ...data,
        },
      },
    };

    jobs.enqueue(new ExternalWebhookJob(externalWebhookParams));
  }
}