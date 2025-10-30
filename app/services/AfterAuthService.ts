import '@shopify/shopify-app-remix/adapters/node';

import {createActiveBillingSchedule} from '~/models/BillingSchedule/BillingSchedule.server';
import {logger} from '~/utils/logger.server';
import {config} from 'config';

import {ensureSettingsMetaobjectDefinitionAndObjectExists} from '~/models/Settings/Settings.server';

export class AfterAuthService {
  steps: Function[] = [
    async function createActiveBillingScheduleStep(this: AfterAuthService) {
      await createActiveBillingSchedule(this.session.shop);
    },

    async function ensureSettingsMetaobjectStep(this: AfterAuthService) {
      await ensureSettingsMetaobjectDefinitionAndObjectExists(
        this.admin.graphql,
      );
    },

    // Note: Subscription monitoring is disabled for INLINE scheduler to prevent infinite loops
    // For production with CLOUD_TASKS scheduler, uncomment the monitoring step below
    /*
    async function startSubscriptionMonitoringStep(this: AfterAuthService) {
      if (config.jobs.scheduler !== 'INLINE') {
        // Start subscription monitoring for webhooks
        const startTime = Math.floor((Date.now() + 30 * 1000) / 1000); // Start in 30 seconds
        
        jobs.enqueue(
          new SubscriptionMonitorJob({
            shop: this.session.shop,
            payload: {
              lastChecked: new Date().toISOString(),
            },
          }),
          {
            scheduleTime: {
              seconds: startTime,
            }
          }
        );

        logger.info(
          {shop: this.session.shop, startTime: new Date(startTime * 1000).toISOString()},
          'Scheduled subscription monitoring for external webhooks'
        );
      } else {
        logger.info(
          {shop: this.session.shop, scheduler: config.jobs.scheduler},
          'Skipping subscription monitoring auto-start for INLINE scheduler'
        );
      }
    },
    */
  ];

  // eslint-disable-next-line no-useless-constructor
  constructor(
    private session: any,
    private admin: any,
  ) {}

  public async run() {
    const response = await Promise.allSettled(
      this.steps.map((step) => step.bind(this)()),
    );

    response.forEach((result, index) => {
      if (result.status === 'rejected') {
        const stepName = this.steps[index].name;
        logger.error(
          {shop: this.session.shop, step: stepName},
          `Initial step "${stepName}" failed with "${result.reason}"`,
        );
      }
    });
  }
}
