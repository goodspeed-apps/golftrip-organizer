declare module 'react-native-owl' {
  export function takeScreenshot(name: string): Promise<void>;
  export function loadApp(): Promise<void>;

  export interface Config {
    ios?: {
      workspace?: string;
      scheme?: string;
      device?: string;
      snapshotDirectory?: string;
      buildCommand?: string;
      diffingThreshold?: number;
    };
    android?: {
      packageName?: string;
      apiLevel?: number;
      device?: string;
      snapshotDirectory?: string;
      buildCommand?: string;
      diffingThreshold?: number;
    };
    debug?: boolean;
  }
}

declare const device: {
  openURL(options: { url: string }): Promise<void>;
  [key: string]: unknown;
};

declare function element(matcher: unknown): {
  tap(): Promise<void>;
  [key: string]: unknown;
};

declare const by: {
  id(id: string): unknown;
  [key: string]: unknown;
};
