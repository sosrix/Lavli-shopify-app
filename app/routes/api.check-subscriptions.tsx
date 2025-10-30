import type {ActionFunctionArgs, LoaderFunctionArgs} from '@remix-run/node';
import {json} from '@remix-run/node';
import {authenticate} from '~/shopify.server';
import {logger} from '~/utils/logger.server';

const SUBSCRIPTION_CHECK_QUERY = `#graphql
  query SubscriptionCheck($cursor: String) {
    subscriptionContracts(first: 50, after: $cursor, sortKey: CREATED_AT, reverse: true) {
      edges {
        node {
          id
          status
          createdAt
          updatedAt
          customer {
            id
            email
            firstName
            lastName
          }
          originOrder {
            id
            name
          }
          lines(first: 10) {
            edges {
              node {
                id
                productId
                variantId
                title
                quantity
                currentPrice {
                  amount
                  currencyCode
                }
              }
            }
          }
          billingPolicy {
            interval
            intervalCount
          }
          deliveryPolicy {
            interval
            intervalCount
          }
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`;

/**
 * API endpoint to check all subscriptions in the shop
 * GET or POST /api/check-subscriptions
 * 
 * This endpoint retrieves all subscription contracts from Shopify
 * and logs them to the console for debugging purposes.
 */

async function checkSubscriptions(request: Request) {
  try {
    const {session} = await authenticate.admin(request);
    const shop = session.shop;

    logger.info({shop}, 'Starting subscription check via API endpoint');

    const {admin} = await authenticate.admin(request);
    let allSubscriptions: any[] = [];
    let cursor: string | null = null;
    let hasNextPage = true;
    let pageCount = 0;

    // Fetch all subscriptions with pagination
    while (hasNextPage && pageCount < 20) { // Safety limit
      pageCount++;
      
      const response = await admin.graphql(SUBSCRIPTION_CHECK_QUERY, {
        variables: {
          cursor: cursor,
        },
      });

      const json = await response.json();
      
      if (!json.data?.subscriptionContracts) {
        logger.error({shop, json}, 'Failed to fetch subscription contracts');
        throw new Error('Failed to fetch subscription contracts');
      }

      const subscriptionContracts = json.data.subscriptionContracts;
      const subscriptions = subscriptionContracts.edges.map((edge: any) => edge.node);
      
      allSubscriptions = [...allSubscriptions, ...subscriptions];
      
      hasNextPage = subscriptionContracts.pageInfo.hasNextPage;
      cursor = subscriptionContracts.pageInfo.endCursor;
      
      logger.info(
        {shop, page: pageCount, subscriptionsOnPage: subscriptions.length, totalSoFar: allSubscriptions.length},
        'Fetched subscription page'
      );
    }

    // Console log all subscriptions with detailed info
    console.log('\n=== SUBSCRIPTION CHECK RESULTS ===');
    console.log(`Shop: ${shop}`);
    console.log(`Total Subscriptions Found: ${allSubscriptions.length}`);
    console.log(`Fetched ${pageCount} pages`);
    console.log('=====================================\n');

    allSubscriptions.forEach((subscription, index) => {
      console.log(`--- SUBSCRIPTION ${index + 1} ---`);
      console.log(`ID: ${subscription.id}`);
      console.log(`Status: ${subscription.status}`);
      console.log(`Created: ${subscription.createdAt}`);
      console.log(`Updated: ${subscription.updatedAt}`);
      
      if (subscription.customer) {
        console.log(`Customer: ${subscription.customer.email} (${subscription.customer.firstName} ${subscription.customer.lastName})`);
        console.log(`Customer ID: ${subscription.customer.id}`);
      }
      
      if (subscription.originOrder) {
        console.log(`Origin Order: ${subscription.originOrder.name} (${subscription.originOrder.id})`);
      }
      
      console.log('Lines:');
      subscription.lines.edges.forEach((lineEdge: any, lineIndex: number) => {
        const line = lineEdge.node;
        console.log(`  ${lineIndex + 1}. ${line.title} (Qty: ${line.quantity})`);
        console.log(`     Price: ${line.currentPrice.amount} ${line.currentPrice.currencyCode}`);
        console.log(`     Product ID: ${line.productId}`);
        console.log(`     Variant ID: ${line.variantId}`);
      });
      
      if (subscription.billingPolicy) {
        console.log(`Billing: Every ${subscription.billingPolicy.intervalCount} ${subscription.billingPolicy.interval.toLowerCase()}`);
      }
      
      if (subscription.deliveryPolicy) {
        console.log(`Delivery: Every ${subscription.deliveryPolicy.intervalCount} ${subscription.deliveryPolicy.interval.toLowerCase()}`);
      }
      
      console.log('---\n');
    });

    console.log('=== END SUBSCRIPTION CHECK ===\n');

    // Also log to structured logger
    logger.info(
      {
        shop,
        totalSubscriptions: allSubscriptions.length,
        subscriptions: allSubscriptions.map(sub => ({
          id: sub.id,
          status: sub.status,
          createdAt: sub.createdAt,
          customerEmail: sub.customer?.email,
          customerId: sub.customer?.id,
          orderId: sub.originOrder?.id,
          linesCount: sub.lines.edges.length
        }))
      },
      'Complete subscription check results'
    );

    return json({
      success: true,
      shop,
      totalSubscriptions: allSubscriptions.length,
      pagesFetched: pageCount,
      subscriptions: allSubscriptions,
      message: 'All subscriptions have been logged to the console. Check your app logs for detailed output.',
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    console.error('ERROR in subscription check:', errorMessage);
    logger.error({error: errorMessage}, 'Failed to check subscriptions via API');

    return json({
      success: false,
      error: errorMessage,
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}

// Handle both GET and POST requests
export const loader = async ({request}: LoaderFunctionArgs) => {
  return checkSubscriptions(request);
};

export const action = async ({request}: ActionFunctionArgs) => {
  return checkSubscriptions(request);
};