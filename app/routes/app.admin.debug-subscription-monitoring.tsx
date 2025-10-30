import type {ActionFunctionArgs} from '@remix-run/node';
import {json} from '@remix-run/node';
import {authenticate} from '~/shopify.server';
import {SubscriptionMonitorJob} from '~/jobs/monitoring/SubscriptionMonitorJob';
import {jobs} from '~/jobs';
import {logger} from '~/utils/logger.server';

/**
 * Debug Subscription Monitoring Route
 * 
 * POST /app/admin/debug-subscription-monitoring
 * 
 * This route triggers subscription monitoring and shows detailed results
 * for debugging why customer subscriptions aren't being detected.
 */

export const action = async ({request}: ActionFunctionArgs) => {
  try {
    const {session} = await authenticate.admin(request);
    const shop = session.shop;

    logger.info({shop}, 'Debug subscription monitoring triggered');

    // Get the current time and some time ago for testing
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    // Trigger monitoring with different time ranges
    const results: {
      shop: string;
      timestamp: string;
      tests: Array<{
        name: string;
        timeRange?: string;
        status: string;
        error?: string;
      }>;
    } = {
      shop,
      timestamp: now.toISOString(),
      tests: []
    };

    // Test 1: Last hour
    try {
      await jobs.enqueue(
        new SubscriptionMonitorJob({
          shop,
          payload: {
            lastChecked: oneHourAgo.toISOString(),
          },
        })
      );
      results.tests.push({
        name: 'Last Hour Check',
        timeRange: `${oneHourAgo.toISOString()} to ${now.toISOString()}`,
        status: 'queued'
      });
    } catch (error) {
      results.tests.push({
        name: 'Last Hour Check',
        error: error instanceof Error ? error.message : String(error),
        status: 'failed'
      });
    }

    // Test 2: Last 24 hours  
    try {
      await jobs.enqueue(
        new SubscriptionMonitorJob({
          shop,
          payload: {
            lastChecked: oneDayAgo.toISOString(),
          },
        })
      );
      results.tests.push({
        name: 'Last 24 Hours Check',
        timeRange: `${oneDayAgo.toISOString()} to ${now.toISOString()}`,
        status: 'queued'
      });
    } catch (error) {
      results.tests.push({
        name: 'Last 24 Hours Check',
        error: error instanceof Error ? error.message : String(error),
        status: 'failed'
      });
    }

    return json({
      success: true,
      message: 'Debug subscription monitoring jobs queued',
      results,
      instructions: [
        'Check your app logs for detailed subscription monitoring results',
        'Look for logs with "Found new subscriptions to notify"',
        'If no subscriptions found, verify:',
        '1. Customer subscriptions exist in your shop',
        '2. They were created recently (within the time ranges tested)',
        '3. The GraphQL query has proper permissions'
      ]
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    logger.error({error: errorMessage}, 'Failed to trigger debug subscription monitoring');

    return json({
      success: false,
      error: errorMessage,
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
};

// Also support GET for easy testing
export const loader = async ({request}: ActionFunctionArgs) => {
  return json({
    message: 'Debug Subscription Monitoring',
    usage: 'Send POST request to trigger debug monitoring',
    endpoint: '/app/admin/debug-subscription-monitoring',
    note: 'This will check subscription monitoring with different time ranges'
  });
};