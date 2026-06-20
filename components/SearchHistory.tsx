/**
 * GAS Template, SearchHistory
 *
 * Recent searches list stored via lib/storage.ts.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, FlatList } from 'react-native';
import { Clock, X, Trash2 } from 'lucide-react-native';
import { getItem, setItem } from '../lib/storage';
import { useThemeColors } from '../context/ThemeContext';

const MAX_ENTRIES = 10;
const STORAGE_KEY = 'search_history';

export interface SearchHistoryProps {
  onSelect: (query: string) => void;
}

export function SearchHistory({ onSelect }: SearchHistoryProps) {
  const { colors } = useThemeColors();
  const [history, setHistory] = useState<string[]>([]);

  useEffect(() => {
    getItem<string[]>(STORAGE_KEY).then(items => {
      if (items) setHistory(items);
    });
  }, []);

  const removeEntry = useCallback((query: string) => {
    setHistory(prev => {
      const next = prev.filter(q => q !== query);
      setItem(STORAGE_KEY, next);
      return next;
    });
  }, []);

  const clearAll = useCallback(() => {
    setHistory([]);
    setItem(STORAGE_KEY, []);
  }, []);

  if (history.length === 0) return null;

  return (
    <View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8 }}>
        <Text style={{ color: colors.textSecondary, fontSize: 12, fontWeight: '600' }}>RECENT</Text>
        <TouchableOpacity onPress={clearAll} accessibilityLabel="Clear search history">
          <Trash2 size={14} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>
      <FlatList
        data={history}
        keyExtractor={item => item}
        renderItem={({ item }) => (
          <TouchableOpacity
            onPress={() => onSelect(item)}
            style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, gap: 10 }}
            accessibilityLabel={`Search for ${item}`}
          >
            <Clock size={14} color={colors.textSecondary} />
            <Text style={{ flex: 1, color: colors.text, fontSize: 14 }}>{item}</Text>
            <TouchableOpacity onPress={() => removeEntry(item)} hitSlop={8} accessibilityLabel={`Remove ${item}`}>
              <X size={14} color={colors.textSecondary} />
            </TouchableOpacity>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

/** Add a query to search history (call from search logic). */
export async function addToSearchHistory(query: string): Promise<void> {
  const existing = (await getItem<string[]>(STORAGE_KEY)) ?? [];
  const updated = [query, ...existing.filter(q => q !== query)].slice(0, MAX_ENTRIES);
  await setItem(STORAGE_KEY, updated);
}
