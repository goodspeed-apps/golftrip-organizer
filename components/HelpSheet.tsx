/**
 * GAS Template, HelpSheet
 *
 * Bottom sheet modal with "How To Use" and "Dismiss" options.
 *
 * Features:
 * - Slides up from the bottom (Modal with animationType="slide")
 * - Backdrop press dismisses the sheet
 * - "How To Use" button with book icon, DevAgent customizes the content
 * - "Dismiss" option hides the help button across the app
 * - Theme-aware colors via gasConfig
 * - Drag handle indicator at the top
 *
 * The "How To Use" action is a placeholder callback (onHowToUse).
 * The DevAgent should connect this to a HowToUseModal or walkthrough
 * specific to each app.
 *
 * Extracted from ThreadLift, made generic and config-driven.
 *
 * Dependencies: gasConfig, lucide-react-native
 */

import { Modal, View, Text, TouchableOpacity, Pressable } from 'react-native';
import { BookOpen } from 'lucide-react-native';
import { gasConfig } from '../gas.config';

interface HelpSheetProps {
  /** Whether the sheet is visible */
  visible: boolean;
  /** Called when the sheet should close (backdrop press, after action) */
  onClose: () => void;
  /** Called when user taps "Dismiss, don't show this icon" */
  onDismiss: () => Promise<void>;
  /** Optional: called when user taps "How To Use" (DevAgent provides implementation) */
  onHowToUse?: () => void;
}

const primary = gasConfig.design.colors.primary;
const surfaceDark = gasConfig.design.colors.surfaceDark;
const borderDark = gasConfig.design.colors.borderDark;

/**
 * HelpSheet, Bottom sheet with help options.
 *
 * Usage:
 *   const [visible, setVisible] = useState(false);
 *   const { dismiss } = useHelp();
 *
 *   <HelpSheet
 *     visible={visible}
 *     onClose={() => setVisible(false)}
 *     onDismiss={async () => { await dismiss(); setVisible(false); }}
 *     onHowToUse={() => { setVisible(false); showHowToModal(); }}
 *   />
 *
 * Note: HelpButton already manages this component internally. You only need
 * to use HelpSheet directly if building a custom help trigger.
 */
const SHEET_CLOSE_DELAY_MS = 350;

export function HelpSheet({ visible, onClose, onDismiss, onHowToUse }: HelpSheetProps) {
  const handleHowToUse = () => {
    onClose();
    // Small delay so the sheet closes before opening the next modal
    if (onHowToUse) {
      setTimeout(onHowToUse, SHEET_CLOSE_DELAY_MS);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable
        style={{
          flex: 1,
          justifyContent: 'flex-end',
          backgroundColor: 'rgba(0,0,0,0.6)',
        }}
        onPress={onClose}
      >
        <Pressable onPress={(e) => e.stopPropagation()}>
          <View
            style={{
              backgroundColor: surfaceDark,
              borderTopLeftRadius: 28,
              borderTopRightRadius: 28,
              padding: 24,
              paddingBottom: 44,
            }}
          >
            {/* Drag handle */}
            <View style={{ alignItems: 'center', marginBottom: 20 }}>
              <View
                style={{
                  width: 36,
                  height: 4,
                  backgroundColor: borderDark,
                  borderRadius: 2,
                  marginBottom: 20,
                }}
              />
              <Text style={{ color: '#FFFFFF', fontSize: 20, fontWeight: '700' }}>
                Need help?
              </Text>
              <Text style={{ color: '#6B7280', fontSize: 14, marginTop: 4 }}>
                Learn how to get the most from {gasConfig.app.name}
              </Text>
            </View>

            {/* How To Use button */}
            <TouchableOpacity
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: '#1A1A1E',
                borderRadius: 16,
                padding: 16,
                marginBottom: 8,
                borderWidth: 1,
                borderColor: borderDark,
              }}
              onPress={handleHowToUse}
              accessibilityLabel={`How to use ${gasConfig.app.name}`}
            >
              <View
                style={{
                  width: 46,
                  height: 46,
                  borderRadius: 23,
                  backgroundColor: primary + '18',
                  borderWidth: 1,
                  borderColor: primary + '30',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: 14,
                }}
              >
                <BookOpen size={22} color={primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '600' }}>
                  How To Use {gasConfig.app.name}
                </Text>
                <Text style={{ color: '#6B7280', fontSize: 13, marginTop: 2 }}>
                  Step-by-step guide
                </Text>
              </View>
              <Text style={{ color: '#374151', fontSize: 22 }}>{'>'}</Text>
            </TouchableOpacity>

            {/* Dismiss button */}
            <TouchableOpacity
              style={{ alignItems: 'center', padding: 16 }}
              onPress={onDismiss}
              accessibilityLabel="Dismiss help button"
            >
              <Text style={{ color: '#6B7280', fontSize: 15 }}>
                Dismiss -- don't show this icon
              </Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
