import type {ActionFunctionArgs} from '@remix-run/node';
import {json} from '@remix-run/node';
import {authenticate} from '~/shopify.server';
import {ManualSubscriptionMonitorService} from '~/services/ManualSubscriptionMonitorService';
import {logger} from '~/utils/logger.server';

/**
 * Manual Subscription Monitoring Trigger Route
 * 
 * POST /app/admin/trigger-subscription-monitoring
 * 
 * This route allows you to manually trigger subscription monitoring for webhooks.
 * Useful for development with INLINE scheduler or periodic manual checks.
 * 
 * Usage:
 * curl -X POST "https://your-app.herokuapp.com/app/admin/trigger-subscription-monitoring" \
 *   -H "Authorization: Bearer YOUR_SESSION_TOKEN"
 */

export const action = async ({request}: ActionFunctionArgs) => {
  try {
    const {session} = await authenticate.admin(request);
    const shop = session.shop;

    logger.info({shop}, 'Manual subscription monitoring triggered via admin route');

    await ManualSubscriptionMonitorService.triggerSubscriptionMonitoring(shop);

    return json({
      success: true,
      message: 'Subscription monitoring triggered successfully',
      shop,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    logger.error({error: errorMessage}, 'Failed to trigger manual subscription monitoring');

    return json({
      success: false,
      error: errorMessage,
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
};

// For development/testing - also support GET requests
export const loader = async ({request}: ActionFunctionArgs) => {
  if (request.url.includes('trigger-subscription-monitoring')) {
    return action({request} as ActionFunctionArgs);
  }
  
  return json({
    message: 'Manual Subscription Monitoring Trigger',
    usage: 'Send POST request to trigger monitoring',
    endpoint: '/app/admin/trigger-subscription-monitoring',
  });
};