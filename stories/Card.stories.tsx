import type { Meta, StoryObj } from '@storybook/react';
import { Card } from '../components/ui/Card';
import React from 'react';
import { Text } from 'react-native';

const meta: Meta<typeof Card> = {
  title: 'UI/Card',
  component: Card,
  args: {
    children: <Text style={{ fontSize: 15 }}>Card content goes here</Text>,
  },
};

export default meta;
type Story = StoryObj<typeof Card>;

export const Default: Story = {};

export const Elevated: Story = {
  args: {
    variant: 'elevated',
  },
};

export const Outlined: Story = {
  args: {
    variant: 'outlined',
  },
};

export const Flat: Story = {
  args: {
    variant: 'flat',
  },
};

export const Tappable: Story = {
  args: {
    variant: 'outlined',
    onPress: () => alert('Card pressed'),
    children: <Text style={{ fontSize: 15 }}>Tap me!</Text>,
  },
};

export const ExtraPadding: Story = {
  args: {
    variant: 'elevated',
    padding: 32,
    children: <Text style={{ fontSize: 15 }}>Card with extra padding</Text>,
  },
};
