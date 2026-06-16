declare const device: {
  openURL(options: { url: string }): Promise<void>;
  [key: string]: unknown;
};

declare function element(matcher: unknown): {
  tap(): Promise<void>;
  typeText(text: string): Promise<void>;
  clearText(): Promise<void>;
  scroll(pixels: number, direction: string): Promise<void>;
  [key: string]: unknown;
};

declare const by: {
  id(id: string): unknown;
  text(text: string): unknown;
  type(type: string): unknown;
  [key: string]: unknown;
};
