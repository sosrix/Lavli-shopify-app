import type {ActionFunctionArgs} from '@remix-run/node';
import {json} from '@remix-run/node';
import {authenticate} from '~/shopify.server';
import {logger} from '~/utils/logger.server';

/**
 * Manual Webhook Registration Route
 * 
 * POST /app/admin/register-webhooks
 * 
 * This route manually registers the required subscription webhooks with Shopify.
 * Use this if webhooks weren't automatically registered during deployment.
 */

export const action = async ({request}: ActionFunctionArgs) => {
  try {
    const {admin, session} = await authenticate.admin(request);
    const shop = session.shop;

    logger.info({shop}, 'Starting manual webhook registration');

    const webhooksToRegister = [
      {
        topic: 'SUBSCRIPTION_CONTRACTS_CREATE',
        callbackUrl: `${process.env.SHOPIFY_APP_URL}/webhooks/subscription_contracts/create`
      },
      {
        topic: 'SUBSCRIPTION_CONTRACTS_UPDATE', 
        callbackUrl: `${process.env.SHOPIFY_APP_URL}/webhooks/subscription_contracts/pause`
      },
      {
        topic: 'SUBSCRIPTION_CONTRACTS_CANCEL',
        callbackUrl: `${process.env.SHOPIFY_APP_URL}/webhooks/subscription_contracts/cancel`
      }
    ];

    interface WebhookRegistrationResult {
      topic: string;
      success: boolean;
      webhook?: any;
      errors?: any[];
      error?: string;
    }

    const results: WebhookRegistrationResult[] = [];

    for (const webhook of webhooksToRegister) {
      try {
        console.log(`\n📡 Registering webhook: ${webhook.topic}`);
        console.log(`🔗 URL: ${webhook.callbackUrl}`);

        const webhookMutation = `#graphql
          mutation webhookSubscriptionCreate($topic: WebhookSubscriptionTopic!, $webhookSubscription: WebhookSubscriptionInput!) {
            webhookSubscriptionCreate(topic: $topic, webhookSubscription: $webhookSubscription) {
              webhookSubscription {
                id
                callbackUrl
                topic
                format
                createdAt
              }
              userErrors {
                field
                message
              }
            }
          }
        `;

        const response = await admin.graphql(webhookMutation, {
          variables: {
            topic: webhook.topic,
            webhookSubscription: {
              callbackUrl: webhook.callbackUrl,
              format: 'JSON'
            }
          }
        });

        const data = await response.json() as any;

        if (data.data?.webhookSubscriptionCreate?.webhookSubscription) {
          const createdWebhook = data.data.webhookSubscriptionCreate.webhookSubscription;
          console.log(`✅ Successfully registered: ${webhook.topic}`);
          console.log(`📋 ID: ${createdWebhook.id}`);
          
          results.push({
            topic: webhook.topic,
            success: true,
            webhook: createdWebhook
          });
        } else {
          const errors = data.data?.webhookSubscriptionCreate?.userErrors || data.errors || [];
          console.log(`❌ Failed to register: ${webhook.topic}`);
          console.log(`❌ Errors:`, errors);
          
          results.push({
            topic: webhook.topic,
            success: false,
            errors: errors
          });
        }

      } catch (error) {
        console.log(`❌ Error registering ${webhook.topic}:`, error);
        results.push({
          topic: webhook.topic,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    const successCount = results.filter(r => r.success).length;
    
    console.log(`\n🎉 Webhook Registration Complete!`);
    console.log(`✅ Successfully registered: ${successCount}/${webhooksToRegister.length} webhooks`);

    logger.info({
      shop,
      results,
      successCount,
      totalAttempted: webhooksToRegister.length
    }, 'Manual webhook registration completed');

    return json({
      success: true,
      shop,
      totalAttempted: webhooksToRegister.length,
      successCount,
      results,
      message: `Successfully registered ${successCount} webhooks`,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    console.error('ERROR in manual webhook registration:', error);
    
    logger.error({
      error: errorMessage,
      stack: error instanceof Error ? error.stack : undefined,
    }, 'Failed to register webhooks manually');

    return json({
      success: false,
      error: errorMessage,
      timestamp: new Date().toISOString(),
    }, {status: 500});
  }
};