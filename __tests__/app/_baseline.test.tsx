import React from 'react';
import { render } from '@testing-library/react-native';
import { Text, View } from 'react-native';

// Baseline for the `app` test project. Generated per-feature behavioral tests
// (__tests__/app/<screen>.test.tsx, written by DevAgent from the app's spec) live
// alongside this file. This baseline keeps the project non-empty in the template and
// in every generated app, and proves the app-test harness itself works — ts-jest, the
// mocked react-native / expo stack, and @testing-library/react-native under
// NODE_ENV=test — independent of any generated screen.
describe('app test harness', () => {
  it('renders a component with @testing-library/react-native', async () => {
    const { getByText } = await render(
      <View>
        <Text>app-harness-ok</Text>
      </View>,
    );
    expect(getByText('app-harness-ok')).toBeTruthy();
  });
});
