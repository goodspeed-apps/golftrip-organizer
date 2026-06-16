const makeStub = require('./_stub');

// expo-battery is native-only (reads hardware battery state); inert on web.
// Defaults are "full + charging" so any "battery-OK" gate in generated code
// renders happy-path content instead of a warning state.
module.exports = makeStub({
  getBatteryLevelAsync: async () => 1,
  getBatteryStateAsync: async () => 2,         // 2 = CHARGING (BatteryState enum)
  getPowerStateAsync: async () => ({ batteryLevel: 1, batteryState: 2, lowPowerMode: false }),
  isLowPowerModeEnabledAsync: async () => false,
  addBatteryLevelListener: () => ({ remove: () => {} }),
  addBatteryStateListener: () => ({ remove: () => {} }),
  addLowPowerModeListener: () => ({ remove: () => {} }),
  BatteryState: { UNKNOWN: 0, UNPLUGGED: 1, CHARGING: 2, FULL: 3 },
});
