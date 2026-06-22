import { EVENTS, EventName } from '../../lib/events';

describe('EVENTS catalog', () => {
  test('all values are stable string literals matching their keys', () => {
    for (const [key, value] of Object.entries(EVENTS)) {
      expect(value).toBe(key);
    }
  });

  test('catalog contains all required event names', () => {
    const required = [
      'app_opened',
      'signed_up',
      'signed_in',
      'paywall_viewed',
      'paywall_purchased',
      'subscription_canceled',
      'feedback_submitted',
      'share_completed',
      'referral_attributed',
      'experiment_assigned',
      'llm_call',
      'oauth_connected',
      'push_token_registered',
    ];
    for (const name of required) {
      expect(EVENTS).toHaveProperty(name, name);
    }
  });
});