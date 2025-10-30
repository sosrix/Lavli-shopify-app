import type {LoaderFunctionArgs} from '@remix-run/node';
import {json} from '@remix-run/node';
import {logger} from '~/utils/logger.server';

/**
 * Simple Debug API Endpoint
 * 
 * GET /api/debug-check
 * 
 * This endpoint provides debug information without authentication.
 * Useful for testing API connectivity and basic functionality.
 */

export const loader = async ({request}: LoaderFunctionArgs) => {
  try {
    const url = new URL(request.url);
    const now = new Date();
    
    console.log('\n=== API DEBUG CHECK ===');
    console.log(`Timestamp: ${now.toISOString()}`);
    console.log(`Request URL: ${request.url}`);
    console.log(`Method: ${request.method}`);
    console.log(`Headers: ${JSON.stringify(Object.fromEntries(request.headers), null, 2)}`);
    console.log('=== END DEBUG CHECK ===\n');

    logger.info({
      url: request.url,
      method: request.method,
      timestamp: now.toISOString()
    }, 'Debug API endpoint called');

    return json({
      success: true,
      message: 'Debug API endpoint is working',
      timestamp: now.toISOString(),
      url: request.url,
      method: request.method,
      note: 'This is a test endpoint to verify API connectivity'
    });

  } catch (error) {
    console.error('Error in debug endpoint:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    return json({
      success: false,
      error: errorMessage,
      timestamp: new Date().toISOString()
    }, {status: 500});
  }
};