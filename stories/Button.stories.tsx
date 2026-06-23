import type { Meta, StoryObj } from '@storybook/react';
import { Button } from '../components/ui/Button';

const meta: Meta<typeof Button> = {
  title: 'UI/Button',
  component: Button,
  args: {
    label: 'Click me',
    onPress: () => {},
  },
};

export default meta;
type Story = StoryObj<typeof Button>;

export const Default: Story = {
  args: {
    label: 'Primary Button',
    variant: 'primary',
  },
};

export const Outline: Story = {
  args: {
    label: 'Outline Button',
    variant: 'outline',
  },
};

export const Ghost: Story = {
  args: {
    label: 'Ghost Button',
    variant: 'ghost',
  },
};

export const Destructive: Story = {
  args: {
    label: 'Delete',
    variant: 'destructive',
  },
};

export const Disabled: Story = {
  args: {
    label: 'Disabled',
    disabled: true,
  },
};

export const Loading: Story = {
  args: {
    label: 'Saving...',
    loading: true,
  },
};

export const Large: Story = {
  args: {
    label: 'Large Button',
    size: 'lg',
  },
};

export const Small: Story = {
  args: {
    label: 'Small Button',
    size: 'sm',
  },
};

export const FullWidth: Story = {
  args: {
    label: 'Full Width',
    fullWidth: true,
  },
};
