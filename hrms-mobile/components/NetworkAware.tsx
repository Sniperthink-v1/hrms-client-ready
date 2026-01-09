// Network Aware Wrapper Component
import React from 'react';
import { View } from 'react-native';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import NoInternet from './NoInternet';

interface NetworkAwareProps {
  children: React.ReactNode;
  onRetry?: () => void;
}

export default function NetworkAware({ children, onRetry }: NetworkAwareProps) {
  const { isOffline } = useNetworkStatus();

  if (isOffline) {
    return <NoInternet onRetry={onRetry} />;
  }

  return <>{children}</>;
}

