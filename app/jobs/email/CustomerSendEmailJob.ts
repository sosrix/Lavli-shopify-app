import type {Jobs, Webhooks} from '~/types';

import {Job} from '~/lib/jobs';
import type {CustomerEmailTemplateInput} from '~/services/CustomerSendEmailService';
import {CustomerSendEmailService} from '~/services/CustomerSendEmailService';
import {getContractCustomerId} from '~/models/SubscriptionContract/SubscriptionContract.server';

export class CustomerSendEmailJob extends Job<
  Jobs.Parameters<Webhooks.SubscriptionContractEvent>
> {
  public queue: string = 'webhooks';

  async perform(): Promise<void> {
    const {shop, payload} = this.parameters;

    try {
      let {
        admin_graphql_api_id: subscriptionContractId,
        emailTemplate: subscriptionTemplateName,
        admin_graphql_api_customer_id: customerId,
        cycle_index: billingCycleIndex,
      } = payload;

      this.logger.info({
        shop,
        subscriptionContractId,
        subscriptionTemplateName,
        customerId,
        billingCycleIndex,
      }, 'Starting CustomerSendEmailJob');

      if (!customerId) {
        this.logger.info('No customer ID in payload, fetching from contract');
        customerId = await getContractCustomerId(shop, subscriptionContractId);
        this.logger.info({customerId}, 'Retrieved customer ID from contract');
      }

      const templateInput: CustomerEmailTemplateInput = {
        subscriptionContractId,
        subscriptionTemplateName,
      };

      if (billingCycleIndex) {
        templateInput.billingCycleIndex = billingCycleIndex;
      }

      this.logger.info({templateInput}, 'Calling CustomerSendEmailService');
      await new CustomerSendEmailService().run(shop, customerId, templateInput);
      
      this.logger.info('CustomerSendEmailJob completed successfully');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error({
        error: errorMessage,
        stack: error instanceof Error ? error.stack : undefined,
        shop,
        payload,
      }, 'CustomerSendEmailJob failed');
      
      throw new Error(`CustomerSendEmailJob failed: ${errorMessage}`);
    }
  }
}
