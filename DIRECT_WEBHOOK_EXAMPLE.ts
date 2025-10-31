// Example: Direct webhook sending (fastest option)
// This would go in your webhook route files instead of using jobs

import type {ActionFunctionArgs} from '@remix-run/node';
import {authenticate} from '~/shopify.server';
import {logger} from '~/utils/logger.server';
import {createHmac} from 'crypto';

async function sendExternalWebhook(shop: string, event: string, subscriptionData: any) {
  const webhookUrl = 'https://lavli-admin.azurewebsites.net/api/v1/webhooks/subscriptions-app';
  const endpoint = `${webhookUrl}/${event}`;

  const webhookPayload = {
    shop,
    event,
    subscriptionData,
    timestamp: new Date().toISOString(),
  };

  const payloadString = JSON.stringify(webhookPayload);
  const webhookSecret = 'webhook_secret_signature_test';
  const signature = createHmac('sha256', webhookSecret)
    .update(payloadString)
    .digest('base64');

  try {
    // Fire and forget - don't await if you want maximum speed
    fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Shopify-Subscriptions-App',
        'X-Shopify-App-Signature': signature,
        'X-Shopify-App-Topic': `subscription_contracts.${event.replace('subscription-', '')}`,
        'X-Shopify-Shop-Domain': shop,
      },
      body: payloadString,
    }).catch(error => {
      logger.error({error, shop, event}, 'Failed to send external webhook');
    });
    
    logger.info({shop, event, endpoint}, 'External webhook sent');
  } catch (error) {
    logger.error({error, shop, event}, 'Failed to send external webhook');
  }
}

export const action = async ({request}: ActionFunctionArgs) => {
  const {topic, shop, payload} = await authenticate.webhook(request);
  
  // Send external webhook immediately (don't await for max speed)
  sendExternalWebhook(shop, 'subscription-created', payload);
  
  // Continue with other processing...
  return new Response();
};