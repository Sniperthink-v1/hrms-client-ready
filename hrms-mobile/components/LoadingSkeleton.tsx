// Loading Skeleton Component
import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';

interface LoadingSkeletonProps {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  style?: any;
}

export default function LoadingSkeleton({ 
  width = '100%', 
  height = 20, 
  borderRadius = 8,
  style 
}: LoadingSkeletonProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const animatedValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(animatedValue, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(animatedValue, {
          toValue: 0,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  const opacity = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.7],
  });

  return (
    <Animated.View
      style={[
        styles.skeleton,
        {
          width,
          height,
          borderRadius,
          backgroundColor: colors.border,
          opacity,
        },
        style,
      ]}
    />
  );
}

export function ListItemSkeleton() {
  return (
    <View style={styles.listItem}>
      <LoadingSkeleton width={56} height={56} borderRadius={28} style={styles.avatar} />
      <View style={styles.listItemContent}>
        <LoadingSkeleton width="60%" height={18} style={styles.mb8} />
        <LoadingSkeleton width="40%" height={14} style={styles.mb8} />
        <LoadingSkeleton width="80%" height={14} />
      </View>
    </View>
  );
}

export function CardSkeleton() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  
  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <LoadingSkeleton width="100%" height={120} style={styles.mb12} />
      <LoadingSkeleton width="70%" height={18} style={styles.mb8} />
      <LoadingSkeleton width="50%" height={14} style={styles.mb8} />
      <LoadingSkeleton width="90%" height={14} />
    </View>
  );
}

export function DashboardSkeleton() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  
  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header Skeleton */}
      <View style={styles.dashboardHeader}>
        <LoadingSkeleton width={200} height={24} style={styles.mb16} />
        <LoadingSkeleton width={44} height={44} borderRadius={10} />
      </View>

      {/* Stats Cards Skeleton */}
      <View style={styles.statsGrid}>
        {[1, 2, 3, 4].map((i) => (
          <View key={i} style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <LoadingSkeleton width={40} height={40} borderRadius={20} style={styles.mb12} />
            <LoadingSkeleton width="80%" height={20} style={styles.mb8} />
            <LoadingSkeleton width="60%" height={16} />
          </View>
        ))}
      </View>

      {/* Quick Access Skeleton */}
      <View style={styles.quickAccessSection}>
        <LoadingSkeleton width={120} height={18} style={styles.mb16} />
        <View style={styles.quickAccessGrid}>
          {[1, 2, 3, 4].map((i) => (
            <View key={i} style={[styles.quickAccessCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <LoadingSkeleton width={48} height={48} borderRadius={24} style={styles.mb8} />
              <LoadingSkeleton width={60} height={14} />
            </View>
          ))}
        </View>
      </View>

      {/* Chart Skeleton */}
      <View style={[styles.chartCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <LoadingSkeleton width={150} height={20} style={styles.mb16} />
        <LoadingSkeleton width="100%" height={200} borderRadius={12} />
      </View>
    </View>
  );
}

export function EmployeeListSkeleton({ count = 5 }: { count?: number }) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  
  return (
    <>
      {Array.from({ length: count }).map((_, index) => (
        <View key={index} style={[styles.employeeCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.cardContent}>
            <LoadingSkeleton width={56} height={56} borderRadius={28} />
            <View style={styles.employeeInfo}>
              <LoadingSkeleton width="60%" height={18} style={styles.mb8} />
              <LoadingSkeleton width="40%" height={14} style={styles.mb8} />
              <LoadingSkeleton width="50%" height={14} />
            </View>
          </View>
          <LoadingSkeleton width={8} height={8} borderRadius={4} />
        </View>
      ))}
    </>
  );
}

export function TableSkeleton({ rows = 5, columns = 4 }: { rows?: number; columns?: number }) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  
  return (
    <View style={[styles.tableContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      {/* Table Header */}
      <View style={styles.tableRow}>
        {Array.from({ length: columns }).map((_, i) => (
          <View key={i} style={styles.tableCell}>
            <LoadingSkeleton width="80%" height={16} />
          </View>
        ))}
      </View>
      {/* Table Rows */}
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <View key={rowIndex} style={[styles.tableRow, { borderTopColor: colors.border }]}>
          {Array.from({ length: columns }).map((_, colIndex) => (
            <View key={colIndex} style={styles.tableCell}>
              <LoadingSkeleton width={colIndex === 0 ? "90%" : "70%"} height={14} />
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

export function FormSkeleton() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  
  return (
    <View style={styles.formContainer}>
      {[1, 2, 3, 4].map((i) => (
        <View key={i} style={styles.formGroup}>
          <LoadingSkeleton width={100} height={14} style={styles.mb8} />
          <View style={[styles.formInput, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <LoadingSkeleton width="100%" height={48} borderRadius={8} />
          </View>
        </View>
      ))}
    </View>
  );
}

export function TrackAttendanceSkeleton() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  
  return (
    <View style={{ flex: 1 }}>
      {/* KPI Cards Skeleton */}
      <View style={{
        flexDirection: 'row',
        flexWrap: 'wrap',
        paddingHorizontal: 16,
        paddingBottom: 16,
        gap: 8,
      }}>
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <View
            key={i}
            style={{
              flex: 1,
              minWidth: '30%',
              paddingVertical: 12,
              paddingHorizontal: 10,
              borderRadius: 8,
              borderWidth: 1,
              backgroundColor: colors.surface,
              borderColor: colors.border,
            }}
          >
            <LoadingSkeleton width="70%" height={12} style={{ marginBottom: 8 }} />
            <LoadingSkeleton width="50%" height={20} />
          </View>
        ))}
      </View>

      {/* Attendance Cards Skeleton */}
      <View style={{ paddingHorizontal: 16 }}>
        {[1, 2, 3, 4, 5].map((i) => (
          <View
            key={i}
            style={{
              borderRadius: 12,
              borderWidth: 1,
              padding: 12,
              marginBottom: 8,
              backgroundColor: colors.surface,
              borderColor: colors.border,
            }}
          >
            {/* Header */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <View style={{ flex: 1 }}>
                <LoadingSkeleton width="60%" height={16} style={{ marginBottom: 6 }} />
                <LoadingSkeleton width="40%" height={12} />
              </View>
              <LoadingSkeleton width={60} height={24} borderRadius={12} />
            </View>

            {/* Metrics Row */}
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <View style={{ flex: 1 }}>
                <LoadingSkeleton width="70%" height={10} style={{ marginBottom: 4 }} />
                <LoadingSkeleton width="50%" height={14} />
              </View>
              <View style={{ flex: 1 }}>
                <LoadingSkeleton width="70%" height={10} style={{ marginBottom: 4 }} />
                <LoadingSkeleton width="50%" height={14} />
              </View>
              <View style={{ flex: 1 }}>
                <LoadingSkeleton width="70%" height={10} style={{ marginBottom: 4 }} />
                <LoadingSkeleton width="50%" height={14} />
              </View>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  skeleton: {
    overflow: 'hidden',
  },
  listItem: {
    flexDirection: 'row',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  avatar: {
    marginRight: 12,
  },
  listItemContent: {
    flex: 1,
    justifyContent: 'center',
  },
  card: {
    padding: 16,
    borderRadius: 16,
    marginBottom: 16,
    borderWidth: 1,
  },
  mb8: {
    marginBottom: 8,
  },
  mb12: {
    marginBottom: 12,
  },
  mb16: {
    marginBottom: 16,
  },
  container: {
    flex: 1,
    padding: 16,
  },
  dashboardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24,
  },
  statCard: {
    width: '48%',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  quickAccessSection: {
    marginBottom: 24,
  },
  quickAccessGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  quickAccessCard: {
    width: '23%',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  chartCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
  },
  employeeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
  },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  employeeInfo: {
    marginLeft: 12,
    flex: 1,
  },
  tableContainer: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  tableRow: {
    flexDirection: 'row',
    padding: 12,
    borderTopWidth: 1,
  },
  tableCell: {
    flex: 1,
    paddingHorizontal: 8,
  },
  formContainer: {
    padding: 16,
  },
  formGroup: {
    marginBottom: 20,
  },
  formInput: {
    borderRadius: 8,
    borderWidth: 1,
    overflow: 'hidden',
  },
});
