import type {LoaderFunctionArgs} from '@remix-run/node';
import {json} from '@remix-run/node';
import {useLoaderData} from '@remix-run/react';
import {
  Page,
  Card,
  Text,
  Badge,
  Button,
} from '@shopify/polaris';
import {authenticate} from '~/shopify.server';
import {logger} from '~/utils/logger.server';

/**
 * Webhook Status Check Route
 * 
 * GET /app/admin/webhook-status
 * 
 * This route checks if webhooks are properly registered with Shopify
 * and displays their current configuration.
 */

export const loader = async ({request}: LoaderFunctionArgs) => {
  try {
    const {admin, session} = await authenticate.admin(request);
    const shop = session.shop;

    logger.info({shop}, 'Checking webhook registration status');

    // Query current webhooks registered with Shopify
    const webhooksQuery = `#graphql
      query getWebhooks {
        webhookSubscriptions(first: 50) {
          edges {
            node {
              id
              callbackUrl
              topic
              format
              createdAt
              updatedAt
            }
          }
        }
      }
    `;

    const response = await admin.graphql(webhooksQuery);
    const data = await response.json() as any;

    if (data.errors) {
      logger.error({shop, errors: data.errors}, 'Failed to fetch webhook subscriptions');
      throw new Error(`GraphQL errors: ${JSON.stringify(data.errors)}`);
    }

    const webhooks = data.data?.webhookSubscriptions?.edges || [];
    
    // Log webhook status to console
    console.log('\n🔍 WEBHOOK REGISTRATION STATUS 🔍');
    console.log('=====================================');
    console.log(`🏪 Shop: ${shop}`);
    console.log(`📊 Total Webhooks: ${webhooks.length}`);
    console.log('=====================================\n');

    webhooks.forEach((edge: any, index: number) => {
      const webhook = edge.node;
      console.log(`--- WEBHOOK ${index + 1} ---`);
      console.log(`ID: ${webhook.id}`);
      console.log(`Topic: ${webhook.topic}`);
      console.log(`URL: ${webhook.callbackUrl}`);
      console.log(`Format: ${webhook.format}`);
      console.log(`Created: ${webhook.createdAt}`);
      console.log(`Updated: ${webhook.updatedAt}`);
      console.log('---\n');
    });

    // Check for subscription-related webhooks
    const subscriptionWebhooks = webhooks.filter((edge: any) => 
      edge.node.topic.includes('SUBSCRIPTION_CONTRACT')
    );

    console.log(`🎯 Subscription Webhooks Found: ${subscriptionWebhooks.length}`);
    if (subscriptionWebhooks.length === 0) {
      console.log('❌ NO SUBSCRIPTION WEBHOOKS REGISTERED!');
      console.log('This explains why subscription creation events are not being received.');
    }

    logger.info({
      shop,
      totalWebhooks: webhooks.length,
      subscriptionWebhooks: subscriptionWebhooks.length,
      webhooks: webhooks.map((edge: any) => ({
        topic: edge.node.topic,
        url: edge.node.callbackUrl,
        id: edge.node.id
      }))
    }, 'Webhook registration status check complete');

    return json({
      success: true,
      shop,
      totalWebhooks: webhooks.length,
      subscriptionWebhooks: subscriptionWebhooks.length,
      webhooks: webhooks.map((edge: any) => edge.node),
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    console.error('ERROR checking webhook status:', error);
    
    logger.error({
      error: errorMessage,
      stack: error instanceof Error ? error.stack : undefined,
    }, 'Failed to check webhook registration status');

    return json({
      success: false,
      error: errorMessage,
      timestamp: new Date().toISOString(),
    }, {status: 500});
  }
};

export default function WebhookStatusPage() {
  const data = useLoaderData<typeof loader>() as any;

  return (
    <Page 
      title="Webhook Registration Status"
      subtitle="Check if webhooks are properly configured with Shopify"
      backAction={{content: 'Back to Contracts', url: '/app'}}
    >
      <Card>
        <div style={{marginBottom: '16px'}}>
          <Card>
            <Text as="p">
              This page shows the current webhook registrations with Shopify. 
              If subscription webhooks are missing, that explains why subscription events aren't being received.
            </Text>
          </Card>
        </div>

        <div style={{marginBottom: '16px'}}>
          <Text variant="headingMd" as="h2">
            Webhook Status
          </Text>
          {data.shop && <Text as="p">Shop: {data.shop}</Text>}
        </div>

        {data.success ? (
          <div>
            <div style={{marginBottom: '16px'}}>
              <Badge tone="success">Status: Connected</Badge>
            </div>
            
            <div style={{marginBottom: '16px'}}>
              <Text as="p">
                <strong>Total Webhooks:</strong> {data.totalWebhooks}
              </Text>
              <Text as="p">
                <strong>Subscription Webhooks:</strong> {data.subscriptionWebhooks}
              </Text>
            </div>
            
            {data.subscriptionWebhooks === 0 && (
              <div style={{marginBottom: '16px'}}>
                <Card>
                  <div style={{
                    padding: '16px', 
                    backgroundColor: '#fef2f2', 
                    border: '1px solid #fecaca', 
                    borderRadius: '8px'
                  }}>
                    <Text as="h3" variant="headingSm">
                      ❌ NO SUBSCRIPTION WEBHOOKS FOUND!
                    </Text>
                    <Text as="p" variant="bodyMd">
                      This explains why subscription creation events are not being received.
                    </Text>
                    <div style={{marginTop: '12px'}}>
                      <Button 
                        variant="primary" 
                        url="/app/admin/register-webhooks-ui"
                      >
                        Register Webhooks Now
                      </Button>
                    </div>
                    <div style={{marginTop: '8px'}}>
                      <Text as="p" variant="bodySm">
                        Solution: Register webhooks manually to fix this issue
                      </Text>
                    </div>
                  </div>
                </Card>
              </div>
            )}

            {data.webhooks && data.webhooks.length > 0 && (
              <div>
                <Text variant="headingSm" as="h3">Registered Webhooks</Text>
                <div style={{marginTop: '8px', backgroundColor: '#f6f6f7', padding: '12px', borderRadius: '6px', fontFamily: 'monospace', fontSize: '12px'}}>
                  {data.webhooks.map((webhook: any, index: number) => (
                    <div key={webhook.id} style={{marginBottom: '8px', borderBottom: '1px solid #e1e3e5', paddingBottom: '8px'}}>
                      <div><strong>{index + 1}. {webhook.topic}</strong></div>
                      <div>URL: {webhook.callbackUrl}</div>
                      <div>Updated: {new Date(webhook.updatedAt).toLocaleString()}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div>
            <div style={{marginBottom: '16px'}}>
              <Badge tone="critical">Error</Badge>
            </div>
            <Text as="p" tone="critical">
              {data.error}
            </Text>
          </div>
        )}
      </Card>
    </Page>
  );
}