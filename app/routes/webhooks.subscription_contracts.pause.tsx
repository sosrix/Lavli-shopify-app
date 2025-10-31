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
    const {topic, shop, payload, admin} = await authenticate.webhook(request);

    console.log('\n⏸️ SUBSCRIPTION PAUSED ⏸️');
    console.log('========================');
    console.log(`📋 SUBSCRIPTION ID: ${payload.id}`);
    console.log(`🏪 Shop: ${shop}`);
    console.log(`👤 Customer ID: ${payload.customer_id}`);
    console.log(`📅 Updated: ${payload.updated_at}`);
    console.log('========================\n');

    logger.info({topic, shop, subscriptionId: payload.id, payload}, 'PAUSE WEBHOOK RECEIVED - Processing subscription pause event');

  // Get checkout ID from the origin order if available
  // Note: Shopify's Order object doesn't have a checkoutId field in the Admin API
  // The checkout token is available in REST API as 'checkout_token' but not in GraphQL
  // We'll try to get it from the order's confirmation number or name instead
  let checkoutId: string | null = null;
  let orderNote: string | null = null;
  let customAttributes: any[] = [];
  const orderId = payload.admin_graphql_api_origin_order_id;
  
  if (orderId && admin) {
    try {
      
      const orderQuery = `#graphql
        query GetOrderDetails($orderId: ID!) {
          order(id: $orderId) {
            id
            name
            confirmationNumber
            note
            customAttributes {
              key
              value
            }
          }
        }
      `;
      
      const response = await admin.graphql(orderQuery, {
        variables: {
          orderId: orderId,
        },
      });
      
      const data = await response.json() as any;
      
      if (data.data?.order) {
        const order = data.data.order;
        // Use confirmation number as checkout identifier if available
        checkoutId = order.confirmationNumber || order.name || null;
        orderNote = order.note || null;
        customAttributes = order.customAttributes || [];
        
        if (checkoutId) {
          console.log(`🛒 Order identifier retrieved: ${checkoutId}`);
          if (orderNote) {
            console.log(`📝 Order note: ${orderNote}`);
          }
          if (customAttributes.length > 0) {
            console.log(`🏷️ Custom attributes:`, customAttributes);
          }
          logger.info({
            checkoutId, 
            orderId, 
            orderName: order.name, 
            orderNote,
            customAttributes
          }, 'Successfully retrieved order details from origin order');
        } else {
          console.log('⚠️ No checkout identifier found in origin order');
          logger.warn({orderId}, 'Origin order exists but has no identifiable checkout information');
        }
      } else {
        console.log('⚠️ Order not found');
        logger.warn({orderId}, 'Origin order not found');
      }
    } catch (error) {
      console.log('❌ Failed to retrieve order details:', error);
      logger.error({error, orderId}, 'Failed to retrieve order details from origin order');
    }
  }

  // Send external webhook notification
  const externalWebhookParams: Jobs.Parameters<{
    event: string;
    subscriptionData: any;
    checkoutId?: string | null;
    orderNote?: string | null;
    customAttributes?: any[];
  }> = {
    shop,
    payload: {
      event: 'subscription-paused',
      subscriptionData: payload,
      checkoutId,
      orderNote,
      customAttributes,
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
