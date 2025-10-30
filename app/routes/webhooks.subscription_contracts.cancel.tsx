import type {ActionFunctionArgs} from '@remix-run/node';
import {authenticate} from '~/shopify.server';
import {logger} from '~/utils/logger.server';
import {CustomerSendEmailJob, jobs, MerchantSendEmailJob, ExternalWebhookJob} from '~/jobs';
import {CustomerEmailTemplateName} from '~/services/CustomerSendEmailService';
import type {Jobs, Webhooks} from '~/types';

export const action = async ({request}: ActionFunctionArgs) => {
  const {topic, shop, payload} = await authenticate.webhook(request);

  console.log('\n❌ SUBSCRIPTION CANCELLED ❌');
  console.log('============================');
  console.log(`📋 SUBSCRIPTION ID: ${payload.id}`);
  console.log(`🏪 Shop: ${shop}`);
  console.log(`👤 Customer ID: ${payload.customer_id}`);
  console.log(`📅 Updated: ${payload.updated_at}`);
  console.log('============================\n');

  logger.info({topic, shop, subscriptionId: payload.id, payload}, 'CANCEL WEBHOOK RECEIVED - Processing subscription cancellation');

  const emailParams: Jobs.Parameters<Webhooks.SubscriptionContractEvent> = {
    shop,
    payload: {
      ...(payload as Webhooks.SubscriptionContractStatusChange),
      emailTemplate: CustomerEmailTemplateName.SubscriptionCancelled,
    },
  };

  const merchantParams: Jobs.Parameters<Webhooks.SubscriptionContractId> = {
    shop,
    payload: {
      admin_graphql_api_id: payload.admin_graphql_api_id,
    },
  };

  jobs.enqueue(new CustomerSendEmailJob(emailParams));
  jobs.enqueue(new MerchantSendEmailJob(merchantParams));

  // Send external webhook notification
  const externalWebhookParams: Jobs.Parameters<{
    event: string;
    subscriptionData: any;
  }> = {
    shop,
    payload: {
      event: 'subscription-canceled',
      subscriptionData: payload,
    },
  };

  jobs.enqueue(new ExternalWebhookJob(externalWebhookParams));

  return new Response();
};
