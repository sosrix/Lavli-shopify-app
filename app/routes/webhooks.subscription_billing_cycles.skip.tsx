import type {ActionFunctionArgs} from '@remix-run/node';
import {composeGid} from '@shopify/admin-graphql-api-utilities';
import {CustomerSendEmailJob, jobs, ExternalWebhookJob} from '~/jobs';
import {CustomerEmailTemplateName} from '~/services/CustomerSendEmailService';
import {authenticate} from '~/shopify.server';
import type {Jobs, Webhooks} from '~/types';
import {logger} from '~/utils/logger.server';

export const action = async ({request}: ActionFunctionArgs) => {
  const {topic, shop, payload} = await authenticate.webhook(request);

  logger.info({topic, shop, payload}, 'Received webhook');

  const {subscription_contract_id: subContractId, cycle_index} = payload;

  const subscriptionContractGid = composeGid(
    'SubscriptionContract',
    subContractId,
  );
  const params: Jobs.Parameters<Webhooks.SubscriptionContractEvent> = {
    shop,
    payload: {
      admin_graphql_api_id: subscriptionContractGid,
      emailTemplate: CustomerEmailTemplateName.SubscriptionSkipped,
      cycle_index,
    },
  };

  jobs.enqueue(new CustomerSendEmailJob(params));

  // Send external webhook notification
  const externalWebhookParams: Jobs.Parameters<{
    event: string;
    subscriptionData: any;
  }> = {
    shop,
    payload: {
      event: 'subscription-billing-cycle-skipped',
      subscriptionData: {
        ...payload,
        admin_graphql_api_id: subscriptionContractGid,
      },
    },
  };

  jobs.enqueue(new ExternalWebhookJob(externalWebhookParams));

  return new Response();
};
