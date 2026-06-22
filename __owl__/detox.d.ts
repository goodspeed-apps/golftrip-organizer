// Minimal Detox global type stubs for the owl visual regression tests.
declare const device: {
  openURL(opts: { url: string }): Promise<void>;
  reloadReactNative(): Promise<void>;
  launchApp(params?: Record<string, unknown>): Promise<void>;
  terminateApp(): Promise<void>;
};

declare function element(matcher: unknown): {
  tap(): Promise<void>;
  typeText(text: string): Promise<void>;
  clearText(): Promise<void>;
  scroll(pixels: number, direction: string): Promise<void>;
};

declare const by: {
  id(id: string): unknown;
  text(text: string): unknown;
  type(type: string): unknown;
  label(label: string): unknown;
};
