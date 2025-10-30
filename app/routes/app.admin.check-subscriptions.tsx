import type {ActionFunctionArgs, LoaderFunctionArgs} from '@remix-run/node';
import {json} from '@remix-run/node';
import {useLoaderData, useFetcher} from '@remix-run/react';
import {
  Page,
  Card,
  Text,
  Button,
  Badge,
  Spinner,
} from '@shopify/polaris';
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

async function checkSubscriptions(request: Request) {
  try {
    const {session, admin} = await authenticate.admin(request);
    const shop = session.shop;

    logger.info({shop}, 'Starting subscription check via app route');
    let allSubscriptions: any[] = [];
    let cursor: string | null = null;
    let hasNextPage = true;
    let pageCount = 0;

    // Fetch all subscriptions with pagination
    while (hasNextPage && pageCount < 20) {
      pageCount++;
      
      logger.info({shop, page: pageCount, cursor}, 'Fetching subscription page');
      
      const response = await admin.graphql(SUBSCRIPTION_CHECK_QUERY, {
        variables: {
          cursor: cursor,
        },
      });

      const json = await response.json();
      
      if (!json.data?.subscriptionContracts) {
        logger.error({shop, json, response: response.status}, 'Failed to fetch subscription contracts');
        throw new Error(`Failed to fetch subscription contracts: ${JSON.stringify(json)}`);
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
    console.log('\n=== SUBSCRIPTION CHECK RESULTS (APP ROUTE) ===');
    console.log(`Shop: ${shop}`);
    console.log(`Total Subscriptions Found: ${allSubscriptions.length}`);
    console.log(`Fetched ${pageCount} pages`);
    console.log('===============================================\n');

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

    console.log('=== END SUBSCRIPTION CHECK (APP ROUTE) ===\n');

    return {
      success: true,
      shop,
      totalSubscriptions: allSubscriptions.length,
      pagesFetched: pageCount,
      subscriptions: allSubscriptions,
      timestamp: new Date().toISOString(),
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    console.error('ERROR in subscription check (app route):', {
      message: errorMessage,
      stack: errorStack,
      error: error
    });
    
    logger.error({
      error: errorMessage,
      stack: errorStack,
      fullError: error
    }, 'Failed to check subscriptions via app route');

    return {
      success: false,
      error: errorMessage,
      timestamp: new Date().toISOString(),
    };
  }
}

export const loader = async ({request}: LoaderFunctionArgs) => {
  const {session} = await authenticate.admin(request);
  
  return json({
    shop: session.shop,
    lastCheck: null,
  });
};

export const action = async ({request}: ActionFunctionArgs) => {
  const result = await checkSubscriptions(request);
  return json(result);
};

export default function SubscriptionCheckPage() {
  const loaderData = useLoaderData<typeof loader>();
  const fetcher = useFetcher<any>();
  
  const isLoading = fetcher.state === 'submitting';
  const checkResult = fetcher.data;

  const handleCheckSubscriptions = () => {
    fetcher.submit({}, {method: 'POST'});
  };

  return (
    <Page 
      title="Debug: Check All Subscriptions"
      subtitle="Fetch and log all subscriptions from Shopify for debugging"
      backAction={{content: 'Back to Contracts', url: '/app'}}
    >
      <Card>
        <div style={{marginBottom: '16px'}}>
          <Card>
            <Text as="p">
              This debug tool fetches all subscriptions from your shop and logs detailed information 
              to the console. Use this to investigate subscription monitoring and webhook issues.
            </Text>
          </Card>
        </div>

        <div style={{marginBottom: '16px'}}>
          <Text variant="headingMd" as="h2">
            Shop Information
          </Text>
          <Text as="p">Shop: {loaderData.shop}</Text>
        </div>

        <div style={{marginBottom: '16px'}}>
          <Button 
            variant="primary"
            onClick={handleCheckSubscriptions}
            loading={isLoading}
          >
            {isLoading ? 'Checking Subscriptions...' : 'Check All Subscriptions'}
          </Button>
        </div>

        {isLoading && (
          <div style={{display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px'}}>
            <Spinner size="small" />
            <Text as="p">Fetching subscriptions from Shopify...</Text>
          </div>
        )}

        {checkResult && (
          <Card>
            <div style={{marginBottom: '16px'}}>
              <Text variant="headingMd" as="h2">
                Check Results
              </Text>
            </div>
            
            {checkResult.success ? (
              <div>
                <div style={{marginBottom: '16px'}}>
                  <Badge tone="success">Success</Badge>
                </div>
                
                <div style={{marginBottom: '16px'}}>
                  <Text as="p">
                    <strong>Total Subscriptions:</strong> {checkResult.totalSubscriptions}
                  </Text>
                  <Text as="p">
                    <strong>Pages Fetched:</strong> {checkResult.pagesFetched}
                  </Text>
                  <Text as="p">
                    <strong>Check Time:</strong> {new Date(checkResult.timestamp).toLocaleString()}
                  </Text>
                </div>
                
                <div style={{marginBottom: '16px'}}>
                  <Card>
                    <Text as="p">
                      ✅ All subscriptions have been logged to the console. 
                      Check your development server logs or browser console for detailed output.
                    </Text>
                  </Card>
                </div>

                {checkResult.subscriptions && checkResult.subscriptions.length > 0 && (
                  <div>
                    <Text variant="headingSm" as="h3">Recent Subscriptions (Sample)</Text>
                    <div style={{marginTop: '8px'}}>
                      {checkResult.subscriptions.slice(0, 3).map((sub: any, index: number) => (
                        <div key={sub.id} style={{marginTop: '4px'}}>
                          <Text as="p">
                            {index + 1}. {sub.id} - {sub.status} - {sub.customer?.email || 'No email'}
                          </Text>
                        </div>
                      ))}
                      {checkResult.subscriptions.length > 3 && (
                        <Text as="p" tone="subdued">
                          ... and {checkResult.subscriptions.length - 3} more (see console logs)
                        </Text>
                      )}
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
                  {checkResult.error}
                </Text>
              </div>
            )}
          </Card>
        )}
      </Card>
    </Page>
  );
}