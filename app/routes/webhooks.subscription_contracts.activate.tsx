import type {ActionFunctionArgs} from '@remix-run/node';
import {authenticate} from '~/shopify.server';
import {logger} from '~/utils/logger.server';
import {ExternalWebhookJob, jobs} from '~/jobs';
import type {Jobs} from '~/types';

export const action = async ({request}: ActionFunctionArgs) => {
  const {topic, shop, payload} = await authenticate.webhook(request);

  console.log('\n▶️ SUBSCRIPTION RESUMED ▶️');
  console.log('=========================');
  console.log(`📋 SUBSCRIPTION ID: ${payload.id}`);
  console.log(`🏪 Shop: ${shop}`);
  console.log(`👤 Customer ID: ${payload.customer_id}`);
  console.log(`📅 Updated: ${payload.updated_at}`);
  console.log('=========================\n');

  logger.info({topic, shop, subscriptionId: payload.id, payload}, 'ACTIVATE WEBHOOK RECEIVED - Processing subscription resumption');

  // Send external webhook notification
  const externalWebhookParams: Jobs.Parameters<{
    event: string;
    subscriptionData: any;
  }> = {
    shop,
    payload: {
      event: 'subscription-resumed',
      subscriptionData: payload,
    },
  };

  jobs.enqueue(new ExternalWebhookJob(externalWebhookParams));

  return new Response();
};
