import { useWindowDimensions } from 'react-native';
import { gasConfig } from '../gas.config';

export type Breakpoint = 'phone' | 'tablet' | 'desktop';

export function useBreakpoint(): Breakpoint {
  const { width } = useWindowDimensions();
  const { tablet, desktop } = gasConfig.ui.breakpoints;
  if (width >= desktop) return 'desktop';
  if (width >= tablet) return 'tablet';
  return 'phone';
}
