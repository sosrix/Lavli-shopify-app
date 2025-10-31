import {describe, expect, it} from 'vitest';
import {ExternalWebhookJob} from '../ExternalWebhookJob';



const TEST_ENABLED = process.env.TEST_WEBHOOK_ENABLED === 'true';
const TEST_WEBHOOK_URL = process.env.TEST_WEBHOOK_URL || 'https://lavli-admin.azurewebsites.net/api/v1/webhooks/subscriptions-app';

describe.skipIf(!TEST_ENABLED)('ExternalWebhookJob Integration Tests', () => {
  const mockShop = 'test-shop.myshopify.com';
  const mockEventData = {
    admin_graphql_api_id: 'gid://shopify/SubscriptionContract/123',
    status: 'ACTIVE',
    test: true, // Mark as test data
  };

  it('sends a real webhook request successfully', async () => {
    // Temporarily override the webhook URL for testing
    const originalFetch = global.fetch;
    
    const job = new ExternalWebhookJob({
      shop: mockShop,
      payload: {
        event: 'subscription-created',
        subscriptionData: mockEventData,
      },
    });

    // This will make a real HTTP request
    await expect(job.perform()).resolves.not.toThrow();
    
    // Restore original fetch
    global.fetch = originalFetch;
  }, 10000); // 10 second timeout for network request

  it('handles real network errors gracefully', async () => {
    // Test with an invalid URL to simulate network failure
    const job = new ExternalWebhookJob({
      shop: mockShop,
      payload: {
        event: 'subscription-created',
        subscriptionData: mockEventData,
      },
    });

    // Override the URL in the job to point to invalid endpoint
    const originalPerform = job.perform;
    job.perform = async function() {
      const webhookUrl = 'https://invalid-url-that-does-not-exist.com/webhook';
      const endpoint = `${webhookUrl}/subscription-created`;
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Shopify-Subscriptions-App',
        },
        body: JSON.stringify({
          shop: mockShop,
          event: 'subscription-created',
          subscriptionData: mockEventData,
          timestamp: new Date().toISOString(),
        }),
      });

      if (!response.ok) {
        throw new Error(`External webhook failed: ${response.status} ${response.statusText}`);
      }
    };

    await expect(job.perform()).rejects.toThrow();
  }, 10000);
});