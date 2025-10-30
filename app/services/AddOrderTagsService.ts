import type pino from 'pino';
import OrderTagsAddMutation from '~/graphql/OrderTagsAddMutation';
import {unauthenticated} from '~/shopify.server';
import {logger} from '~/utils/logger.server';

export class AddOrderTagsService {
  private log: pino.Logger;

  constructor(
    private shopDomain: string,
    private orderId: string,
  ) {
    this.log = logger.child({shopDomain, orderId});
  }

  async run(tags: string[]): Promise<void> {
    try {
      this.log.info({tags}, 'Starting AddOrderTagsService');
      
      const {admin} = await unauthenticated.admin(this.shopDomain);
      this.log.info('Successfully authenticated with Shopify admin');
      
      const response = await admin.graphql(OrderTagsAddMutation, {
        variables: {
          id: this.orderId,
          tags: tags,
        },
      });

      const json = await response.json();
      const orderTagsAdd = json.data?.tagsAdd;

      if (!orderTagsAdd) {
        this.log.error(
          'Received invalid response from tagsAdd mutation. Expected property `tagsAdd`, received ',
          json,
        );
        throw new Error('Failed to add tags to order in AddOrderTagsService');
      }

      const userErrors = orderTagsAdd.userErrors;

      if (userErrors.length !== 0) {
        this.log.error({userErrors}, 'Failed to process AddOrderTagsService');
        throw new Error('Failed to add tags to order in AddOrderTagsService');
      }

      this.log.info('AddOrderTagsService completed successfully');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.log.error({
        error: errorMessage,
        stack: error instanceof Error ? error.stack : undefined,
        tags,
      }, 'Failed to run AddOrderTagsService');
      
      throw new Error(`AddOrderTagsService failed: ${errorMessage}`);
    }
  }
}
