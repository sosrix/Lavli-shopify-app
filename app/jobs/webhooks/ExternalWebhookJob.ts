import {Job} from '~/lib/jobs';
import {logger} from '~/utils/logger.server';
import type {Jobs, Webhooks} from '~/types';
import {createHmac} from 'crypto';

interface ExternalWebhookPayload {
  shop: string;
  event: string;
  subscriptionData: any;
  checkoutId?: string | null;
  orderNote?: string | null;
  customAttributes?: any[];
  timestamp: string;
}

export class ExternalWebhookJob extends Job<
  Jobs.Parameters<{
    event: string;
    subscriptionData: any;
    checkoutId?: string | null;
    orderNote?: string | null;
    customAttributes?: any[];
  }>
> {
  public queue: string = 'webhooks';

  async perform(): Promise<void> {
    const {shop, payload} = this.parameters;
    const {event, subscriptionData, checkoutId, orderNote, customAttributes} = payload;

    // Extract and prominently log subscription ID
    const subscriptionId = subscriptionData?.id;
    
    const webhookUrl = 'https://lavli-admin.azurewebsites.net/api/v1/webhooks/subscriptions-app';
    const endpoint = `${webhookUrl}/${event}`;
    
    console.log('\n📤 SENDING EXTERNAL WEBHOOK 📤');
    console.log('===============================');
    console.log(`🆔 SUBSCRIPTION ID: ${subscriptionId}`);
    if (checkoutId) {
      console.log(`🛒 CHECKOUT ID: ${checkoutId}`);
    }
    if (orderNote) {
      console.log(`� ORDER NOTE: ${orderNote}`);
    }
    if (customAttributes && customAttributes.length > 0) {
      console.log(`🏷️ CUSTOM ATTRIBUTES:`, customAttributes);
    }
    console.log(`�📡 Event: ${event}`);
    console.log(`🏪 Shop: ${shop}`);
    console.log(`🎯 Webhook URL: ${endpoint}`);
    console.log('===============================\n');
    
    logger.info({shop, event, subscriptionId, checkoutId, orderNote, customAttributes, subscriptionData}, 'EXTERNAL WEBHOOK JOB - Starting to send external webhook');

    const webhookPayload: ExternalWebhookPayload = {
      shop,
      event,
      subscriptionData,
      checkoutId,
      orderNote,
      customAttributes,
      timestamp: new Date().toISOString(),
    };

    const payloadString = JSON.stringify(webhookPayload);
    
    // Generate HMAC signature for security
    // const webhookSecret = process.env.EXTERNAL_WEBHOOK_SECRET || '';
    const webhookSecret = 'webhook_secret_signature_test';
    const signature = this.generateSignature(payloadString, webhookSecret);

    try {
      logger.info(
        {shop, event, endpoint, payloadSize: payloadString.length},
        'EXTERNAL WEBHOOK JOB - Sending subscription event to external webhook'
      );

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Shopify-Subscriptions-App',
          'X-Shopify-App-Signature': signature,
          'X-Shopify-App-Topic': `subscription_contracts.${event.replace('subscription-', '')}`,
          'X-Shopify-Shop-Domain': shop,
        },
        body: payloadString,
      });

      logger.info(
        {shop, event, endpoint, status: response.status, statusText: response.statusText},
        'EXTERNAL WEBHOOK JOB - Received response from external webhook'
      );

      if (!response.ok) {
        const responseText = await response.text();
        console.log(`❌ WEBHOOK FAILED for Subscription ID: ${subscriptionData?.id} - Status: ${response.status}`);
        
        logger.error(
          {shop, event, subscriptionId: subscriptionData?.id, endpoint, status: response.status, statusText: response.statusText, responseBody: responseText},
          'EXTERNAL WEBHOOK JOB - External webhook failed with error response'
        );
        throw new Error(
          `External webhook failed: ${response.status} ${response.statusText} - ${responseText}`
        );
      }

      console.log(`✅ WEBHOOK SUCCESS for Subscription ID: ${subscriptionData?.id} - Status: ${response.status}`);
      
      logger.info(
        {shop, event, subscriptionId: subscriptionData?.id, endpoint, status: response.status},
        'EXTERNAL WEBHOOK JOB - Successfully sent subscription event to external webhook'
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.log(`❌ WEBHOOK ERROR for Subscription ID: ${subscriptionData?.id} - ${errorMessage}`);
      
      logger.error(
        {shop, event, subscriptionId: subscriptionData?.id, endpoint, error: errorMessage, errorStack: error instanceof Error ? error.stack : undefined},
        'EXTERNAL WEBHOOK JOB - Failed to send subscription event to external webhook'
      );
      throw error;
    }
  }

  private generateSignature(payload: string, secret: string): string {
    return createHmac('sha256', secret)
      .update(payload)
      .digest('base64');
  }
}