import type {Jobs} from '~/types';

import {Job} from '~/lib/jobs';
import {AddOrderTagsService} from '~/services/AddOrderTagsService';

export class TagSubscriptionOrderJob extends Job<
  Jobs.Parameters<Jobs.TagSubscriptionsOrderPayload>
> {
  public queue: string = 'webhooks';

  async perform(): Promise<void> {
    const {shop, payload} = this.parameters;

    try {
      this.logger.info({
        shop,
        orderId: payload.orderId,
        tags: payload.tags,
      }, 'Starting TagSubscriptionOrderJob');

      if (payload.orderId !== null) {
        this.logger.info('Processing order tagging');
        await new AddOrderTagsService(shop, payload.orderId).run(payload.tags);
        this.logger.info('TagSubscriptionOrderJob completed successfully');
      } else {
        this.logger.info(
          `No order ID in the webhook payload terminating ${this.constructor.name}`,
        );
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error({
        error: errorMessage,
        stack: error instanceof Error ? error.stack : undefined,
        shop,
        payload,
      }, 'TagSubscriptionOrderJob failed');
      
      throw new Error(`TagSubscriptionOrderJob failed: ${errorMessage}`);
    }
  }
}
