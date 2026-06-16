import React from 'react';
import { Text, View } from 'react-native';
import { render } from '@testing-library/react-native';

// FlashList mock: renders items by mapping over data and calling renderItem,
// or renders ListEmptyComponent when data is empty.
jest.mock('@shopify/flash-list', () => {
  const React = require('react');
  const { View } = require('react-native');

  function FlashList({
    data,
    renderItem,
    keyExtractor,
    ListEmptyComponent,
    ListHeaderComponent,
    ListFooterComponent,
  }: any) {
    const items = data ?? [];
    return React.createElement(
      View,
      { testID: 'flash-list' },
      ListHeaderComponent ? React.createElement(View, null, ListHeaderComponent) : null,
      items.length === 0 && ListEmptyComponent
        ? React.isValidElement(ListEmptyComponent)
          ? ListEmptyComponent
          : React.createElement(ListEmptyComponent)
        : items.map((item: any, index: number) =>
            React.createElement(
              View,
              { key: keyExtractor ? keyExtractor(item, index) : index },
              renderItem({ item, index, target: 'Cell' })
            )
          ),
      ListFooterComponent ? React.createElement(View, null, ListFooterComponent) : null,
    );
  }

  return { FlashList };
});

import { VirtualList } from '../../components/VirtualList';

interface Item { id: string; label: string }

describe('VirtualList', () => {
  const data: Item[] = [
    { id: '1', label: 'Apple' },
    { id: '2', label: 'Banana' },
  ];

  it('renders items via renderItem', async () => {
    const { getByText } = await render(
      <VirtualList
        data={data}
        renderItem={({ item }) => <Text>{item.label}</Text>}
        keyExtractor={item => item.id}
      />
    );
    expect(getByText('Apple')).toBeTruthy();
    expect(getByText('Banana')).toBeTruthy();
  });

  it('shows ListEmptyComponent when data is empty', async () => {
    const { getByText } = await render(
      <VirtualList
        data={[]}
        renderItem={({ item }: { item: Item }) => <Text>{item.label}</Text>}
        ListEmptyComponent={<Text>No items</Text>}
      />
    );
    expect(getByText('No items')).toBeTruthy();
  });
});