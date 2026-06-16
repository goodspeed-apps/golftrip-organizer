import { Config } from 'react-native-owl';

const config: Config = {
  ios: {
    workspace: 'ios/GASTemplate.xcworkspace',
    scheme: 'GASTemplate',
    device: 'iPhone 15',
    snapshotDirectory: '__owl__/__snapshots__',
    buildCommand: 'eas build --profile development --local',
    diffingThreshold: 0.001,
  },
  android: {
    packageName: 'com.goodspeed.gastemplate',
    apiLevel: 33,
    device: 'Pixel_6_API_33',
    snapshotDirectory: '__owl__/__snapshots__',
    buildCommand: 'eas build --profile development --local --platform android',
    diffingThreshold: 0.001,
  },
  debug: false,
};

export default config;
