import type { Meta, StoryObj } from '@storybook/react';
import { EmptyState } from '../components/ui/EmptyState';

const meta: Meta<typeof EmptyState> = {
  title: 'UI/EmptyState',
  component: EmptyState,
  args: {
    title: 'Nothing here yet',
  },
};

export default meta;
type Story = StoryObj<typeof EmptyState>;

export const Default: Story = {
  args: {
    title: 'Nothing here yet',
    description: 'Items you save will appear here.',
  },
};

export const WithAction: Story = {
  args: {
    title: 'No results found',
    description: 'Try adjusting your search or browse all items.',
    actionLabel: 'Browse All',
    onAction: () => {},
  },
};

export const TitleOnly: Story = {
  args: {
    title: 'All caught up!',
  },
};

export const CustomIconColor: Story = {
  args: {
    title: 'No notifications',
    description: 'You will be notified when something happens.',
    iconColor: '#6366F1',
  },
};
