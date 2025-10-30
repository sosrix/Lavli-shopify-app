import type {ActionFunctionArgs} from '@remix-run/node';
import {DunningStartJob, jobs, ExternalWebhookJob} from '~/jobs';
import {authenticate} from '~/shopify.server';
import type {Jobs, Webhooks} from '~/types';
import {logger} from '~/utils/logger.server';

export const action = async ({request}: ActionFunctionArgs) => {
  const {topic, shop, payload} = await authenticate.webhook(request);

  logger.info({topic, shop, payload}, 'Received webhook');

  jobs.enqueue(
    new DunningStartJob({
      shop,
      payload: payload as Webhooks.SubscriptionBillingAttemptFailure,
    }),
  );

  // Send external webhook notification
  const externalWebhookParams: Jobs.Parameters<{
    event: string;
    subscriptionData: any;
  }> = {
    shop,
    payload: {
      event: 'subscription-billing-attempt-failure',
      subscriptionData: payload,
    },
  };

  jobs.enqueue(new ExternalWebhookJob(externalWebhookParams));

  return new Response();
};
