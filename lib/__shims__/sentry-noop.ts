import type { ReactNode } from 'react';

export const noopInit = (): void => {};
export const noopCaptureException = (): void => {};
export const noopCaptureMessage = (): void => {};
export const noopSetUser = (): void => {};
export const noopAddBreadcrumb = (): void => {};
export const noopSetTag = (): void => {};
export const noopSetExtra = (): void => {};
export const noopSetContext = (): void => {};
export const noopConfigureScope = (): void => {};
export const noopWithScope = (): void => {};
export const noopGetCurrentHub = (): { getScope: () => null } => ({ getScope: () => null });
export const noopStartTransaction = (): { finish: () => void } => ({ finish: () => {} });
export const passthroughWrap = <T>(component: T): T => component;
export const ErrorBoundary = ({ children }: { children: ReactNode }) => children;
export type SeverityLevel = 'fatal' | 'error' | 'warning' | 'log' | 'info' | 'debug';
