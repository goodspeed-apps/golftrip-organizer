const PostHog = {
  capture: () => {},
  identify: () => {},
  reset: () => {},
  isFeatureEnabled: () => false,
  getFeatureFlag: () => undefined,
  reloadFeatureFlags: async () => {},
};

export default PostHog;
export const usePostHog = () => PostHog;
