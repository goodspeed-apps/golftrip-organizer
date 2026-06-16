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
