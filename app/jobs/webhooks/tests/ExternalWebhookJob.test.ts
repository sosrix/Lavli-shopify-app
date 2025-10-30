import {describe, expect, it, vi, beforeEach, afterEach} from 'vitest';
import {ExternalWebhookJob} from '../ExternalWebhookJob';
import {createHmac} from 'crypto';

// Option 1: Mock fetch (current approach - recommended for unit tests)
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Option 2: Integration test approach (uncomment to use real HTTP calls)
// Note: This would require a test webhook endpoint or environment variable
// const TEST_WEBHOOK_URL = process.env.TEST_WEBHOOK_URL || 'http://localhost:3001/test-webhook';

// Mock environment variable
const mockSecret = 'test-webhook-secret';
vi.stubEnv('EXTERNAL_WEBHOOK_SECRET', mockSecret);

describe('ExternalWebhookJob', () => {
  const mockShop = 'test-shop.myshopify.com';
  const mockEventData = {
    admin_graphql_api_id: 'gid://shopify/SubscriptionContract/123',
    status: 'ACTIVE',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('sends a successful webhook request with signature', async () => {
    const mockResponse = {
      ok: true,
      status: 200,
      statusText: 'OK',
    };
    mockFetch.mockResolvedValue(mockResponse);

    const job = new ExternalWebhookJob({
      shop: mockShop,
      payload: {
        event: 'subscription-created',
        subscriptionData: mockEventData,
      },
    });

    await job.perform();

    expect(mockFetch).toHaveBeenCalledOnce();
    
    const callArgs = mockFetch.mock.calls[0];
    const [url, options] = callArgs;
    
    expect(url).toBe('https://lhd0tgz8-3000.uks1.devtunnels.ms/api/v1/webhooks/subscriptions-app/subscription-created');
    expect(options.method).toBe('POST');
    expect(options.headers['Content-Type']).toBe('application/json');
    expect(options.headers['User-Agent']).toBe('Shopify-Subscriptions-App');
    expect(options.headers['X-Shopify-App-Topic']).toBe('subscription_contracts.created');
    expect(options.headers['X-Shopify-Shop-Domain']).toBe(mockShop);
    expect(options.headers['X-Shopify-App-Signature']).toBeDefined();
    
    // Verify the signature is correct
    const expectedSignature = createHmac('sha256', mockSecret)
      .update(options.body)
      .digest('base64');
    expect(options.headers['X-Shopify-App-Signature']).toBe(expectedSignature);
    
    // Verify the body structure
    const bodyData = JSON.parse(options.body);
    expect(bodyData).toEqual({
      shop: mockShop,
      event: 'subscription-created',
      subscriptionData: mockEventData,
      timestamp: expect.any(String),
    });
  });

  it('throws an error when the webhook request fails', async () => {
    const mockResponse = {
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
    };
    mockFetch.mockResolvedValue(mockResponse);

    const job = new ExternalWebhookJob({
      shop: mockShop,
      payload: {
        event: 'subscription-created',
        subscriptionData: mockEventData,
      },
    });

    await expect(job.perform()).rejects.toThrow(
      'External webhook failed: 500 Internal Server Error'
    );
  });

  it('throws an error when fetch throws an exception', async () => {
    const errorMessage = 'Network error';
    mockFetch.mockRejectedValue(new Error(errorMessage));

    const job = new ExternalWebhookJob({
      shop: mockShop,
      payload: {
        event: 'subscription-created',
        subscriptionData: mockEventData,
      },
    });

    await expect(job.perform()).rejects.toThrow(errorMessage);
  });

  it('handles different event types correctly', async () => {
    const mockResponse = {
      ok: true,
      status: 200,
      statusText: 'OK',
    };
    mockFetch.mockResolvedValue(mockResponse);

    const events = [
      'subscription-created',
      'subscription-canceled',
      'subscription-paused',
      'subscription-resumed',
      'subscription-billing-cycle-skipped',
      'subscription-billing-attempt-success',
      'subscription-billing-attempt-failure',
    ];

    for (const event of events) {
      const job = new ExternalWebhookJob({
        shop: mockShop,
        payload: {
          event,
          subscriptionData: mockEventData,
        },
      });

      await job.perform();

      expect(mockFetch).toHaveBeenCalledWith(
        `https://lhd0tgz8-3000.uks1.devtunnels.ms/api/v1/webhooks/subscriptions-app/${event}`,
        expect.any(Object)
      );
    }

    expect(mockFetch).toHaveBeenCalledTimes(events.length);
  });
});