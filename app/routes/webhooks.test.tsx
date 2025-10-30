import type {ActionFunctionArgs} from '@remix-run/node';
import {json} from '@remix-run/node';

/**
 * Webhook Test Route - Catches any webhook for testing
 * 
 * This route will log any webhook requests to help debug
 * whether webhooks are being received by the app.
 */

export const action = async ({request}: ActionFunctionArgs) => {
  const url = new URL(request.url);
  const method = request.method;
  const headers = Object.fromEntries(request.headers.entries());
  
  let body = '';
  try {
    body = await request.text();
  } catch (error) {
    body = 'Could not read body';
  }

  console.log('\n📥 WEBHOOK TEST ROUTE HIT 📥');
  console.log('=============================');
  console.log(`🔗 URL: ${url.pathname}`);
  console.log(`📡 Method: ${method}`);
  console.log(`🏷️ Headers:`, headers);
  console.log(`📦 Body:`, body);
  console.log('=============================\n');

  return json({
    success: true,
    message: 'Webhook test route received request',
    url: url.pathname,
    method,
    timestamp: new Date().toISOString()
  });
};

export const loader = async ({request}: ActionFunctionArgs) => {
  console.log('\n📥 WEBHOOK TEST ROUTE - GET REQUEST 📥');
  console.log(`🔗 URL: ${request.url}`);
  console.log(`📅 Time: ${new Date().toISOString()}`);
  
  return json({
    message: 'Webhook test route - GET request received',
    url: request.url,
    timestamp: new Date().toISOString()
  });
};