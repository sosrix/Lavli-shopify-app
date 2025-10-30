import {Card, Page, Button, Text, Badge} from '@shopify/polaris';
import {useActionData, useNavigation, Form} from '@remix-run/react';
import type {ActionFunctionArgs} from '@remix-run/node';
import {json} from '@remix-run/node';
import {authenticate} from '~/shopify.server';
import {logger} from '~/utils/logger.server';

/**
 * Manual Webhook Registration Page
 * 
 * This page provides a UI to manually register subscription webhooks with Shopify.
 * Use this if webhooks weren't automatically registered during deployment.
 */

interface WebhookRegistrationResult {
  topic: string;
  success: boolean;
  webhook?: any;
  errors?: any[];
  error?: string;
}

interface ActionData {
  success: boolean;
  shop?: string;
  totalAttempted?: number;
  successCount?: number;
  results?: WebhookRegistrationResult[];
  message?: string;
  error?: string;
  timestamp?: string;
}

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

export default function RegisterWebhooksPage() {
  const actionData = useActionData<ActionData>();
  const navigation = useNavigation();
  const isLoading = navigation.state === 'submitting';

  return (
    <Page
      title="Register Webhooks"
      subtitle="Manually register subscription webhooks with Shopify"
      backAction={{content: 'Back', url: '/app/admin/webhook-status'}}
    >
      <Card>
        <div style={{marginBottom: '16px'}}>
          <Text as="h2" variant="headingMd">
            Manual Webhook Registration
          </Text>
          <div style={{marginTop: '8px'}}>
            <Text as="p" variant="bodyMd">
              This will register the required subscription webhooks with Shopify. 
              Use this if webhooks weren't automatically registered during deployment.
            </Text>
          </div>
        </div>

        {actionData?.error && (
          <div style={{
            padding: '16px', 
            backgroundColor: '#fef2f2', 
            border: '1px solid #fecaca', 
            borderRadius: '8px',
            marginBottom: '16px'
          }}>
            <Text as="h3" variant="headingSm">
              Registration Failed
            </Text>
            <Text as="p" variant="bodyMd">
              {actionData.error}
            </Text>
            {actionData.timestamp && (
              <Text as="p" variant="bodySm">
                Time: {new Date(actionData.timestamp).toLocaleString()}
              </Text>
            )}
          </div>
        )}

        {actionData?.success && (
          <div style={{
            padding: '16px', 
            backgroundColor: '#f0fdf4', 
            border: '1px solid #bbf7d0', 
            borderRadius: '8px',
            marginBottom: '16px'
          }}>
            <Text as="h3" variant="headingSm">
              ✅ Webhook Registration Complete!
            </Text>
            <Text as="p" variant="bodyMd">
              Successfully registered {actionData.successCount} out of {actionData.totalAttempted} webhooks
            </Text>
            <Text as="p" variant="bodySm">
              Shop: {actionData.shop} | Time: {actionData.timestamp ? new Date(actionData.timestamp).toLocaleString() : 'Unknown'}
            </Text>
          </div>
        )}

        {actionData?.results && (
          <Card>
            <Text as="h3" variant="headingSm">Registration Results</Text>
            <div style={{marginTop: '16px'}}>
              {actionData.results.map((result, index) => (
                <div key={index} style={{
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center',
                  padding: '12px',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                  marginBottom: '8px'
                }}>
                  <div>
                    <Text as="h4" variant="bodyMd" fontWeight="semibold">
                      {result.topic}
                    </Text>
                    {result.success && result.webhook && (
                      <Text as="p" variant="bodySm">
                        ID: {result.webhook.id}
                      </Text>
                    )}
                    {!result.success && result.error && (
                      <Text as="p" variant="bodySm">
                        Error: {result.error}
                      </Text>
                    )}
                    {!result.success && result.errors && result.errors.length > 0 && (
                      <div>
                        {result.errors.map((error: any, errorIndex: number) => (
                          <Text key={errorIndex} as="p" variant="bodySm">
                            {error.field ? `${error.field}: ` : ''}{error.message}
                          </Text>
                        ))}
                      </div>
                    )}
                  </div>
                  <Badge tone={result.success ? 'success' : 'critical'}>
                    {result.success ? 'Success' : 'Failed'}
                  </Badge>
                </div>
              ))}
            </div>
          </Card>
        )}

        <div style={{marginTop: '20px', marginBottom: '20px'}}>
          <Form method="POST">
            <Button
              submit
              variant="primary"
              loading={isLoading}
              disabled={isLoading}
            >
              {isLoading ? 'Registering Webhooks...' : 'Register Webhooks'}
            </Button>
          </Form>
        </div>

        <div style={{
          padding: '16px', 
          backgroundColor: '#f9fafb', 
          border: '1px solid #e5e7eb', 
          borderRadius: '8px'
        }}>
          <Text as="h4" variant="bodyMd" fontWeight="bold">
            Webhooks to be registered:
          </Text>
          <div style={{marginTop: '8px'}}>
            <Text as="p" variant="bodySm">• SUBSCRIPTION_CONTRACTS_CREATE</Text>
            <Text as="p" variant="bodySm">• SUBSCRIPTION_CONTRACTS_UPDATE</Text>
            <Text as="p" variant="bodySm">• SUBSCRIPTION_CONTRACTS_CANCEL</Text>
          </div>
          <div style={{marginTop: '8px'}}>
            <Text as="p" variant="bodySm">
              These webhooks will send subscription events to your external API endpoint.
            </Text>
          </div>
        </div>
      </Card>
    </Page>
  );
}