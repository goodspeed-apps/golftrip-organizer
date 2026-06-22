/**
 * GAS Template, Modal Stack Layout
 *
 * Stack navigator for modal screens with presentation: 'modal'.
 * Contains paywall and any other modal routes defined in gasConfig.navigation.modals.
 */

import { Stack } from 'expo-router';

export default function ModalLayout() {
  return <Stack screenOptions={{ presentation: 'modal', headerShown: false }} />;
}
