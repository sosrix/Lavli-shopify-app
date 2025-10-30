/**
 * Manual test script to trigger subscription monitoring
 * This creates a subscription monitoring job to test the external webhook system
 * 
 * Usage:
 * 1. Set up your server to receive webhooks at the endpoint defined in ExternalWebhookJob
 * 2. Update the shop name below to match your development shop
 * 3. Run this test using: npm run test:manual
 */

import {jobs, SubscriptionMonitorJob} from '../../app/jobs';

async function testSubscriptionMonitoring() {
  const testShop = 'test-shop.myshopify.com'; // Replace with your actual shop
  
  console.log('🚀 Starting subscription monitoring test...');
  
  try {
    // Enqueue a subscription monitoring job to run immediately
    const startTime = Math.floor(Date.now() / 1000);
    
    await jobs.enqueue(
      new SubscriptionMonitorJob({
        shop: testShop,
        payload: {
          lastChecked: new Date(Date.now() - 60 * 60 * 1000).toISOString(), // 1 hour ago
        },
      }),
      {
        scheduleTime: {
          seconds: startTime,
        }
      }
    );

    console.log('✅ Subscription monitoring job queued successfully');
    console.log(`📅 Scheduled to run at: ${new Date(startTime * 1000).toISOString()}`);
    console.log('💡 Check your webhook endpoint for incoming subscription data');
    console.log('🔄 The job will automatically reschedule itself to run every 5 minutes');
    
  } catch (error) {
    console.error('❌ Error testing subscription monitoring:', error);
  }
}

// Only run if this file is executed directly
if (require.main === module) {
  testSubscriptionMonitoring()
    .then(() => {
      console.log('🎉 Test completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Test failed:', error);
      process.exit(1);
    });
}

export {testSubscriptionMonitoring};