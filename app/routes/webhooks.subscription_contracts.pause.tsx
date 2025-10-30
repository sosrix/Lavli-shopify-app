import type {ActionFunctionArgs} from '@remix-run/node';
import {authenticate} from '~/shopify.server';
import {logger} from '~/utils/logger.server';
import {ExternalWebhookJob, jobs} from '~/jobs';
import type {Jobs} from '~/types';

export const action = async ({request}: ActionFunctionArgs) => {
  const {topic, shop, payload} = await authenticate.webhook(request);

  logger.info({topic, shop, payload}, 'PAUSE WEBHOOK RECEIVED - Processing subscription pause event');

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
};
