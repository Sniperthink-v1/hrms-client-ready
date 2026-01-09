/**
 * No Credits Page Component
 * Shows when tenant has no credits remaining
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAppSelector } from '@/store/hooks';
import { useCredits } from '@/contexts/CreditContext';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

interface FeatureItem {
  name: string;
  icon: string;
  iconType: 'fa' | 'material';
}

const availableFeatures: FeatureItem[] = [
  { name: 'Settings', icon: 'cog', iconType: 'fa' },
  { name: 'Support', icon: 'comments', iconType: 'fa' },
];

const blockedFeatures: FeatureItem[] = [
  { name: 'Employee Management', icon: 'users', iconType: 'fa' },
  { name: 'Attendance Tracking', icon: 'calendar-check-o', iconType: 'fa' },
  { name: 'Payroll Processing', icon: 'money', iconType: 'fa' },
  { name: 'Leave Management', icon: 'file-text-o', iconType: 'fa' },
  { name: 'Reports & Analytics', icon: 'bar-chart', iconType: 'fa' },
  { name: 'Data Upload', icon: 'upload', iconType: 'fa' },
];

export default function NoCreditsPage() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const { tenant } = useAppSelector((state) => state.auth);
  const { refreshCredits } = useCredits();
  const [refreshingCredits, setRefreshingCredits] = useState(false);

  const companyName = tenant?.name || 'your company';

  const handleContactSupport = () => {
    router.push('/support');
  };

  const handleGoToSettings = () => {
    router.push('/settings');
  };

  const handleEmailSupport = () => {
    Linking.openURL('mailto:support@sniperthink.com');
  };

  const handleRefreshCredits = async () => {
    setRefreshingCredits(true);
    try {
      await refreshCredits();
    } catch (error) {
      console.warn('Failed to refresh credits:', error);
    } finally {
      setRefreshingCredits(false);
    }
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.contentContainer}
    >
      {/* Header */}
      <View style={styles.headerSection}>
        <View style={[styles.iconBadge, { backgroundColor: `${colors.error}15` }]}>
          <FontAwesome name="credit-card" size={24} color={colors.error} />
        </View>
        <View style={styles.headerText}>
          <Text style={[styles.title, { color: colors.text }]}>
            Account Credits Depleted
          </Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            {companyName} • No credits remaining
          </Text>
        </View>
      </View>

      {/* Alert Banner */}
      <View style={[styles.alertBanner, { backgroundColor: `${colors.warning}15`, borderLeftColor: colors.warning }]}>
        <FontAwesome name="exclamation-triangle" size={16} color={colors.warning} />
        <Text style={[styles.alertText, { color: colors.warning }]}>
          Contact your administrator to add credits to continue using HR management features.
        </Text>
      </View>

      {/* Features Grid */}
      <View style={styles.featuresContainer}>
        {/* Available Features */}
        <View style={[styles.featureCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.featureHeader}>
            <FontAwesome name="check-circle" size={18} color={colors.success} />
            <Text style={[styles.featureTitle, { color: colors.text }]}>Available</Text>
          </View>
          <View style={styles.featureList}>
            {availableFeatures.map((feature) => (
              <View
                key={feature.name}
                style={[styles.featureItem, { backgroundColor: `${colors.success}10`, borderColor: `${colors.success}30` }]}
              >
                <FontAwesome name={feature.icon as any} size={14} color={colors.success} />
                <Text style={[styles.featureItemText, { color: colors.text }]}>
                  {feature.name}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* Blocked Features */}
        <View style={[styles.featureCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.featureHeader}>
            <FontAwesome name="times-circle" size={18} color={colors.error} />
            <Text style={[styles.featureTitle, { color: colors.text }]}>Unavailable</Text>
          </View>
          <View style={styles.featureList}>
            {blockedFeatures.map((feature) => (
              <View
                key={feature.name}
                style={[styles.featureItem, { backgroundColor: `${colors.error}10`, borderColor: `${colors.error}30` }]}
              >
                <FontAwesome name={feature.icon as any} size={14} color={colors.error} />
                <Text style={[styles.featureItemText, { color: colors.text }]}>
                  {feature.name}
                </Text>
              </View>
            ))}
          </View>
        </View>
      </View>

      {/* Action Buttons */}
      <View style={styles.actionsContainer}>
        <TouchableOpacity
          style={[styles.primaryButton, { backgroundColor: colors.success }]}
          onPress={handleRefreshCredits}
          disabled={refreshingCredits}
        >
          {refreshingCredits ? (
            <ActivityIndicator size="small" color="white" />
          ) : (
            <FontAwesome name="refresh" size={18} color="white" />
          )}
          <Text style={styles.primaryButtonText}>
            {refreshingCredits ? 'Refreshing...' : 'Refresh Credits'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.primaryButton, { backgroundColor: colors.primary }]}
          onPress={handleGoToSettings}
        >
          <FontAwesome name="cog" size={18} color="white" />
          <Text style={styles.primaryButtonText}>Settings</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.primaryButton, { backgroundColor: colors.info }]}
          onPress={handleContactSupport}
        >
          <FontAwesome name="comments" size={18} color="white" />
          <Text style={styles.primaryButtonText}>Contact Support</Text>
        </TouchableOpacity>
      </View>

      {/* Contact Info */}
      <View style={[styles.contactCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.contactTitle, { color: colors.text }]}>Need help?</Text>
        <View style={styles.contactRow}>
          <TouchableOpacity
            style={styles.contactItem}
            onPress={handleEmailSupport}
          >
            <FontAwesome name="envelope" size={14} color={colors.primary} />
            <Text style={[styles.contactLink, { color: colors.primary }]}>
              support@sniperthink.com
            </Text>
          </TouchableOpacity>
          <View style={[styles.contactDivider, { backgroundColor: colors.border }]} />
          <View style={styles.contactItem}>
            <FontAwesome name="phone" size={14} color={colors.textSecondary} />
            <Text style={[styles.contactText, { color: colors.textSecondary }]}>
              Contact Administrator
            </Text>
          </View>
        </View>
      </View>
    </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
  },
  headerSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 12,
  },
  iconBadge: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 12,
  },
  alertBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 12,
    borderLeftWidth: 3,
    borderRadius: 8,
    marginBottom: 16,
    gap: 8,
  },
  alertText: {
    fontSize: 13,
    flex: 1,
    lineHeight: 18,
  },
  featuresContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  featureCard: {
    flex: 1,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  featureHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  featureTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  featureList: {
    gap: 6,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    borderRadius: 6,
    borderWidth: 1,
    gap: 8,
  },
  featureItemText: {
    fontSize: 12,
    flex: 1,
  },
  actionsContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  primaryButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  primaryButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  contactCard: {
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  contactTitle: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 10,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  contactDivider: {
    width: 1,
    height: 16,
    marginHorizontal: 12,
  },
  contactLink: {
    fontSize: 12,
    fontWeight: '500',
  },
  contactText: {
    fontSize: 12,
  },
});
