import { View, Text, Linking } from 'react-native';
import { useThemeColors } from '../context/ThemeContext';
import { addBreadcrumb } from '../lib/sentry';
import { Card } from './ui/Card';
import { Button } from './ui/Button';

export interface UpdateRequiredProps {
  message?: string;
  storeUrl?: string;
}

export function UpdateRequired({ message, storeUrl }: UpdateRequiredProps) {
  const { colors } = useThemeColors();

  const hasUrl = !!storeUrl;
  const ctaLabel = hasUrl ? 'Update now' : 'Update from the App Store/Play Store';

  function handlePress() {
    if (storeUrl) {
      Linking.openURL(storeUrl).catch((e) =>
        addBreadcrumb('min-version', 'store_url_open_failed: ' + String(e))
      );
    }
  }

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.background,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 32,
      }}
    >
      <Card
        variant="elevated"
        padding={28}
        style={{ width: '100%', maxWidth: 360, alignItems: 'center' }}
      >
        <Text
          style={{
            color: colors.text,
            fontSize: 22,
            fontWeight: '700',
            marginBottom: 12,
            textAlign: 'center',
          }}
        >
          Update required
        </Text>

        <Text
          style={{
            color: colors.textSecondary,
            fontSize: 15,
            lineHeight: 22,
            textAlign: 'center',
            marginBottom: 28,
          }}
        >
          {message ?? 'A new version is available. Please update to continue.'}
        </Text>

        <Button
          label={ctaLabel}
          onPress={handlePress}
          disabled={!hasUrl}
          fullWidth
        />
      </Card>
    </View>
  );
}
