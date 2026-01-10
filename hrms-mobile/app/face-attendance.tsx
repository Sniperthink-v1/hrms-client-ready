// Face Attendance Screen - Dedicated screen for face attendance features
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { api } from '@/services/api';
import { API_ENDPOINTS } from '@/constants/Config';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { ListItemSkeleton, FormSkeleton } from '@/components/LoadingSkeleton';

export default function FaceAttendanceScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  // Sub-tab state
  const [activeSubTab, setActiveSubTab] = useState<'check-log' | 'registration' | 'recognition'>('check-log');




  const renderFaceCheckLog = () => {
    // Mock data for demonstration - in real implementation, this would fetch from API
    const mockCheckLog = [
      { id: 1, name: 'John Doe', checkIn: '09:15', checkOut: '18:30', status: 'present' },
      { id: 2, name: 'Jane Smith', checkIn: '09:00', checkOut: '17:45', status: 'present' },
      { id: 3, name: 'Bob Johnson', checkIn: '09:30', checkOut: null, status: 'present' },
      { id: 4, name: 'Alice Brown', checkIn: null, checkOut: null, status: 'absent' },
    ];

    const getStatusColor = (status: string) => {
      switch (status) {
        case 'present': return colors.primary;
        case 'absent': return '#ef4444';
        default: return colors.textSecondary;
      }
    };

    const getStatusText = (status: string) => {
      switch (status) {
        case 'present': return 'Present';
        case 'absent': return 'Absent';
        default: return 'Unknown';
      }
    };

    return (
      <View>
        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Daily Check Log</Text>

          <Text style={[styles.label, { color: colors.text, marginBottom: 16 }]}>
            View employee check-in and check-out times for today.
          </Text>

          <View style={[styles.infoBox, { backgroundColor: colors.primary + '15', borderColor: colors.primary + '30' }]}>
            <FontAwesome name="clock-o" size={20} color={colors.primary} style={{ marginBottom: 8 }} />
            <Text style={[styles.infoText, { color: colors.text }]}>
              📊 Today's Attendance Summary:
            </Text>
            <Text style={[styles.infoSubText, { color: colors.textSecondary }]}>
              • Total Employees: {mockCheckLog.length}{'\n'}
              • Checked In: {mockCheckLog.filter(item => item.checkIn).length}{'\n'}
              • Still Working: {mockCheckLog.filter(item => item.checkIn && !item.checkOut).length}
            </Text>
          </View>

          <Text style={[styles.sectionTitle, { color: colors.text, fontSize: 16, marginTop: 20, marginBottom: 12 }]}>
            Today's Check Log
          </Text>

          {mockCheckLog.map((entry) => (
            <View key={entry.id} style={[styles.checkLogItem, { backgroundColor: colors.background, borderColor: colors.border }]}>
              <View style={styles.checkLogHeader}>
                <Text style={[styles.checkLogName, { color: colors.text }]}>{entry.name}</Text>
                <View style={[styles.statusBadge, { backgroundColor: getStatusColor(entry.status) + '20' }]}>
                  <Text style={[styles.statusText, { color: getStatusColor(entry.status) }]}>
                    {getStatusText(entry.status)}
                  </Text>
                </View>
              </View>

              <View style={styles.checkLogTimes}>
                <View style={styles.timeItem}>
                  <FontAwesome name="sign-in" size={14} color={entry.checkIn ? colors.primary : colors.textSecondary} />
                  <Text style={[styles.timeText, { color: entry.checkIn ? colors.text : colors.textSecondary }]}>
                    {entry.checkIn || '--:--'}
                  </Text>
                  <Text style={[styles.timeLabel, { color: colors.textSecondary }]}>Check In</Text>
                </View>

                <View style={styles.timeItem}>
                  <FontAwesome name="sign-out" size={14} color={entry.checkOut ? '#10b981' : colors.textSecondary} />
                  <Text style={[styles.timeText, { color: entry.checkOut ? colors.text : colors.textSecondary }]}>
                    {entry.checkOut || '--:--'}
                  </Text>
                  <Text style={[styles.timeLabel, { color: colors.textSecondary }]}>Check Out</Text>
                </View>
              </View>
            </View>
          ))}

          <TouchableOpacity
            style={[styles.saveButton, { backgroundColor: colors.primary, marginTop: 20 }]}
          >
            <Text style={[styles.saveButtonText, { color: 'white' }]}>Refresh Data</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderFaceRegistration = () => {
    return (
      <View>
        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Face Registration</Text>

          <Text style={[styles.label, { color: colors.text, marginBottom: 16 }]}>
            Manage employee face registration for attendance tracking.
          </Text>

          <View style={[styles.infoBox, { backgroundColor: colors.accent + '15', borderColor: colors.accent + '30' }]}>
            <FontAwesome name="user-plus" size={20} color={colors.accent} style={{ marginBottom: 8 }} />
            <Text style={[styles.infoText, { color: colors.text }]}>
              👤 Face Registration Features:
            </Text>
            <Text style={[styles.infoSubText, { color: colors.textSecondary }]}>
              • Register employee faces for recognition{'\n'}
              • Multiple face angles for better accuracy{'\n'}
              • Quality validation during registration{'\n'}
              • Update existing registrations{'\n'}
              • Bulk registration capabilities
            </Text>
          </View>

          <View style={styles.comingSoonContainer}>
            <FontAwesome name="clock-o" size={48} color={colors.textSecondary} />
            <Text style={[styles.comingSoonTitle, { color: colors.text }]}>Coming Soon</Text>
            <Text style={[styles.comingSoonText, { color: colors.textSecondary }]}>
              Face registration functionality will be available in the next update.
            </Text>
          </View>
        </View>
      </View>
    );
  };

  const renderFaceRecognition = () => {
    return (
      <View>
        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Face Recognition</Text>

          <Text style={[styles.label, { color: colors.text, marginBottom: 16 }]}>
            Monitor and manage face recognition attendance tracking.
          </Text>

          <View style={[styles.infoBox, { backgroundColor: colors.secondary + '15', borderColor: colors.secondary + '30' }]}>
            <FontAwesome name="eye" size={20} color={colors.secondary} style={{ marginBottom: 8 }} />
            <Text style={[styles.infoText, { color: colors.text }]}>
              👁️ Face Recognition Features:
            </Text>
            <Text style={[styles.infoSubText, { color: colors.textSecondary }]}>
              • Real-time face detection and recognition{'\n'}
              • Automatic check-in/check-out{'\n'}
              • Confidence scoring and validation{'\n'}
              • Recognition logs and analytics{'\n'}
              • Failed recognition handling
            </Text>
          </View>

          <View style={styles.comingSoonContainer}>
            <FontAwesome name="clock-o" size={48} color={colors.textSecondary} />
            <Text style={[styles.comingSoonTitle, { color: colors.text }]}>Coming Soon</Text>
            <Text style={[styles.comingSoonText, { color: colors.textSecondary }]}>
              Face recognition functionality will be available in the next update.
            </Text>
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.primary }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <FontAwesome name="arrow-left" size={20} color="white" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Face Attendance</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Sub-tabs */}
      <View style={[styles.subTabContainer, { backgroundColor: colors.surface }]}>
        <TouchableOpacity
          style={[styles.subTab, activeSubTab === 'check-log' && [styles.activeSubTab, { borderBottomColor: colors.primary }]]}
          onPress={() => setActiveSubTab('check-log')}
        >
          <FontAwesome name="clock-o" size={16} color={activeSubTab === 'check-log' ? colors.primary : colors.textSecondary} />
          <Text style={[styles.subTabText, { color: activeSubTab === 'check-log' ? colors.primary : colors.textSecondary }]}>Check Log</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.subTab, activeSubTab === 'registration' && [styles.activeSubTab, { borderBottomColor: colors.primary }]]}
          onPress={() => setActiveSubTab('registration')}
        >
          <FontAwesome name="user-plus" size={16} color={activeSubTab === 'registration' ? colors.primary : colors.textSecondary} />
          <Text style={[styles.subTabText, { color: activeSubTab === 'registration' ? colors.primary : colors.textSecondary }]}>Registration</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.subTab, activeSubTab === 'recognition' && [styles.activeSubTab, { borderBottomColor: colors.primary }]]}
          onPress={() => setActiveSubTab('recognition')}
        >
          <FontAwesome name="eye" size={16} color={activeSubTab === 'recognition' ? colors.primary : colors.textSecondary} />
          <Text style={[styles.subTabText, { color: activeSubTab === 'recognition' ? colors.primary : colors.textSecondary }]}>Recognition</Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      <ScrollView style={styles.content}>
        {activeSubTab === 'check-log' && renderFaceCheckLog()}
        {activeSubTab === 'registration' && renderFaceRegistration()}
        {activeSubTab === 'recognition' && renderFaceRecognition()}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    paddingTop: 50,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'white',
  },
  subTabContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  subTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    marginHorizontal: 4,
    borderRadius: 8,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
    gap: 6,
  },
  activeSubTab: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  subTabText: {
    fontSize: 12,
    fontWeight: '500',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  section: {
    marginBottom: 16,
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
  },
  switchGroup: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  infoBox: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginVertical: 16,
    alignItems: 'center',
  },
  infoText: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'center',
  },
  infoSubText: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  saveButton: {
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  checkLogItem: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
  },
  checkLogHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  checkLogName: {
    fontSize: 16,
    fontWeight: '600',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
  },
  checkLogTimes: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  timeItem: {
    alignItems: 'center',
    flex: 1,
  },
  timeText: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 4,
    marginBottom: 2,
  },
  timeLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
  comingSoonContainer: {
    alignItems: 'center',
    padding: 32,
    marginTop: 16,
  },
  comingSoonTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
  },
  comingSoonText: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
});