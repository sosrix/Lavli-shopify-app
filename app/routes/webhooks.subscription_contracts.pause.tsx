import type {ActionFunctionArgs} from '@remix-run/node';
import {authenticate, unauthenticated} from '~/shopify.server';
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

  // Get checkout ID from the origin order if available
  let checkoutId: string | null = null;
  const orderId = payload.admin_graphql_api_origin_order_id;
  
  if (orderId) {
    try {
      const {admin} = await unauthenticated.admin(shop);
      
      const orderQuery = `#graphql
        query GetOrderCheckout($orderId: ID!) {
          order(id: $orderId) {
            id
            checkoutId
            name
          }
        }
      `;
      
      const response = await admin.graphql(orderQuery, {
        variables: {
          orderId: orderId,
        },
      });
      
      const data = await response.json() as any;
      
      if (data.data?.order?.checkoutId) {
        checkoutId = data.data.order.checkoutId;
        console.log(`🛒 Checkout ID retrieved: ${checkoutId}`);
        logger.info({checkoutId, orderId}, 'Successfully retrieved checkout ID from origin order');
      } else {
        console.log('⚠️ No checkout ID found in origin order');
        logger.warn({orderId}, 'Origin order exists but has no checkout ID');
      }
    } catch (error) {
      console.log('❌ Failed to retrieve checkout ID:', error);
      logger.error({error, orderId}, 'Failed to retrieve checkout ID from origin order');
    }
  }

  // Send external webhook notification
  const externalWebhookParams: Jobs.Parameters<{
    event: string;
    subscriptionData: any;
    checkoutId?: string | null;
  }> = {
    shop,
    payload: {
      event: 'subscription-paused',
      subscriptionData: payload,
      checkoutId,
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
