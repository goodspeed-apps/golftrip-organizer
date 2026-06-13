import React from 'react';

export const SafeAreaProvider = ({ children }: { children: React.ReactNode }) => children as React.ReactElement;
export const SafeAreaView = ({ children }: { children: React.ReactNode }) => children as React.ReactElement;
export const useSafeAreaInsets = () => ({ top: 0, right: 0, bottom: 0, left: 0 });
export const useSafeAreaFrame = () => ({ x: 0, y: 0, width: 375, height: 812 });
export const SafeAreaInsetsContext = React.createContext({ top: 0, right: 0, bottom: 0, left: 0 });
export const initialWindowMetrics = { frame: { x: 0, y: 0, width: 375, height: 812 }, insets: { top: 0, right: 0, bottom: 0, left: 0 } };
