import React, { useState } from 'react';
import { View, Text, Modal, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, ScrollView } from 'react-native';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { attendanceService } from '@/services/attendanceService';

interface PenaltyRevertModalProps {
  isOpen: boolean;
  onClose: () => void;
  employeeId: string;
  employeeName: string;
  date: string;
  weeklyAbsentThreshold: number | null;
  weeklyAttendance: { [day: string]: boolean };
  initialPenaltyIgnored?: boolean;
  onSuccess?: (newIgnored?: boolean) => void;
}

const PenaltyRevertModal: React.FC<PenaltyRevertModalProps> = ({
  isOpen,
  onClose,
  employeeId,
  employeeName,
  date,
  weeklyAbsentThreshold,
  weeklyAttendance,
  initialPenaltyIgnored,
  onSuccess,
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  if (!isOpen) return null;

  const selectedDate = new Date(date);
  const dayOfWeek = selectedDate.getDay();
  const weekStart = new Date(selectedDate);
  weekStart.setDate(selectedDate.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);

  const dayMap = ['Su', 'M', 'Tu', 'W', 'Th', 'F', 'Sa'];
  const absentCount = Object.entries(weeklyAttendance)
    .filter(([, status]) => status === false)
    .length;

  const threshold = weeklyAbsentThreshold || 4;
  const isThresholdBreached = absentCount >= threshold;

  const formatDate = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const formatDay = (d: Date) => d.toLocaleDateString('en-US', { weekday: 'short' });

  const handleRevertPenalty = async () => {
    try {
      setLoading(true);
      setError(null);

      const result = await attendanceService.revertPenalty(employeeId, date);
      const newIgnored = result?.data?.penalty_ignored;

      if (newIgnored) {
        Alert.alert('Success', `Penalty reverted for ${employeeName} on ${date}.`);
      } else {
        Alert.alert('Success', `Penalty revert undone for ${employeeName} on ${date}.`);
      }

      onClose();
      onSuccess?.(newIgnored);
    } catch (err: any) {
      const message = err.message || 'Failed to revert penalty';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      transparent
      animationType="fade"
      visible={isOpen}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          <View style={[styles.header, { borderBottomColor: colors.border }]}>
            <Text style={[styles.title, { color: colors.text }]}>Penalty Day Information</Text>
            <TouchableOpacity onPress={onClose} disabled={loading}>
              <Text style={[styles.closeText, { color: colors.textSecondary }]}>Close</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.body} contentContainerStyle={{ paddingBottom: 12 }}>
            <Text style={[styles.infoText, { color: colors.textSecondary }]}>Employee: {employeeName} ({employeeId})</Text>
            <Text style={[styles.infoText, { color: colors.textSecondary }]}>Date: {formatDate(selectedDate)} ({formatDay(selectedDate)})</Text>

            <View style={[styles.section, { backgroundColor: colors.divider, borderColor: colors.border }]}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Week Summary ({formatDate(weekStart)} - {formatDate(weekEnd)}):</Text>
              <View style={styles.weekGrid}>
                {dayMap.map((dayCode) => {
                  const status = weeklyAttendance[dayCode];
                  const isAbsent = status === false;
                  const isPresent = status === true;

                  return (
                    <View key={dayCode} style={styles.weekDay}>
                      <Text style={[styles.weekDayLabel, { color: colors.textSecondary }]}>{dayCode}</Text>
                      <View style={[
                        styles.weekDayBadge,
                        isPresent ? { backgroundColor: `${colors.success}20` } : isAbsent ? { backgroundColor: `${colors.error}20` } : { backgroundColor: colors.divider },
                      ]}>
                        <Text style={[styles.weekDayBadgeText, { color: colors.text }]}>
                          {isPresent ? 'P' : isAbsent ? 'A' : '-'}
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>

            <View style={[styles.section, { backgroundColor: colors.divider, borderColor: colors.border }]}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Penalty Status</Text>
              <Text style={[styles.infoText, { color: colors.textSecondary }]}>Absent Count: {absentCount} (Threshold: {threshold})</Text>
              <Text style={[styles.infoText, { color: colors.textSecondary }]}>Penalty Applied: {isThresholdBreached ? 'YES (1 day)' : 'NO'}</Text>
            </View>

            {error && (
              <View style={[styles.errorBox, { backgroundColor: `${colors.error}20` }]}>
                <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
              </View>
            )}

            <View style={[styles.section, { backgroundColor: colors.divider, borderColor: colors.border }]}>
              <Text style={[styles.infoText, { color: colors.textSecondary }]}>
                Reverting the penalty ignores this day in weekly penalty calculations without changing attendance.
              </Text>
            </View>
          </ScrollView>

          <View style={[styles.footer, { borderTopColor: colors.border }]}>
            <TouchableOpacity style={[styles.cancelButton, { borderColor: colors.border }]} onPress={onClose} disabled={loading}>
              <Text style={[styles.cancelText, { color: colors.textSecondary }]}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.saveButton, { backgroundColor: colors.primary }]} onPress={handleRevertPenalty} disabled={loading}>
              {loading ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <Text style={styles.saveText}>{initialPenaltyIgnored ? 'Undo Revert' : 'Revert Penalty'}</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 16,
  },
  card: {
    backgroundColor: Colors.light.surface,
    borderRadius: 12,
    maxHeight: '85%',
  },
  header: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.light.text,
  },
  closeText: {
    color: Colors.light.textSecondary,
    fontSize: 14,
  },
  body: {
    paddingHorizontal: 16,
  },
  infoText: {
    fontSize: 13,
    color: Colors.light.textSecondary,
    marginTop: 8,
  },
  section: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
    color: Colors.light.text,
  },
  weekGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  weekDay: {
    alignItems: 'center',
    width: 30,
  },
  weekDayLabel: {
    fontSize: 11,
    color: Colors.light.textSecondary,
    marginBottom: 4,
  },
  weekDayBadge: {
    paddingVertical: 4,
    paddingHorizontal: 6,
    borderRadius: 6,
  },
  weekDayPresent: {
    backgroundColor: '#DCFCE7',
  },
  weekDayAbsent: {
    backgroundColor: '#FEE2E2',
  },
  weekDayUnmarked: {
    backgroundColor: '#E5E7EB',
  },
  weekDayBadgeText: {
    fontSize: 11,
    color: Colors.light.text,
  },
  errorBox: {
    marginTop: 10,
    padding: 10,
    backgroundColor: '#FEE2E2',
    borderRadius: 8,
  },
  errorText: {
    color: Colors.light.error,
    fontSize: 12,
  },
  footer: {
    flexDirection: 'row',
    gap: 12,
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.light.border,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.light.border,
    alignItems: 'center',
  },
  cancelText: {
    color: Colors.light.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  saveButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: Colors.light.primary,
    alignItems: 'center',
  },
  saveText: {
    color: 'white',
    fontSize: 13,
    fontWeight: '600',
  },
});

export default PenaltyRevertModal;
