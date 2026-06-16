/**
 * GAS Template, SearchBar
 *
 * Debounced search input component with clear button and loading indicator.
 *
 * Features:
 * - Debounced onChange via useDebounce hook (configurable delay)
 * - Clear button (X) appears when query is non-empty
 * - Optional loading indicator (ActivityIndicator) while searching
 * - Theme-aware colors via useThemeColors()
 * - Accessible: proper labels, keyboard type, return key type
 * - Auto-focus option
 * - Placeholder text configurable
 *
 * Dependencies: useDebounce, useThemeColors (ThemeContext), gasConfig
 */

import { useState, useEffect, useRef } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { Search, X } from 'lucide-react-native';
import { useDebounce } from '@/hooks/useDebounce';
import { useThemeColors } from '@/context/ThemeContext';
import { gasConfig } from '../../gas.config';

interface SearchBarProps {
  /** Current search query value */
  value?: string;
  /** Called with the raw (non-debounced) query on every keystroke */
  onChangeText?: (text: string) => void;
  /** Called with the debounced query after the delay */
  onDebouncedChange?: (text: string) => void;
  /** Debounce delay in ms (default: 300) */
  debounceMs?: number;
  /** Placeholder text (default: 'Search...') */
  placeholder?: string;
  /** Show a loading spinner on the right (default: false) */
  isLoading?: boolean;
  /** Auto-focus the input on mount (default: false) */
  autoFocus?: boolean;
  /** Additional TextInput props */
  inputProps?: TextInputProps;
  /** Container style overrides */
  style?: ViewStyle;
}

/**
 * SearchBar, Debounced search input with clear and loading states.
 *
 * Usage:
 *   // Controlled with debounced callback:
 *   const [query, setQuery] = useState('');
 *   <SearchBar
 *     value={query}
 *     onChangeText={setQuery}
 *     onDebouncedChange={(q) => fetchResults(q)}
 *     isLoading={isFetching}
 *     placeholder="Search items..."
 *   />
 *
 *   // Uncontrolled (manages its own state):
 *   <SearchBar
 *     onDebouncedChange={(q) => console.log('Debounced:', q)}
 *   />
 */
export function SearchBar({
  value: controlledValue,
  onChangeText,
  onDebouncedChange,
  debounceMs = 300,
  placeholder = 'Search...',
  isLoading = false,
  autoFocus = false,
  inputProps,
  style,
}: SearchBarProps) {
  const { colors } = useThemeColors();
  const primary = gasConfig.design.colors.primary;
  const inputRef = useRef<TextInput>(null);

  // Internal state for uncontrolled mode
  const [internalValue, setInternalValue] = useState('');
  const query = controlledValue ?? internalValue;
  const debouncedQuery = useDebounce(query, debounceMs);

  // Fire debounced callback
  useEffect(() => {
    onDebouncedChange?.(debouncedQuery);
  }, [debouncedQuery, onDebouncedChange]);

  const handleChange = (text: string) => {
    if (controlledValue === undefined) {
      setInternalValue(text);
    }
    onChangeText?.(text);
  };

  const handleClear = () => {
    if (controlledValue === undefined) {
      setInternalValue('');
    }
    onChangeText?.('');
    inputRef.current?.focus();
  };

  const hasQuery = query.length > 0;

  return (
    <View
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: colors.surface,
          borderRadius: 14,
          borderWidth: 1,
          borderColor: colors.border,
          paddingHorizontal: 12,
          height: 44,
        },
        style,
      ]}
    >
      {/* Search icon (decorative) */}
      <Search
        size={18}
        color={colors.textSecondary}
        style={{ marginRight: 8 }}
        accessible={false}
        importantForAccessibility="no"
      />

      {/* Text input */}
      <TextInput
        ref={inputRef}
        value={query}
        onChangeText={handleChange}
        placeholder={placeholder}
        placeholderTextColor={colors.textSecondary}
        autoFocus={autoFocus}
        autoCorrect={false}
        autoCapitalize="none"
        returnKeyType="search"
        keyboardType="default"
        accessibilityLabel="Search input"
        style={{
          flex: 1,
          color: colors.text,
          fontSize: 15,
          paddingVertical: 0, // Remove default padding on Android
        }}
        {...inputProps}
      />

      {/* Loading indicator */}
      {isLoading && (
        <ActivityIndicator
          size="small"
          color={primary}
          style={{ marginLeft: 8 }}
        />
      )}

      {/* Clear button */}
      {hasQuery && !isLoading && (
        <TouchableOpacity
          onPress={handleClear}
          accessibilityRole="button"
          accessibilityLabel="Clear search"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={{ marginLeft: 8 }}
        >
          <X size={18} color={colors.textSecondary} />
        </TouchableOpacity>
      )}
    </View>
  );
}
