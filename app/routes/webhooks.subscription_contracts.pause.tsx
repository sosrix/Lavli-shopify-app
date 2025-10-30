import type {ActionFunctionArgs} from '@remix-run/node';
import {authenticate} from '~/shopify.server';
import {logger} from '~/utils/logger.server';
import {ExternalWebhookJob, jobs} from '~/jobs';
import type {Jobs} from '~/types';

export const action = async ({request}: ActionFunctionArgs) => {
  // Log that we received ANY request to this webhook endpoint
  console.log('\n📡 PAUSE WEBHOOK ENDPOINT HIT!');
  console.log(`📅 Time: ${new Date().toISOString()}`);
  console.log(`🔗 URL: ${request.url}`);
  console.log(`📡 Method: ${request.method}`);
  console.log(`🏷️ Headers:`, Object.fromEntries(request.headers.entries()));
  
  try {
    const {topic, shop, payload} = await authenticate.webhook(request);

    console.log('\n⏸️ SUBSCRIPTION PAUSED ⏸️');
    console.log('========================');
    console.log(`📋 SUBSCRIPTION ID: ${payload.id}`);
    console.log(`🏪 Shop: ${shop}`);
    console.log(`👤 Customer ID: ${payload.customer_id}`);
    console.log(`📅 Updated: ${payload.updated_at}`);
    console.log('========================\n');

    logger.info({topic, shop, subscriptionId: payload.id, payload}, 'PAUSE WEBHOOK RECEIVED - Processing subscription pause event');

  // Send external webhook notification
  const externalWebhookParams: Jobs.Parameters<{
    event: string;
    subscriptionData: any;
  }> = {
    shop,
    payload: {
      event: 'subscription-paused',
      subscriptionData: payload,
    },
  };

  logger.info({shop, event: 'subscription-paused'}, 'PAUSE WEBHOOK - Enqueueing external webhook job');
  
  jobs.enqueue(new ExternalWebhookJob(externalWebhookParams));

  logger.info('PAUSE WEBHOOK - External webhook job enqueued successfully');

  return new Response();
  
  } catch (error) {
    console.log('❌ PAUSE WEBHOOK ERROR:', error);
    logger.error({error}, 'Failed to process subscription_contracts.pause webhook');
    return new Response('Webhook processing failed', {status: 500});
  }
};
