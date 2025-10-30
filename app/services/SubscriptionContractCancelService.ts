import type pino from 'pino';
import SubscriptionContractCancel from '~/graphql/SubscriptionContractCancelMutation';
import {jobs, ExternalWebhookJob} from '~/jobs';
import type {GraphQLClient, Jobs} from '~/types';
import {logger} from '~/utils/logger.server';

export class SubscriptionContractCancelService {
  private log: pino.Logger;

  constructor(
    private graphql: GraphQLClient,
    private shopDomain: string,
    private subscriptionContractId: string,
  ) {
    this.log = logger.child({shopDomain: this.shopDomain, subscriptionContractId});
  }

  async run(): Promise<void> {
    try {
      await this.cancelSubscriptionContract();
      this.log.info('SubscriptionContractCancelService completed successfully');
    } catch (error) {
      this.log.error(
        {error},
        `Failed to process SubscriptionContractCancelService`,
      );
      throw error;
    }
  }

  private async cancelSubscriptionContract() {
    const response = await this.graphql(SubscriptionContractCancel, {
      variables: {
        subscriptionContractId: this.subscriptionContractId,
      },
    });

    const json = await response.json();
    const subscriptionContractCancel = json.data?.subscriptionContractCancel;

    if (!subscriptionContractCancel) {
      this.log.error(
        'Received invalid response from SubscriptionContractCancel mutation. Expected property `subscriptionContractCancel`, received ',
        json,
      );
      throw new Error(
        'Failed to cancel subscription via SubscriptionContractCancel',
      );
    }

    const {userErrors} = subscriptionContractCancel;

    if (userErrors.length !== 0) {
      this.log.error(
        {userErrors},
        'Failed to process SubscriptionContractCancel',
      );
      throw new Error(
        'Failed to cancel subscription via SubscriptionContractCancel',
      );
    }

    // Send external webhook notification for app-initiated cancel
    this.log.info('Sending external webhook for subscription canceled');
    const externalWebhookParams: Jobs.Parameters<{
      event: string;
      subscriptionData: any;
    }> = {
      shop: this.shopDomain,
      payload: {
        event: 'subscription-canceled',
        subscriptionData: {
          admin_graphql_api_id: this.subscriptionContractId,
          status: 'CANCELLED',
          source: 'app', // Indicate this came from the app, not a webhook
        },
      },
    };

    jobs.enqueue(new ExternalWebhookJob(externalWebhookParams));
  }
}
