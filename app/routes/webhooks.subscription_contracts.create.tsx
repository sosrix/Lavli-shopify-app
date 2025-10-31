import type {ActionFunctionArgs} from '@remix-run/node';
import {authenticate} from '~/shopify.server';
import {logger} from '~/utils/logger.server';
import {CustomerSendEmailJob, jobs, TagSubscriptionOrderJob, ExternalWebhookJob} from '~/jobs';
import {CustomerEmailTemplateName} from '~/services/CustomerSendEmailService';
import type {Jobs, Webhooks} from '~/types';
import {FIRST_ORDER_TAGS} from '~/jobs/tags/constants';
import {unauthenticated} from '~/shopify.server';

export const action = async ({request}: ActionFunctionArgs) => {
  // Log that we received ANY request to this webhook endpoint
  console.log('\n📡 WEBHOOK ENDPOINT HIT: subscription_contracts.create');
  console.log(`📅 Time: ${new Date().toISOString()}`);
  console.log(`🔗 URL: ${request.url}`);
  console.log(`📡 Method: ${request.method}`);
  console.log(`🏷️ Headers:`, Object.fromEntries(request.headers.entries()));
  
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

  // Get checkout ID from the origin order if available
  // Note: Shopify's Order object doesn't have a checkoutId field in the Admin API
  // The checkout token is available in REST API as 'checkout_token' but not in GraphQL
  // We'll try to get it from the order's confirmation number or name instead
  let checkoutId: string | null = null;
  let orderNote: string | null = null;
  let customAttributes: any[] = [];
  const {admin_graphql_api_origin_order_id: orderId} = payload;
  
  if (orderId) {
    try {
      const {admin} = await unauthenticated.admin(shop);
      
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
    checkoutId?: string | null;
    orderNote?: string | null;
    customAttributes?: any[];
  }> = {
    shop,
    payload: {
      event: 'subscription-created',
      subscriptionData: payload,
      checkoutId,
      orderNote,
      customAttributes,
    },
  };

  jobs.enqueue(new ExternalWebhookJob(externalWebhookParams));

  return new Response();
  
  } catch (error) {
    console.log('❌ WEBHOOK ERROR:', error);
    console.log('❌ This might be a direct browser access (not from Shopify)');
    logger.error({error}, 'Failed to process subscription_contracts.create webhook');
    
    // Return a helpful error message for direct access
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    if (errorMessage.includes('authenticate') || errorMessage.includes('Invalid') || errorMessage.includes('Missing')) {
      return new Response(JSON.stringify({
        error: 'This is a Shopify webhook endpoint',
        message: 'This endpoint can only be called by Shopify with proper authentication',
        note: 'If you are testing, create a real subscription in your store to trigger this webhook',
        time: new Date().toISOString()
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    return new Response(JSON.stringify({
      error: 'Webhook processing failed',
      message: errorMessage,
      time: new Date().toISOString()
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

function orderIsFromCheckout(orderId: string | null): boolean {
  return orderId !== null;
}
