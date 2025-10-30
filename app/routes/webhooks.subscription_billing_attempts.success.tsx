import type {ActionFunctionArgs} from '@remix-run/node';
import {DunningStopJob, jobs, TagSubscriptionOrderJob, ExternalWebhookJob} from '~/jobs';
import {RECURRING_ORDER_TAGS} from '~/jobs/tags/constants';
import {authenticate} from '~/shopify.server';
import type {Jobs, Webhooks} from '~/types';
import {logger} from '~/utils/logger.server';

export const action = async ({request}: ActionFunctionArgs) => {
  const {topic, shop, payload} = await authenticate.webhook(request);

  logger.info({topic, shop, payload}, 'Received webhook');

  jobs.enqueue(
    new DunningStopJob({
      shop,
      payload: payload as Webhooks.SubscriptionBillingAttemptSuccess,
    }),
  );

  jobs.enqueue(
    new TagSubscriptionOrderJob({
      shop,
      payload: {
        orderId: payload.admin_graphql_api_order_id,
        tags: RECURRING_ORDER_TAGS,
      },
    }),
  );

  // Send external webhook notification
  const externalWebhookParams: Jobs.Parameters<{
    event: string;
    subscriptionData: any;
  }> = {
    shop,
    payload: {
      event: 'subscription-billing-attempt-success',
      subscriptionData: payload,
    },
  };

  jobs.enqueue(new ExternalWebhookJob(externalWebhookParams));

  return new Response();
};
