import type {ActionFunctionArgs} from '@remix-run/node';
import {authenticate} from '~/shopify.server';
import {logger} from '~/utils/logger.server';
import {CustomerSendEmailJob, jobs, TagSubscriptionOrderJob, ExternalWebhookJob} from '~/jobs';
import {CustomerEmailTemplateName} from '~/services/CustomerSendEmailService';
import type {Jobs, Webhooks} from '~/types';
import {FIRST_ORDER_TAGS} from '~/jobs/tags/constants';

export const action = async ({request}: ActionFunctionArgs) => {
  // Log that we received ANY request to this webhook endpoint
  console.log('\n📡 WEBHOOK ENDPOINT HIT: subscription_contracts.create');
  console.log(`📅 Time: ${new Date().toISOString()}`);
  console.log(`🔗 URL: ${request.url}`);
  console.log(`📡 Method: ${request.method}`);
  
  try {
    const {topic, shop, payload} = await authenticate.webhook(request);

    // Log subscription creation with prominent subscription ID
    console.log('\n🎉 NEW SUBSCRIPTION CREATED! 🎉');
    console.log('=================================');
    console.log(`📋 SUBSCRIPTION ID: ${payload.id}`);
    console.log(`🏪 Shop: ${shop}`);
    console.log(`👤 Customer ID: ${payload.customer_id}`);
    console.log(`📦 Origin Order: ${payload.admin_graphql_api_origin_order_id}`);
    console.log(`📅 Created: ${payload.created_at}`);
    console.log(`🔄 Status: ${payload.status}`);
    console.log('=================================\n');

    logger.info({
      topic, 
      shop, 
      subscriptionId: payload.id,
      customerId: payload.customer_id,
      orderId: payload.admin_graphql_api_origin_order_id,
      status: payload.status,
      payload
    }, 'NEW SUBSCRIPTION CREATED - Customer purchase detected');

  const {admin_graphql_api_origin_order_id: orderId} = payload;
  if (orderIsFromCheckout(orderId)) {
    const emailParams: Jobs.Parameters<Webhooks.SubscriptionContractEvent> = {
      shop,
      payload: {
        ...(payload as Webhooks.SubscriptionContractsCreate),
        emailTemplate: CustomerEmailTemplateName.NewSubscription,
      },
    };

    jobs.enqueue(new CustomerSendEmailJob(emailParams));
  }

  const tagParams: Jobs.Parameters<Jobs.TagSubscriptionsOrderPayload> = {
    shop,
    payload: {
      orderId: payload.admin_graphql_api_origin_order_id,
      tags: FIRST_ORDER_TAGS,
    },
  };

  jobs.enqueue(new TagSubscriptionOrderJob(tagParams));

  // Send external webhook notification
  const externalWebhookParams: Jobs.Parameters<{
    event: string;
    subscriptionData: any;
  }> = {
    shop,
    payload: {
      event: 'subscription-created',
      subscriptionData: payload,
    },
  };

  jobs.enqueue(new ExternalWebhookJob(externalWebhookParams));

  return new Response();
  
  } catch (error) {
    console.log('❌ WEBHOOK ERROR:', error);
    logger.error({error}, 'Failed to process subscription_contracts.create webhook');
    return new Response('Webhook processing failed', {status: 500});
  }
};

function orderIsFromCheckout(orderId: string | null): boolean {
  return orderId !== null;
}
