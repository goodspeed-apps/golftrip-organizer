import React from 'react';
import { FlashList, type FlashListProps } from '@shopify/flash-list';
import type { ViewStyle } from 'react-native';

export type { FlashListProps };

export interface VirtualListProps<T> {
  data: T[];
  renderItem: FlashListProps<T>['renderItem'];
  keyExtractor?: (item: T, index: number) => string;
  /** Approximate height of each item in px. Kept for API compatibility; FlashList v2 auto-measures. Default: 80 */
  estimatedItemSize?: number;
  onEndReached?: () => void;
  onEndReachedThreshold?: number;
  refreshing?: boolean;
  onRefresh?: () => void;
  ListEmptyComponent?: FlashListProps<T>['ListEmptyComponent'];
  ListHeaderComponent?: FlashListProps<T>['ListHeaderComponent'];
  ListFooterComponent?: FlashListProps<T>['ListFooterComponent'];
  ItemSeparatorComponent?: FlashListProps<T>['ItemSeparatorComponent'];
  /**
   * Return a string "type" per item so FlashList can recycle views within the
   * same type. Use this when a list mixes row shapes (e.g. headers vs. cards).
   */
  getItemType?: FlashListProps<T>['getItemType'];
  contentContainerStyle?: ViewStyle;
}

export function VirtualList<T>({
  data,
  renderItem,
  keyExtractor,
  estimatedItemSize: _estimatedItemSize = 80,
  onEndReached,
  onEndReachedThreshold = 0.5,
  refreshing,
  onRefresh,
  ListEmptyComponent,
  ListHeaderComponent,
  ListFooterComponent,
  ItemSeparatorComponent,
  getItemType,
  contentContainerStyle,
}: VirtualListProps<T>) {
  return (
    <FlashList
      data={data}
      renderItem={renderItem}
      keyExtractor={keyExtractor}
      getItemType={getItemType}
      onEndReached={onEndReached}
      onEndReachedThreshold={onEndReachedThreshold}
      refreshing={refreshing}
      onRefresh={onRefresh}
      ListEmptyComponent={ListEmptyComponent}
      ListHeaderComponent={ListHeaderComponent}
      ListFooterComponent={ListFooterComponent}
      ItemSeparatorComponent={ItemSeparatorComponent}
      contentContainerStyle={contentContainerStyle}
    />
  );
}