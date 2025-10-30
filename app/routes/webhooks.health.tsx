import type {LoaderFunctionArgs} from '@remix-run/node';
import {json} from '@remix-run/node';

/**
 * Webhook Health Check Endpoint
 * 
 * GET /webhooks/health
 * 
 * This endpoint can be accessed directly to check if webhook routes are working
 * and provides information about webhook configuration.
 */

export const loader = async ({request}: LoaderFunctionArgs) => {
  console.log('\n🏥 WEBHOOK HEALTH CHECK');
  console.log(`📅 Time: ${new Date().toISOString()}`);
  console.log(`🔗 URL: ${request.url}`);
  console.log(`🌍 User Agent: ${request.headers.get('user-agent')}`);

  const webhookEndpoints = [
    '/webhooks/subscription_contracts/create',
    '/webhooks/subscription_contracts/pause',
    '/webhooks/subscription_contracts/cancel',
    '/webhooks/subscription_contracts/activate',
  ];

  return json({
    status: 'healthy',
    message: 'Webhook service is running',
    timestamp: new Date().toISOString(),
    endpoints: webhookEndpoints,
    note: 'These endpoints require Shopify authentication and can only be called by Shopify',
    testInstructions: [
      '1. Create a subscription in your Shopify store',
      '2. Watch your application logs for webhook activity',
      '3. Use the app webhook status checker to verify registration'
    ],
    server: process.env.NODE_ENV || 'development',
    url: request.url
  });
};