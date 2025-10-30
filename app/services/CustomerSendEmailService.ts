import {unauthenticated} from '~/shopify.server';
import {logger} from '~/utils/logger.server';

import type {EmailDunningStatusType} from '~/utils/finalActionSettings';

export interface CustomerEmailTemplateInput {
  subscriptionContractId: string;
  subscriptionTemplateName: CustomerEmailTemplateNameType;
  billingCycleIndex?: number;
  dunningStatus?: EmailDunningStatusType;
  finalChargeDate?: string;
}

export const CustomerEmailTemplateName = {
  NewSubscription: 'NEW_SUBSCRIPTION',
  SubscriptionCancelled: 'SUBSCRIPTION_CANCELED',
  SubscriptionPaused: 'SUBSCRIPTION_PAUSED',
  SubscriptionResumed: 'SUBSCRIPTION_RESUMED',
  SubscriptionSkipped: 'SUBSCRIPTION_SKIPPED',
  SubscriptionPaymentFailure: 'SUBSCRIPTION_PAYMENT_FAILURE',
  SubscriptionPaymentFailureRetry: 'SUBSCRIPTION_PAYMENT_FAILURE_RETRY',
  SubscriptionPaymentFailureLastAttempt:
    'SUBSCRIPTION_PAYMENT_FAILURE_LAST_ATTEMPT',
} as const;

export type CustomerEmailTemplateNameType =
  (typeof CustomerEmailTemplateName)[keyof typeof CustomerEmailTemplateName];

export class CustomerSendEmailService {
  async run(
    shopDomain: string,
    customerId: string,
    templateInput: CustomerEmailTemplateInput,
  ): Promise<boolean> {
    const log = logger.child({shopDomain, customerId, templateInput});

    log.info('Running CustomerSendEmailService');

    try {
      const {admin} = await unauthenticated.admin(shopDomain);
      log.info('Successfully authenticated with Shopify admin');
      
      // TODO: Implement actual email sending logic
      // For now, just return true to indicate success
      log.info('Email service completed successfully (placeholder implementation)');
      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      log.error({
        error: errorMessage,
        stack: error instanceof Error ? error.stack : undefined,
      }, 'Failed to run CustomerSendEmailService');
      
      throw new Error(`CustomerSendEmailService failed: ${errorMessage}`);
    }
  }
}
