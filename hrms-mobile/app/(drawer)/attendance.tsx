// Attendance Log Screen - Redesigned to match web dashboard
import React, { useState, useEffect, useCallback, useMemo, memo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
  FlatList,
} from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { setSelectedDate } from '@/store/slices/attendanceSlice';
import { attendanceService } from '@/services/attendanceService';
import { api } from '@/services/api';
import { API_ENDPOINTS } from '@/constants/Config';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { TrackAttendanceSkeleton } from '@/components/LoadingSkeleton';
import PenaltyRevertModal from '@/components/PenaltyRevertModal';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { format } from 'date-fns';
import { Calendar } from 'react-native-calendars';

// Employee interface
interface Employee {
  id: number;
  employee_id: string;
  first_name?: string;
  last_name?: string;
  name?: string;
  email: string;
  department: string;
  is_active: boolean;
  shift_start_time?: string;
  shift_end_time?: string;
  default_status?: string;
  late_minutes?: number;
  ot_hours?: number;
  has_off_day?: boolean;
  off_monday?: boolean;
  off_tuesday?: boolean;
  off_wednesday?: boolean;
  off_thursday?: boolean;
  off_friday?: boolean;
  off_saturday?: boolean;
  off_sunday?: boolean;
  sunday_bonus?: boolean;
  current_attendance?: {
    status: string;
    ot_hours: number;
    late_minutes: number;
    check_in?: string;
    check_out?: string;
  };
}

// Attendance entry interface
interface AttendanceEntry {
  employee_id: string;
  name: string;
  department: string;
  status: 'present' | 'absent' | 'off' | 'unmarked';
  clock_in: string;
  clock_out: string;
  ot_hours: number;
  late_minutes: number;
  has_off_day: boolean;
  sunday_bonus?: boolean;
  weeklyAttendance: { [day: string]: boolean };
  autoMarkedReasons?: { [day: string]: string | null };
  penaltyIgnoredDays?: { [day: string]: boolean };
  weekly_penalty_days?: number;
  employee_off_days?: { [day: string]: boolean };
  _shiftStart?: string;
  _shiftEnd?: string;
  _prevClockIn?: string;
  _prevClockOut?: string;
  _prevOt?: number;
  _prevLate?: number;
}

// Attendance record interface for tracker
interface AttendanceRecord {
  id: number;
  employee_id: string;
  name: string;
  department?: string;
  date: string;
  calendar_days: number;
  off_days?: number;
  total_working_days: number;
  present_days: number;
  absent_days: number;
  unmarked_days?: number;
  holiday_days?: number;
  weekly_penalty_days?: number;
  status?: string;
  attendance_percentage?: number;
  ot_hours: string | number;
  late_minutes: number;
}

// KPI Totals interface
interface KpiTotals {
  total_employees?: number;
  total_present?: number;
  total_absent?: number;
  total_ot_hours?: number;
  total_late_minutes?: number;
  total_present_days?: number;
  total_working_days?: number;
  avg_working_days?: number;
  avg_present_days?: number;
  avg_attendance_percentage?: number;
  absentees_count?: number;
  presentees_count?: number;
  unmarked_count?: number;
}

// API Response interface
interface AttendanceApiResponse {
  results: AttendanceRecord[];
  count?: number;
  total_count?: number;
  kpi_totals?: KpiTotals | null;
}

// Filter type
type FilterType = 'one_day' | 'custom_month' | 'last_6_months' | 'last_12_months' | 'last_5_years' | 'custom_range';

// Month names
const monthNames = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

// Track Attendance Tab Component
const TrackAttendanceTab: React.FC<{
  colors: any;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
}> = memo(({ colors, searchQuery, setSearchQuery }) => {
  const [attendanceData, setAttendanceData] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<FilterType>('custom_month');
  const [selectedDepartment, setSelectedDepartment] = useState<string>('all');
  const [departments, setDepartments] = useState<string[]>([]);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<string>(monthNames[new Date().getMonth()]);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [rangeStartDate, setRangeStartDate] = useState<string>('');
  const [rangeEndDate, setRangeEndDate] = useState<string>('');
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [showMonthModal, setShowMonthModal] = useState(false);
  const [showYearModal, setShowYearModal] = useState(false);
  const [showDateModal, setShowDateModal] = useState(false);
  
  // Progressive loading state
  const [progressiveLoadingComplete, setProgressiveLoadingComplete] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  
  // KPI totals
  const [kpiTotals, setKpiTotals] = useState<KpiTotals | null>(null);

  // Generate years
  const currentYear = new Date().getFullYear();
  const availableYears = Array.from({ length: 8 }, (_, i) => currentYear + 2 - i);

  // Filter options
  const filterTypeOptions = [
    { value: 'one_day', label: 'One Day' },
    { value: 'custom_month', label: 'Custom Month' },
    { value: 'last_6_months', label: 'Last 6 Months' },
    { value: 'last_12_months', label: 'Last 12 Months' },
    { value: 'last_5_years', label: 'Last 5 Years' },
    { value: 'custom_range', label: 'Custom Range' },
  ];

  // PROGRESSIVE LOADING: Fetch attendance data
  const fetchAttendanceData = useCallback(async () => {
    try {
      setLoading(true);
      setProgressiveLoadingComplete(false);
      
      console.log('🚀 PROGRESSIVE LOADING: Starting Track Attendance fetch');
      
      // Build query parameters
      const params = new URLSearchParams();
      
      if (filterType === 'custom_month' && selectedMonth && selectedYear) {
        params.append('time_period', 'custom');
        const monthIndex = monthNames.indexOf(selectedMonth) + 1;
        params.append('month', monthIndex.toString());
        params.append('year', selectedYear.toString());
      } else if (filterType === 'one_day' && selectedDate) {
        params.append('time_period', 'custom_range');
        params.append('start_date', selectedDate);
        params.append('end_date', selectedDate);
      } else if (filterType === 'custom_range' && rangeStartDate && rangeEndDate) {
        params.append('time_period', 'custom_range');
        params.append('start_date', rangeStartDate);
        params.append('end_date', rangeEndDate);
      } else {
        params.append('time_period', filterType);
      }
      
      // STEP 1: Load initial batch (500 records)
      params.append('offset', '0');
      params.append('limit', '500');
      params.append('initial', 'true');
      
      const url = `${API_ENDPOINTS.dailyAttendance}all_records/?${params.toString()}`;
      console.log('📋 Loading initial batch...');
      const response = await api.get<AttendanceApiResponse>(url);
      
      if (response && response.results) {
        const firstBatch = response.results;
        const total = response.count || response.total_count || firstBatch.length;
        
        console.log(`✅ Loaded ${firstBatch.length} of ${total} records`);
        
        setAttendanceData(firstBatch);
        setKpiTotals(response.kpi_totals || null);
        setTotalCount(total);
        setLoading(false); // User can start viewing immediately
        
        // Extract departments
        const deptSet = new Set<string>(['all']);
        response.results.forEach((record: AttendanceRecord) => {
          if (record.department) deptSet.add(record.department);
        });
        setDepartments(Array.from(deptSet));
        
        // STEP 2: Auto-trigger background loading if there are more records
        if (firstBatch.length < total) {
          const remainingCount = total - firstBatch.length;
          console.log(`🔄 Auto-triggering background load for ${remainingCount} remaining records...`);
          
          setTimeout(async () => {
            await loadRemainingRecords(params, firstBatch, total);
          }, 100);
        } else {
          setProgressiveLoadingComplete(true);
        }
      } else {
        setLoading(false);
      }
    } catch (error) {
      console.error('Error fetching attendance data:', error);
      setLoading(false);
      setProgressiveLoadingComplete(true);
    }
  }, [filterType, selectedMonth, selectedYear, selectedDate, rangeStartDate, rangeEndDate]);

  // STEP 2: Load remaining records in background
  const loadRemainingRecords = async (params: URLSearchParams, initialRecords: AttendanceRecord[], total: number) => {
    try {
      setLoadingMore(true);
      console.log('📋 Background loading additional records...');
      
      // Remove initial flag and update limit
      params.delete('initial');
      params.set('offset', initialRecords.length.toString());
      params.set('limit', '0'); // Fetch all remaining
      
      const url = `${API_ENDPOINTS.dailyAttendance}all_records/?${params.toString()}`;
      const response = await api.get<AttendanceApiResponse>(url);
      
      if (response && response.results) {
        const remainingRecords = response.results;
        console.log(`✅ Loaded ${remainingRecords.length} additional records`);
        
        const allRecords = [...initialRecords, ...remainingRecords];
        setAttendanceData(allRecords);
        
        // Update departments with all records
        const deptSet = new Set<string>(['all']);
        allRecords.forEach((record: AttendanceRecord) => {
          if (record.department) deptSet.add(record.department);
        });
        setDepartments(Array.from(deptSet));
        
        console.log(`🎉 Progressive loading complete: ${allRecords.length} total records loaded`);
        setProgressiveLoadingComplete(true);
      }
      
      setLoadingMore(false);
    } catch (error) {
      console.error('❌ Background loading failed:', error);
      setProgressiveLoadingComplete(true);
      setLoadingMore(false);
    }
  };

  // Load data on mount and filter changes
  useEffect(() => {
    fetchAttendanceData();
  }, [fetchAttendanceData]);

  // Filter data by search and department
  const filteredData = useMemo(() => {
    return attendanceData.filter(record => {
      // Skip if record is invalid
      if (!record) return false;
      
      // Ensure required fields exist
      const recordName = record.name || '';
      const recordId = record.employee_id || '';
      
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesSearch = 
          (recordName && recordName.toLowerCase().includes(query)) ||
          (recordId && recordId.toLowerCase().includes(query));
        if (!matchesSearch) return false;
      }
      
      // Department filter
      if (selectedDepartment && selectedDepartment !== 'all') {
        const recordDept = record.department || 'N/A';
        if (recordDept !== selectedDepartment) return false;
      }
      
      return true;
    });
  }, [attendanceData, searchQuery, selectedDepartment]);

  // Calculate KPIs
  const isFiltered = searchQuery !== '' || selectedDepartment !== 'all';
  
  const totalEmployees = kpiTotals && !isFiltered ? (kpiTotals.total_employees ?? filteredData.length) : filteredData.length;
  const totalOtHours = kpiTotals && !isFiltered ? (kpiTotals.total_ot_hours ?? 0) : filteredData.reduce((sum, r) => sum + (typeof r.ot_hours === 'string' ? parseFloat(r.ot_hours) || 0 : r.ot_hours), 0);
  const totalLateMinutes = kpiTotals && !isFiltered ? (kpiTotals.total_late_minutes ?? 0) : filteredData.reduce((sum, r) => sum + (r.late_minutes || 0), 0);
  const totalPresentDays = kpiTotals && !isFiltered ? (kpiTotals.total_present_days ?? 0) : filteredData.reduce((sum, r) => sum + (r.present_days || 0), 0);
  const totalWorkingDays = kpiTotals && !isFiltered ? (kpiTotals.total_working_days ?? 0) : filteredData.reduce((sum, r) => sum + (r.total_working_days || 0), 0);
  const avgPresentPerc = kpiTotals && !isFiltered ? (kpiTotals.avg_attendance_percentage ?? 0) : (totalWorkingDays > 0 ? (totalPresentDays / totalWorkingDays) * 100 : 0);
  const avgWorkingDays = totalEmployees > 0 ? totalWorkingDays / totalEmployees : 0;
  const avgPresentDays = totalEmployees > 0 ? totalPresentDays / totalEmployees : 0;

  return (
    <View style={styles.trackAttendanceContainer}>
      {/* Tracker header */}
      <View style={styles.trackHeader}>
        <Text style={[styles.trackTitle, { color: colors.text }]}>Attendance Tracker</Text>
        <Text style={[styles.trackSubtitle, { color: colors.textSecondary }]}>
          Analyse attendance trends across months and departments
        </Text>
      </View>

      {/* Filters Section */}
      <View style={styles.trackFiltersContainer}>
        {/* Filter Type and Department */}
        <View style={styles.filterRow}>
          <TouchableOpacity
            style={[styles.filterButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={() => setShowFilterModal(true)}
          >
            <FontAwesome name="filter" size={14} color={colors.primary} />
            <Text style={[styles.filterButtonText, { color: colors.text }]}>
              {filterTypeOptions.find(f => f.value === filterType)?.label || 'Filter'}
            </Text>
            <FontAwesome name="chevron-down" size={10} color={colors.textSecondary} />
          </TouchableOpacity>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.departmentScroll}>
            {departments.map((dept) => (
              <TouchableOpacity
                key={dept}
                style={[
                  styles.departmentChip,
                  {
                    backgroundColor: selectedDepartment === dept ? colors.primary : colors.surface,
                    borderColor: selectedDepartment === dept ? colors.primary : colors.border,
                  },
                ]}
                onPress={() => setSelectedDepartment(dept)}
              >
                <Text
                  style={[
                    styles.departmentChipText,
                    { color: selectedDepartment === dept ? 'white' : colors.text },
                  ]}
                >
                  {dept === 'all' ? 'All Departments' : dept}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Date/Month/Range Selection based on filter type */}
        {filterType === 'custom_month' && (
          <View style={styles.dateSelectionRow}>
            <TouchableOpacity
              style={[styles.dateSelectButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
              onPress={() => setShowYearModal(true)}
            >
              <Text style={[styles.dateSelectButtonText, { color: colors.text }]}>{selectedYear}</Text>
              <FontAwesome name="chevron-down" size={10} color={colors.textSecondary} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.dateSelectButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
              onPress={() => setShowMonthModal(true)}
            >
              <Text style={[styles.dateSelectButtonText, { color: colors.text }]}>{selectedMonth}</Text>
              <FontAwesome name="chevron-down" size={10} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
        )}

        {filterType === 'one_day' && (
          <View style={styles.dateSelectionRow}>
            <TouchableOpacity
              style={[styles.dateSelectButtonFull, { backgroundColor: colors.surface, borderColor: colors.border }]}
              onPress={() => setShowDateModal(true)}
            >
              <FontAwesome name="calendar" size={14} color={colors.primary} />
              <Text style={[styles.dateSelectButtonText, { color: colors.text }]}>
                {selectedDate ? format(new Date(selectedDate), 'dd MMM yyyy') : 'Select Date'}
              </Text>
              <FontAwesome name="chevron-down" size={10} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* KPI Cards */}
      {loading ? (
        <ScrollView contentContainerStyle={{ paddingBottom: 16 }}>
          <TrackAttendanceSkeleton />
        </ScrollView>
      ) : filterType === 'one_day' ? (
        <View style={styles.kpiContainer}>
          <View style={[styles.kpiCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.kpiLabel, { color: colors.textSecondary }]}>Total Employees</Text>
            <Text style={[styles.kpiValue, { color: colors.primary }]}>{totalEmployees}</Text>
          </View>
          <View style={[styles.kpiCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.kpiLabel, { color: colors.textSecondary }]}>Present</Text>
            <Text style={[styles.kpiValue, { color: colors.success }]}>
              {kpiTotals && !isFiltered && kpiTotals.presentees_count !== undefined
                ? kpiTotals.presentees_count
                : filteredData.filter(r => r.present_days > 0).length}
            </Text>
          </View>
          <View style={[styles.kpiCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.kpiLabel, { color: colors.textSecondary }]}>Absent</Text>
            <Text style={[styles.kpiValue, { color: colors.error }]}>
              {kpiTotals && !isFiltered && kpiTotals.absentees_count !== undefined
                ? kpiTotals.absentees_count
                : filteredData.filter(r => r.absent_days > 0).length}
            </Text>
          </View>
        </View>
      ) : (
        <View style={styles.kpiContainer}>
          <View style={[styles.kpiCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.kpiLabel, { color: colors.textSecondary }]}>Total Employees</Text>
            <Text style={[styles.kpiValue, { color: colors.primary }]}>{totalEmployees}</Text>
          </View>
          <View style={[styles.kpiCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.kpiLabel, { color: colors.textSecondary }]}>Total OT Hours</Text>
            <Text style={[styles.kpiValue, { color: colors.primary }]}>{totalOtHours.toFixed(1)}</Text>
          </View>
          <View style={[styles.kpiCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.kpiLabel, { color: colors.textSecondary }]}>Late Minutes</Text>
            <Text style={[styles.kpiValue, { color: colors.primary }]}>{totalLateMinutes.toFixed(0)}</Text>
          </View>
          <View style={[styles.kpiCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.kpiLabel, { color: colors.textSecondary }]}>Avg Working Days</Text>
            <Text style={[styles.kpiValue, { color: colors.primary }]}>{avgWorkingDays.toFixed(1)}</Text>
          </View>
          <View style={[styles.kpiCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.kpiLabel, { color: colors.textSecondary }]}>Avg Present Days</Text>
            <Text style={[styles.kpiValue, { color: colors.primary }]}>{avgPresentDays.toFixed(1)}</Text>
          </View>
          <View style={[styles.kpiCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.kpiLabel, { color: colors.textSecondary }]}>Avg Present %</Text>
            <Text style={[styles.kpiValue, { color: colors.primary }]}>{avgPresentPerc.toFixed(1)}%</Text>
          </View>
        </View>
      )}

      {/* Attendance Data - mobile friendly cards instead of a wide table */}
      {!loading && (
        filteredData.length === 0 ? (
          <View style={styles.emptyContainer}>
            <FontAwesome name="inbox" size={48} color={colors.textSecondary} />
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              No attendance records found
            </Text>
          </View>
        ) : (
          <FlatList
            data={filteredData}
            keyExtractor={(item) => item.id?.toString() || item.employee_id}
            style={styles.attendanceCardsContainer}
            removeClippedSubviews={true}
            maxToRenderPerBatch={20}
            updateCellsBatchingPeriod={100}
            initialNumToRender={15}
            windowSize={5}
            ListFooterComponent={
              loadingMore ? (
                <View style={{ padding: 16, alignItems: 'center' }}>
                  <ActivityIndicator size="small" color={colors.primary} />
                  <Text style={{ color: colors.textSecondary, marginTop: 8, fontSize: 12 }}>
                    Loading more records...
                  </Text>
                </View>
              ) : progressiveLoadingComplete && filteredData.length > 0 ? (
                <View style={{ padding: 16, alignItems: 'center' }}>
                  <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
                    ✓ All {filteredData.length} records loaded
                  </Text>
                </View>
              ) : null
            }
            renderItem={({ item: record }) => {
              const attendancePercentage = record.total_working_days > 0 
                ? (record.present_days / record.total_working_days) * 100 
                : 0;

              return (
                <View
                  style={[
                    styles.attendanceCard,
                    { backgroundColor: colors.surface, borderColor: colors.border },
                  ]}
                >
                  {/* Top row: name + status */}
                  <View style={styles.attendanceCardHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.attendanceName, { color: colors.text }]} numberOfLines={1}>
                        {record.name}
                      </Text>
                      <Text style={[styles.attendanceSub, { color: colors.textSecondary }]} numberOfLines={1}>
                        {record.employee_id} • {record.department || 'N/A'}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.attendanceStatusPill,
                        {
                          backgroundColor:
                            record.status === 'present'
                              ? `${colors.success}20`
                              : record.status === 'absent'
                              ? `${colors.error}20`
                              : `${colors.warning}20`,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.attendanceStatusText,
                          {
                            color:
                              record.status === 'present'
                                ? colors.success
                                : record.status === 'absent'
                                ? colors.error
                                : colors.warning,
                          },
                        ]}
                      >
                        {record.status || (record.present_days > 0 ? 'Present' : 'Absent')}
                      </Text>
                    </View>
                  </View>

                  {/* Metrics grid */}
                  <View style={styles.attendanceMetricsRow}>
                    <View style={styles.attendanceMetric}>
                      <Text style={[styles.metricLabelSmall, { color: colors.textSecondary }]}>
                        Working Days
                      </Text>
                      <Text style={[styles.metricValueSmall, { color: colors.text }]}>
                        {record.total_working_days?.toFixed
                          ? record.total_working_days.toFixed(0)
                          : record.total_working_days || 0}
                      </Text>
                    </View>
                    <View style={styles.attendanceMetric}>
                      <Text style={[styles.metricLabelSmall, { color: colors.textSecondary }]}>
                        Present
                      </Text>
                      <Text style={[styles.metricValueSmall, { color: colors.text }]}>
                        {record.present_days?.toFixed
                          ? record.present_days.toFixed(1)
                          : record.present_days || 0}
                      </Text>
                    </View>
                    <View style={styles.attendanceMetric}>
                      <Text style={[styles.metricLabelSmall, { color: colors.textSecondary }]}>
                        Absent
                      </Text>
                      <Text style={[styles.metricValueSmall, { color: colors.text }]}>
                        {record.absent_days?.toFixed
                          ? record.absent_days.toFixed(1)
                          : record.absent_days || 0}
                      </Text>
                    </View>
                    <View style={styles.attendanceMetric}>
                      <Text style={[styles.metricLabelSmall, { color: colors.textSecondary }]}>
                        OT Hrs
                      </Text>
                      <Text style={[styles.metricValueSmall, { color: colors.text }]}>
                        {(typeof record.ot_hours === 'string'
                          ? parseFloat(record.ot_hours) || 0
                          : record.ot_hours || 0
                        ).toFixed(1)}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.attendanceMetricsRow}>
                    <View style={styles.attendanceMetric}>
                      <Text style={[styles.metricLabelSmall, { color: colors.textSecondary }]}>
                        Late (min)
                      </Text>
                      <Text style={[styles.metricValueSmall, { color: colors.text }]}>
                        {(typeof record.late_minutes === 'string'
                          ? parseFloat(record.late_minutes) || 0
                          : record.late_minutes || 0
                        ).toFixed(0)}
                      </Text>
                    </View>
                    <View style={styles.attendanceMetric}>
                      <Text style={[styles.metricLabelSmall, { color: colors.textSecondary }]}>
                        Off Days
                      </Text>
                      <Text style={[styles.metricValueSmall, { color: colors.text }]}>
                        {record.off_days || 0}
                      </Text>
                    </View>
                    <View style={styles.attendanceMetric}>
                      <Text style={[styles.metricLabelSmall, { color: colors.textSecondary }]}>
                        Holidays
                      </Text>
                      <Text style={[styles.metricValueSmall, { color: colors.text }]}>
                        {record.holiday_days || 0}
                      </Text>
                    </View>
                    <View style={styles.attendanceMetric}>
                      <Text style={[styles.metricLabelSmall, { color: colors.textSecondary }]}>
                        Present %
                      </Text>
                      <Text
                        style={[
                          styles.metricValueSmall,
                          {
                            color:
                              attendancePercentage >= 90
                                ? colors.success
                                : attendancePercentage >= 75
                                ? colors.warning
                                : colors.error,
                          },
                        ]}
                      >
                        {attendancePercentage.toFixed(1)}%
                      </Text>
                    </View>
                  </View>
                </View>
              );
            }}
          />
        )
      )}

      {/* Filter Type Modal */}
      <Modal
        visible={showFilterModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowFilterModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowFilterModal(false)}
        >
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Select Filter</Text>
            {filterTypeOptions.map((option) => (
              <TouchableOpacity
                key={option.value}
                style={[
                  styles.modalOption,
                  {
                    backgroundColor: filterType === option.value ? `${colors.primary}20` : 'transparent',
                    borderLeftWidth: filterType === option.value ? 4 : 0,
                    borderLeftColor: filterType === option.value ? colors.primary : 'transparent',
                  },
                ]}
                onPress={() => {
                  setFilterType(option.value as FilterType);
                  setShowFilterModal(false);
                }}
              >
                <Text style={[styles.modalOptionText, { color: filterType === option.value ? colors.primary : colors.text }]}>
                  {option.label}
                </Text>
                {filterType === option.value && <FontAwesome name="check" size={16} color={colors.primary} />}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Year Modal */}
      <Modal
        visible={showYearModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowYearModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowYearModal(false)}
        >
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Select Year</Text>
            {availableYears.map((year) => (
              <TouchableOpacity
                key={year}
                style={[
                  styles.modalOption,
                  {
                    backgroundColor: selectedYear === year ? `${colors.primary}20` : 'transparent',
                    borderLeftWidth: selectedYear === year ? 4 : 0,
                    borderLeftColor: selectedYear === year ? colors.primary : 'transparent',
                  },
                ]}
                onPress={() => {
                  setSelectedYear(year);
                  setShowYearModal(false);
                }}
              >
                <Text style={[styles.modalOptionText, { color: selectedYear === year ? colors.primary : colors.text }]}>
                  {year}
                </Text>
                {selectedYear === year && <FontAwesome name="check" size={16} color={colors.primary} />}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Month Modal */}
      <Modal
        visible={showMonthModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowMonthModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowMonthModal(false)}
        >
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Select Month</Text>
            {monthNames.map((month) => (
              <TouchableOpacity
                key={month}
                style={[
                  styles.modalOption,
                  {
                    backgroundColor: selectedMonth === month ? `${colors.primary}20` : 'transparent',
                    borderLeftWidth: selectedMonth === month ? 4 : 0,
                    borderLeftColor: selectedMonth === month ? colors.primary : 'transparent',
                  },
                ]}
                onPress={() => {
                  setSelectedMonth(month);
                  setShowMonthModal(false);
                }}
              >
                <Text style={[styles.modalOptionText, { color: selectedMonth === month ? colors.primary : colors.text }]}>
                  {month}
                </Text>
                {selectedMonth === month && <FontAwesome name="check" size={16} color={colors.primary} />}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
});

TrackAttendanceTab.displayName = 'TrackAttendanceTab';

export default function AttendanceScreen() {
  const dispatch = useAppDispatch();
  const { dailyRecords, selectedDate, isLoading } = useAppSelector((state) => state.attendance);
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  // Main state
  const [activeTab, setActiveTab] = useState<'log' | 'tracker'>('log');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState('All');
  const [dayName, setDayName] = useState('');
  
  // Employee and attendance data
  const [eligibleEmployees, setEligibleEmployees] = useState<Employee[]>([]);
  const [attendanceEntries, setAttendanceEntries] = useState<Map<string, AttendanceEntry>>(new Map());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Progressive loading state
  const [progressiveLoadingComplete, setProgressiveLoadingComplete] = useState(false);
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  
  // UI state
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const [departments, setDepartments] = useState<string[]>(['All']);
  const [hasExcelAttendance, setHasExcelAttendance] = useState(false);
  const [isHoliday, setIsHoliday] = useState(false);
  const [holidayInfo, setHolidayInfo] = useState<{name: string; description?: string; type: string} | null>(null);
  const [attendanceDates, setAttendanceDates] = useState<string[]>([]);
  const [calendarMonth, setCalendarMonth] = useState<{ month: string; year: number }>(() => {
    const now = new Date();
    return { month: String(now.getMonth() + 1).padStart(2, '0'), year: now.getFullYear() };
  });
  const lastWeeklyFetchDateRef = useRef<string | null>(null);
  const [weeklyAbsentThreshold, setWeeklyAbsentThreshold] = useState<number | null>(null);
  const [employeeOffDaysCache, setEmployeeOffDaysCache] = useState<Map<string, { [day: string]: boolean }>>(new Map());
  const [penaltyModalOpen, setPenaltyModalOpen] = useState(false);
  const [selectedPenaltyEmployee, setSelectedPenaltyEmployee] = useState<{
    employeeId: string;
    employeeName: string;
    weeklyAttendance: { [day: string]: boolean };
    penaltyDayCode?: string;
    initialPenaltyIgnored?: boolean;
  } | null>(null);
  const [revertedPenaltyChips, setRevertedPenaltyChips] = useState<Set<string>>(new Set());

  // Handle date selection
  const handleDateSelect = (date: string) => {
    dispatch(setSelectedDate(date));
    setShowDatePicker(false);
    setShowCalendar(false);
    setRevertedPenaltyChips(new Set());
  };

  // Fetch attendance dates for calendar dots
  const fetchAttendanceDates = useCallback(async (month: string, year: number) => {
    try {
      const response: any = await api.get('/api/attendance/dates_with_attendance/');
      const rawDates = Array.isArray(response)
        ? response
        : response.dates || response.results || response.data?.dates || [];
      const filteredDates = rawDates.filter((dateString: string) => {
        const [yy, mm] = String(dateString).split('-');
        return yy === year.toString() && mm === month;
      });
      setAttendanceDates(filteredDates);
      return;
    } catch (error) {
      console.log('Attendance dates endpoint not available, trying fallback');
    }

    try {
      const response: any = await api.get(`/api/attendance-dates/?month=${month}&year=${year}`);
      const rawDates = Array.isArray(response)
        ? response
        : response.dates || response.results || response.data?.dates || [];
      setAttendanceDates(rawDates);
    } catch (error) {
      console.log('Attendance dates fallback endpoint not available');
      setAttendanceDates([]);
    }
  }, []);

  // Fetch attendance dates when month changes
  useEffect(() => {
    if (selectedDate) {
      const date = new Date(selectedDate);
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const year = date.getFullYear();
      setCalendarMonth({ month, year });
      fetchAttendanceDates(month, year);
    }
  }, [selectedDate, fetchAttendanceDates]);

  // PROGRESSIVE LOADING: Fetch eligible employees for the selected date
  const fetchEligibleEmployees = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      setProgressiveLoadingComplete(false);
      
      if (!selectedDate) {
        setError('Please select a date');
        setLoading(false);
        return;
      }
      
      console.log('🚀 PROGRESSIVE LOADING: Starting for', selectedDate);
      
      // STEP 1: Load initial batch of employees (fast response)
      console.log('📋 Loading initial employee data...');
      const initialResponse: any = await api.get(`/api/eligible-employees/?date=${selectedDate}&initial=true`);
      
      const initialData: any = initialResponse;
      const firstBatch = initialData.eligible_employees || [];
      const dayNameFromAPI = initialData.day_name || '';
      const totalEmployees = initialData.total_count || firstBatch.length;

      if (!Array.isArray(firstBatch) || firstBatch.length === 0) {
        throw new Error('Eligible employees API returned no records for this date');
      }
      
      console.log(`✅ Loaded ${firstBatch.length} of ${totalEmployees} employees`);
      
      // Check for Excel attendance and holidays
      try {
        const [excelResponse, holidayResponse] = await Promise.all([
          attendanceService.checkExcelAttendance(selectedDate).catch(() => ({ has_excel: false })),
          attendanceService.checkHoliday(selectedDate).catch(() => ({ is_holiday: false })),
        ]);
        
        setHasExcelAttendance(excelResponse?.has_excel || initialData.has_excel_attendance || false);
        setIsHoliday(holidayResponse?.is_holiday || false);
        setHolidayInfo(holidayResponse?.holiday_info || null);
      } catch (err) {
        console.log('Excel/holiday check endpoints not available, using defaults');
        setHasExcelAttendance(initialData.has_excel_attendance || false);
        setIsHoliday(false);
        setHolidayInfo(null);
      }
      
      // Set initial employees immediately for instant UI update
      const getHasOffDayForDate = (emp: any, date: string) => {
        const flags = [
          emp.off_monday,
          emp.off_tuesday,
          emp.off_wednesday,
          emp.off_thursday,
          emp.off_friday,
          emp.off_saturday,
          emp.off_sunday,
        ];
        const hasAnyFlag = flags.some((val) => typeof val === 'boolean');
        if (!hasAnyFlag) return !!emp.has_off_day;
        const dayIndex = new Date(date).getDay(); // 0=Sun..6=Sat
        const dayMap = ['off_sunday', 'off_monday', 'off_tuesday', 'off_wednesday', 'off_thursday', 'off_friday', 'off_saturday'] as const;
        const key = dayMap[dayIndex];
        return !!emp[key];
      };

      const employees = firstBatch.map((emp: any) => ({
        id: emp.id,
        employee_id: emp.employee_id,
        first_name: emp.first_name,
        last_name: emp.last_name,
        name: emp.first_name && emp.last_name ? `${emp.first_name} ${emp.last_name}` : emp.name,
        email: emp.email,
        department: emp.department,
        is_active: emp.is_active,
        shift_start_time: emp.shift_start_time || '09:00',
        shift_end_time: emp.shift_end_time || '18:00',
        default_status: emp.default_status,
        late_minutes: emp.late_minutes || 0,
        ot_hours: emp.ot_hours || 0,
        has_off_day: getHasOffDayForDate(emp, selectedDate),
        off_monday: emp.off_monday || false,
        off_tuesday: emp.off_tuesday || false,
        off_wednesday: emp.off_wednesday || false,
        off_thursday: emp.off_thursday || false,
        off_friday: emp.off_friday || false,
        off_saturday: emp.off_saturday || false,
        off_sunday: emp.off_sunday || false,
        sunday_bonus: emp.sunday_bonus || false,
        current_attendance: emp.current_attendance,
      }));
      
      setEligibleEmployees(employees);
      setDayName(dayNameFromAPI);
      initializeAttendanceEntries(employees);
      setLoading(false); // User can start working immediately
      setInitialLoadComplete(true);
      setTotalCount(totalEmployees);
      
      // Extract departments
      const deptSet = new Set(['All']);
      employees.forEach((emp: Employee) => {
        if (emp.department) deptSet.add(emp.department);
      });
      setDepartments(Array.from(deptSet));
      
      // STEP 2: Auto-trigger background loading if there are more employees
      if (initialData.progressive_loading?.has_more) {
        const remainingCount = initialData.progressive_loading.remaining_employees;
        console.log(`🔄 Auto-triggering background load for ${remainingCount} remaining employees...`);
        
        const delay = initialData.progressive_loading.recommended_delay_ms || 100;
        setTimeout(async () => {
          await loadRemainingEmployees(selectedDate, employees);
        }, delay);
      } else {
        setProgressiveLoadingComplete(true);
      }
      
      setError(null);
    } catch (err: any) {
      console.error('Error fetching eligible employees:', err);
      setError(err.message || 'Failed to load employees');
      setLoading(false);
    }
  }, [selectedDate]);

  // STEP 2: Load remaining employees in background
  const loadRemainingEmployees = async (date: string, initialEmployees: Employee[]) => {
    try {
      setLoadingMore(true);
      console.log(`📋 Background loading additional data for ${date}...`);
      
      const response: any = await api.get(`/api/eligible-employees/?date=${date}&remaining=true`);
      const remainingEmployees = response.eligible_employees || response.results || [];
      
      console.log(`✅ Loaded ${remainingEmployees.length} additional employees`);
      
      const getHasOffDayForDate = (emp: any, date: string) => {
        const flags = [
          emp.off_monday,
          emp.off_tuesday,
          emp.off_wednesday,
          emp.off_thursday,
          emp.off_friday,
          emp.off_saturday,
          emp.off_sunday,
        ];
        const hasAnyFlag = flags.some((val) => typeof val === 'boolean');
        if (!hasAnyFlag) return !!emp.has_off_day;
        const dayIndex = new Date(date).getDay(); // 0=Sun..6=Sat
        const dayMap = ['off_sunday', 'off_monday', 'off_tuesday', 'off_wednesday', 'off_thursday', 'off_friday', 'off_saturday'] as const;
        const key = dayMap[dayIndex];
        return !!emp[key];
      };

      const allEmployees = [...initialEmployees, ...remainingEmployees.map((emp: any) => ({
        id: emp.id,
        employee_id: emp.employee_id,
        first_name: emp.first_name,
        last_name: emp.last_name,
        name: emp.first_name && emp.last_name ? `${emp.first_name} ${emp.last_name}` : emp.name,
        email: emp.email,
        department: emp.department,
        is_active: emp.is_active,
        shift_start_time: emp.shift_start_time || '09:00',
        shift_end_time: emp.shift_end_time || '18:00',
        default_status: emp.default_status,
        late_minutes: emp.late_minutes || 0,
        ot_hours: emp.ot_hours || 0,
        has_off_day: getHasOffDayForDate(emp, date),
        off_monday: emp.off_monday || false,
        off_tuesday: emp.off_tuesday || false,
        off_wednesday: emp.off_wednesday || false,
        off_thursday: emp.off_thursday || false,
        off_friday: emp.off_friday || false,
        off_saturday: emp.off_saturday || false,
        off_sunday: emp.off_sunday || false,
        sunday_bonus: emp.sunday_bonus || false,
        current_attendance: emp.current_attendance,
      }))];
      
      setEligibleEmployees(allEmployees);
      initializeAttendanceEntries(allEmployees);
      
      console.log(`🎉 Progressive loading complete: ${allEmployees.length} total records loaded`);
      setProgressiveLoadingComplete(true);
      setLoadingMore(false);
    } catch (error) {
      console.error('❌ Background loading failed:', error);
      setProgressiveLoadingComplete(true);
      setLoadingMore(false);
    }
  };

  // Initialize attendance entries for employees
  const initializeAttendanceEntries = (employees: Employee[]) => {
    setAttendanceEntries((prev) => {
      const newEntries = new Map<string, AttendanceEntry>();
      
      employees.forEach((emp) => {
        const existingEntry = prev.get(emp.employee_id);
        let status: 'present' | 'absent' | 'off' | 'unmarked';
        
        // Priority 1: Check current_attendance.status first (saved data from backend)
        if (emp.current_attendance?.status) {
          const savedStatus = emp.current_attendance.status.toLowerCase();
          if (savedStatus === 'present' || savedStatus === 'absent' || savedStatus === 'off') {
            status = savedStatus as 'present' | 'absent' | 'off';
          } else {
            status = 'unmarked';
          }
        }
        // Priority 2: Use default_status from backend
        else if (emp.default_status === 'present') {
          status = 'present';
        } else if (emp.default_status === 'absent') {
          status = 'absent';
        } else if (emp.default_status === 'off') {
          status = 'off';
        }
        // Priority 3: If employee has off day and no existing data, default to 'off'
        else if (emp.has_off_day) {
          status = 'off';
        }
        // Default: unmarked
        else {
          status = 'unmarked';
        }
        
        const entry = createAttendanceEntry(emp, status);
        
        // If there's existing attendance data from backend, use the actual values
        if (emp.current_attendance && status !== 'unmarked') {
          entry.ot_hours = emp.current_attendance.ot_hours || 0;
          entry.late_minutes = emp.current_attendance.late_minutes || 0;
          if (emp.current_attendance.check_in) {
            entry.clock_in = emp.current_attendance.check_in;
          }
          if (emp.current_attendance.check_out) {
            entry.clock_out = emp.current_attendance.check_out;
          }
        }
        
        // Preserve weekly attendance data when available
        if (existingEntry?.weeklyAttendance) {
          entry.weeklyAttendance = existingEntry.weeklyAttendance;
        }
        if (existingEntry?.autoMarkedReasons) {
          entry.autoMarkedReasons = existingEntry.autoMarkedReasons;
        }
        if (existingEntry?.weekly_penalty_days !== undefined) {
          entry.weekly_penalty_days = existingEntry.weekly_penalty_days;
        }
        if (existingEntry?.employee_off_days) {
          entry.employee_off_days = existingEntry.employee_off_days;
          if (selectedDate) {
            const dayIndex = new Date(selectedDate).getDay();
            const dayCodeMap = ['Su', 'M', 'Tu', 'W', 'Th', 'F', 'Sa'] as const;
            const selectedDayCode = dayCodeMap[dayIndex];
            entry.has_off_day = !!existingEntry.employee_off_days[selectedDayCode];
          }
        }
        if (existingEntry?.sunday_bonus) {
          entry.sunday_bonus = existingEntry.sunday_bonus;
        }
        
        newEntries.set(emp.employee_id, entry);
      });
      
      return newEntries;
    });
  };

  // Helper function to create attendance entry
  const createAttendanceEntry = (emp: Employee, status: 'present' | 'absent' | 'off' | 'unmarked'): AttendanceEntry => {
    return {
      employee_id: emp.employee_id,
      name: emp.name || 'Unknown',
      department: emp.department || 'General',
      status: status,
      clock_in: (() => {
        try {
          const minutes = emp.late_minutes || 0;
          const origShiftStart = emp.shift_start_time || '09:00';
          const parts = origShiftStart.split(':');
          if (parts.length < 2) return '09:00';
          const [h, m] = parts.map(Number);
          if (isNaN(h) || isNaN(m)) return '09:00';
          const date = new Date(0, 0, 0, h, m + minutes);
          return date.toTimeString().slice(0, 5);
        } catch (e) {
          return '09:00';
        }
      })(),
      clock_out: (() => {
        try {
          const hours = emp.ot_hours || 0;
          const origShiftEnd = emp.shift_end_time || '18:00';
          const parts = origShiftEnd.split(':');
          if (parts.length < 2) return '18:00';
          const [h, m] = parts.map(Number);
          if (isNaN(h) || isNaN(m)) return '18:00';
          const date = new Date(0, 0, 0, h + hours, m);
          return date.toTimeString().slice(0, 5);
        } catch (e) {
          return '18:00';
        }
      })(),
      ot_hours: emp.ot_hours || 0,
      late_minutes: emp.late_minutes || 0,
      has_off_day: emp.has_off_day || false,
      sunday_bonus: (emp as any).sunday_bonus || false,
      weeklyAttendance: {},
      _shiftStart: emp.shift_start_time || '09:00',
      _shiftEnd: emp.shift_end_time || '18:00'
    };
  };

  // Update attendance entry with batching for better performance
  const updateAttendanceEntry = useCallback((employeeId: string, field: keyof AttendanceEntry, value: string | number | boolean) => {
    setAttendanceEntries(prev => {
      const entry = prev.get(employeeId);
      if (!entry) return prev;
      
      let nextValue = value;
      if (field === 'status') {
        const employee = eligibleEmployees.find(emp => emp.employee_id === employeeId);
        const hasOffDay = entry?.has_off_day !== undefined ? entry.has_off_day : (employee?.has_off_day || false);
        if (hasOffDay && (nextValue === 'absent' || nextValue === 'unmarked')) {
          nextValue = 'off';
        }
      }
      
      // Only update if value actually changed
      if (entry[field] === nextValue) return prev;
      
      const newMap = new Map(prev);
      const updated = { ...entry, [field]: nextValue } as AttendanceEntry;
      
      if (field === 'status') {
        if (nextValue !== 'present' && nextValue !== 'unmarked') {
          updated._prevClockIn = entry.clock_in;
          updated._prevClockOut = entry.clock_out;
          updated._prevOt = entry.ot_hours;
          updated._prevLate = entry.late_minutes;
        }
        
        if (nextValue !== 'present') {
          updated.ot_hours = 0;
          updated.late_minutes = 0;
          updated.clock_in = entry._shiftStart || entry.clock_in;
          updated.clock_out = entry._shiftEnd || entry.clock_out;
        } else {
          if (entry._prevClockIn) updated.clock_in = entry._prevClockIn;
          if (entry._prevClockOut) updated.clock_out = entry._prevClockOut;
          if (typeof entry._prevOt === 'number') updated.ot_hours = entry._prevOt;
          if (typeof entry._prevLate === 'number') updated.late_minutes = entry._prevLate;
        }
      }
      
      newMap.set(employeeId, updated);
      return newMap;
    });
  }, [eligibleEmployees]);

  const timeToMinutes = (timeStr: string): number => {
    const [h, m] = timeStr.split(':').map(Number);
    if (Number.isNaN(h) || Number.isNaN(m)) return 0;
    return h * 60 + m;
  };

  const recalcOtLate = (employeeId: string, clockIn: string, clockOut: string, shiftStart: string, shiftEnd: string) => {
    const lateArrival = Math.max(timeToMinutes(clockIn) - timeToMinutes(shiftStart), 0);
    const earlyLeave = Math.max(timeToMinutes(shiftEnd) - timeToMinutes(clockOut), 0);
    const late_minutes = lateArrival + earlyLeave;
    const otMinutes = Math.max(timeToMinutes(clockOut) - timeToMinutes(shiftEnd), 0);
    const otHours = parseFloat((otMinutes / 60).toFixed(1));
    updateAttendanceEntry(employeeId, 'late_minutes', late_minutes);
    updateAttendanceEntry(employeeId, 'ot_hours', otHours);
  };

  const updateClockIn = (emp: Employee, value: string) => {
    updateAttendanceEntry(emp.employee_id, 'clock_in', value);
    if (emp.shift_start_time && emp.shift_end_time) {
      const currentEntry = attendanceEntries.get(emp.employee_id);
      if (currentEntry) {
        recalcOtLate(emp.employee_id, value, currentEntry.clock_out, emp.shift_start_time, emp.shift_end_time);
      }
    }
  };

  const updateClockOut = (emp: Employee, value: string) => {
    updateAttendanceEntry(emp.employee_id, 'clock_out', value);
    if (emp.shift_start_time && emp.shift_end_time) {
      const currentEntry = attendanceEntries.get(emp.employee_id);
      if (currentEntry) {
        recalcOtLate(emp.employee_id, currentEntry.clock_in, value, emp.shift_start_time, emp.shift_end_time);
      }
    }
  };

  const getFirstOffDay = (employeeOffDays: { [day: string]: boolean } | undefined): string | null => {
    if (!employeeOffDays) return null;
    const dayOrder = ['M', 'Tu', 'W', 'Th', 'F', 'Sa', 'Su'];
    for (const day of dayOrder) {
      if (employeeOffDays[day] === true) {
        return day;
      }
    }
    return null;
  };

  const calculateWeeklyPenaltyDays = (weeklyAttendance: { [day: string]: boolean }): number => {
    const weekdays = ['M', 'Tu', 'W', 'Th', 'F', 'Sa'];
    const absentDays = weekdays.filter(day => weeklyAttendance[day] === false).length;
    if (typeof weeklyAbsentThreshold !== 'number') return 0;
    const threshold = weeklyAbsentThreshold;
    if (absentDays >= threshold) {
      return 1;
    }
    return 0;
  };

  const fetchEmployeeOffDays = useCallback(async (employeeIds: string[]): Promise<Map<string, { [day: string]: boolean }>> => {
    const offDaysMap = new Map<string, { [day: string]: boolean }>();
    const missingIds: string[] = [];

    employeeIds.forEach(id => {
      if (employeeOffDaysCache.has(id)) {
        offDaysMap.set(id, employeeOffDaysCache.get(id)!);
      } else {
        missingIds.push(id);
      }
    });

    if (missingIds.length === 0) {
      return offDaysMap;
    }

    try {
      const directoryData = await attendanceService.getEmployeeDirectory(0, 0);
      const employees = directoryData.results || directoryData.employees || directoryData.data?.results || [];

      employees.forEach((emp: any) => {
        if (emp.employee_id && missingIds.includes(emp.employee_id)) {
          const offDays: { [day: string]: boolean } = {
            M: emp.off_monday || false,
            Tu: emp.off_tuesday || false,
            W: emp.off_wednesday || false,
            Th: emp.off_thursday || false,
            F: emp.off_friday || false,
            Sa: emp.off_saturday || false,
            Su: emp.off_sunday || false,
          };

          const hasOffDay = Object.values(offDays).some(val => val === true);
          if (hasOffDay) {
            offDaysMap.set(emp.employee_id, offDays);
          } else {
            offDaysMap.set(emp.employee_id, { M: false, Tu: false, W: false, Th: false, F: false, Sa: false, Su: false });
          }
        }
      });

      setEmployeeOffDaysCache(prev => {
        const next = new Map(prev);
        offDaysMap.forEach((value, key) => {
          next.set(key, value);
        });
        return next;
      });
    } catch (error) {
      console.log('Failed to fetch employee off days', error);
    }

    const mergedMap = new Map(employeeOffDaysCache);
    offDaysMap.forEach((value, key) => {
      mergedMap.set(key, value);
    });

    return mergedMap;
  }, [employeeOffDaysCache]);

  const fetchWeeklyAttendance = useCallback(async (date: string) => {
    try {
      const data = await attendanceService.getWeeklyAttendance(date);
      const allEmployeeIds = Object.keys(data || {});
      if (allEmployeeIds.length === 0) return;

      const dayIndex = new Date(date).getDay(); // 0=Sun..6=Sat
      const dayCodeMap = ['Su', 'M', 'Tu', 'W', 'Th', 'F', 'Sa'] as const;
      const selectedDayCode = dayCodeMap[dayIndex];

      const employeeOffDaysMap = await fetchEmployeeOffDays(allEmployeeIds);
      const weeklyPenaltyDaysMap = new Map<string, number>();

      allEmployeeIds.forEach((employeeId) => {
        const weeklyAttendance = data[employeeId]?.weeklyAttendance || {};
        const penaltyDays = calculateWeeklyPenaltyDays(weeklyAttendance);
        if (penaltyDays > 0) {
          weeklyPenaltyDaysMap.set(employeeId, penaltyDays);
        }
      });

      setAttendanceEntries(prev => {
        const updatedEntries = new Map(prev);

        Object.entries(data).forEach(([employeeId, employeeData]: [string, any]) => {
          const weeklyAttendance = employeeData.weeklyAttendance || {};
          const autoMarkedReasons = employeeData.autoMarkedReasons || {};
          const penaltyIgnoredDays = employeeData.penaltyIgnoredDays || {};
          const employeeOffDays = employeeOffDaysMap.get(employeeId);
          const hasOffDay = employeeOffDays ? !!employeeOffDays[selectedDayCode] : false;
          const penaltyDays = weeklyPenaltyDaysMap.get(employeeId) || 0;

          let updatedWeeklyAttendance = { ...weeklyAttendance };
          let updatedAutoMarkedReasons = { ...autoMarkedReasons };

          if (penaltyDays > 0 && employeeOffDays) {
            const firstOffDay = getFirstOffDay(employeeOffDays);
            if (firstOffDay) {
              updatedWeeklyAttendance[firstOffDay] = false;
              updatedAutoMarkedReasons[firstOffDay] = 'Penalty day - Absent more than threshold';
            }
          }

          if (updatedEntries.has(employeeId)) {
            const existingEntry = updatedEntries.get(employeeId);
            if (existingEntry) {
              updatedEntries.set(employeeId, {
                ...existingEntry,
                weeklyAttendance: updatedWeeklyAttendance,
                autoMarkedReasons: updatedAutoMarkedReasons,
                penaltyIgnoredDays,
                weekly_penalty_days: penaltyDays,
                employee_off_days: employeeOffDays,
                has_off_day: hasOffDay,
              });
            }
          } else {
            updatedEntries.set(employeeId, {
              employee_id: employeeId,
              name: employeeData.name || employeeId,
              department: '',
              status: 'unmarked',
              clock_in: '09:00',
              clock_out: '18:00',
              ot_hours: 0,
              late_minutes: 0,
              has_off_day: hasOffDay,
              weeklyAttendance: updatedWeeklyAttendance,
              autoMarkedReasons: updatedAutoMarkedReasons,
              penaltyIgnoredDays,
              weekly_penalty_days: penaltyDays,
              employee_off_days: employeeOffDays,
            });
          }
        });

        return updatedEntries;
      });
    } catch (error) {
      console.log('Failed to fetch weekly attendance', error);
    }
  }, [fetchEmployeeOffDays, calculateWeeklyPenaltyDays]);

  // Initialize selected date if not set
  useEffect(() => {
    if (!selectedDate) {
      dispatch(setSelectedDate(format(new Date(), 'yyyy-MM-dd')));
    }
  }, [selectedDate, dispatch]);

  // Load weekly absent threshold from salary config
  useEffect(() => {
    (async () => {
      try {
        const config: any = await api.get(API_ENDPOINTS.salaryConfig);
        const threshold = config?.weekly_absent_threshold;
        if (typeof threshold === 'number' && threshold >= 2 && threshold <= 7) {
          setWeeklyAbsentThreshold(threshold);
        }
      } catch (error) {
        console.log('Failed to load weekly absent threshold', error);
      }
    })();
  }, []);

  // Load data on component mount and when date changes
  useEffect(() => {
    if (selectedDate) {
      setAttendanceEntries(new Map());
      setEligibleEmployees([]);
      setDayName('');
      setHasExcelAttendance(false);
      setIsHoliday(false);
      setHolidayInfo(null);
      fetchEligibleEmployees();
    }
  }, [fetchEligibleEmployees, selectedDate]);

  // Fetch weekly attendance after employee data is ready
  useEffect(() => {
    if (!selectedDate || eligibleEmployees.length === 0) return;
    if (lastWeeklyFetchDateRef.current === selectedDate) return;
    lastWeeklyFetchDateRef.current = selectedDate;
    fetchWeeklyAttendance(selectedDate);
  }, [selectedDate, eligibleEmployees.length, fetchWeeklyAttendance]);

  // Memoized filtered and sorted employees for better performance
  const sortedEmployees = useMemo(() => {
    let filtered = eligibleEmployees.filter(emp => {
      const query = searchQuery.toLowerCase();
      const name = (emp.first_name && emp.last_name) 
        ? `${emp.first_name} ${emp.last_name}`.toLowerCase()
        : emp.name?.toLowerCase() || '';
      const id = emp.employee_id.toLowerCase();
      return name.includes(query) || id.includes(query);
    });

    // Filter by department
    filtered = filtered.filter(emp => {
      if (selectedDepartment === 'All') return true;
      return emp.department === selectedDepartment;
    });

    // Sort employees by name
    return filtered.sort((a, b) => {
      const nameA = (a.first_name && a.last_name) 
        ? `${a.first_name} ${a.last_name}` 
        : a.name || '';
      const nameB = (b.first_name && b.last_name) 
        ? `${b.first_name} ${b.last_name}` 
        : b.name || '';
      return nameA.localeCompare(nameB);
    });
  }, [eligibleEmployees, searchQuery, selectedDepartment]);

  // Mark all present
  const markAllPresent = useCallback(() => {
    if (!progressiveLoadingComplete) return;
    setAttendanceEntries(prev => {
      const newMap = new Map(prev);
      sortedEmployees.forEach(emp => {
        const entry = newMap.get(emp.employee_id);
        const hasOffDay = entry?.has_off_day !== undefined ? entry.has_off_day : (emp.has_off_day || false);
        if (entry && !hasOffDay && entry.status !== 'off') {
          newMap.set(emp.employee_id, { ...entry, status: 'present' });
        }
      });
      return newMap;
    });
  }, [progressiveLoadingComplete, sortedEmployees]);

  // Mark all absent
  const markAllAbsent = useCallback(() => {
    if (!progressiveLoadingComplete) return;
    setAttendanceEntries(prev => {
      const newMap = new Map(prev);
      sortedEmployees.forEach(emp => {
        const entry = newMap.get(emp.employee_id);
        const hasOffDay = entry?.has_off_day !== undefined ? entry.has_off_day : (emp.has_off_day || false);
        if (entry && !hasOffDay && entry.status !== 'off') {
          newMap.set(emp.employee_id, { ...entry, status: 'absent' });
        }
      });
      return newMap;
    });
  }, [progressiveLoadingComplete, sortedEmployees]);

  // Memoized table row component with custom comparison for better performance
  const AttendanceTableRow = memo(({ employee, entry, hasOffDay, colors, updateAttendanceEntry, updateClockIn, updateClockOut, hasExcelAttendance, isHoliday, dayName, weeklyAbsentThreshold, revertedPenaltyChips, onPenaltyDayPress }: {
    employee: Employee;
    entry: AttendanceEntry;
    hasOffDay: boolean;
    colors: any;
    updateAttendanceEntry: (id: string, field: keyof AttendanceEntry, value: any) => void;
    updateClockIn: (emp: Employee, value: string) => void;
    updateClockOut: (emp: Employee, value: string) => void;
    hasExcelAttendance: boolean;
    isHoliday: boolean;
    dayName: string;
    weeklyAbsentThreshold: number | null;
    revertedPenaltyChips: Set<string>;
    onPenaltyDayPress: (payload: { employeeId: string; employeeName: string; weeklyAttendance: { [day: string]: boolean }; penaltyDayCode?: string; initialPenaltyIgnored?: boolean; }) => void;
  }) => {
    const weeklyData = entry?.weeklyAttendance || {};
    const autoMarkedReasons = entry?.autoMarkedReasons || {};
    const employeeOffDays =
      (entry as any).employee_off_days ||
      {
        M: (employee as any).off_monday,
        Tu: (employee as any).off_tuesday,
        W: (employee as any).off_wednesday,
        Th: (employee as any).off_thursday,
        F: (employee as any).off_friday,
        Sa: (employee as any).off_saturday,
        Su: (employee as any).off_sunday,
      };
    const firstOffDayCode = ['M', 'Tu', 'W', 'Th', 'F', 'Sa', 'Su'].find((d) => employeeOffDays?.[d] === true);
    const weekdays = ['M', 'Tu', 'W', 'Th', 'F', 'Sa'];
    const absentCount = weekdays.filter((day) => weeklyData[day] === false).length;
    const threshold = typeof weeklyAbsentThreshold === 'number' ? weeklyAbsentThreshold : null;
    const isThresholdBreached = threshold !== null && absentCount >= threshold;
    const selectedDayCode = (() => {
      const dn = dayName.toLowerCase();
      if (dn === 'monday') return 'M';
      if (dn === 'tuesday') return 'Tu';
      if (dn === 'wednesday') return 'W';
      if (dn === 'thursday') return 'Th';
      if (dn === 'friday') return 'F';
      if (dn === 'saturday') return 'Sa';
      if (dn === 'sunday') return 'Su';
      return null;
    })();
    const firstOffDayValue = firstOffDayCode ? weeklyData[firstOffDayCode] : undefined;
    const isCurrentDateFirstOffDay = firstOffDayCode && selectedDayCode === firstOffDayCode;
    const isCurrentDateAutoMarked = isCurrentDateFirstOffDay ? (!!autoMarkedReasons?.[selectedDayCode!] || !!entry.sunday_bonus) : false;
    const isCurrentDateManuallyPresent = isCurrentDateFirstOffDay && entry.status === 'present' && !isCurrentDateAutoMarked;
    const isFirstOffDayManuallyPresent = firstOffDayCode && (isCurrentDateManuallyPresent || firstOffDayValue === true);
    const showPenaltyPresentChip = isThresholdBreached && isFirstOffDayManuallyPresent;

    return (
      <View style={[styles.tableRow, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        {/* Employee Details */}
        <View style={[styles.tableCell, { width: 150 }]}>
          <Text style={[styles.employeeName, { color: colors.text }]}>
            {employee.first_name && employee.last_name
              ? `${employee.first_name} ${employee.last_name}`
              : employee.name || 'Unknown'
            }
          </Text>
          <Text style={[styles.employeeId, { color: colors.textSecondary }]}>
            {employee.employee_id}
          </Text>
          <Text style={[styles.employeeDepartment, { color: colors.textSecondary }]}>
            {employee.department || 'General'}
          </Text>
        </View>

        {/* Clock In */}
        <View style={[styles.tableCell, { width: 80 }]}>
          {(hasOffDay || (entry.status as any) === 'off') || entry.status !== 'present' ? (
            <Text style={[styles.disabledText, { color: colors.textSecondary }]}>-</Text>
          ) : (
            <TextInput
              style={[styles.timeInputSmall, { color: colors.text, borderColor: colors.border }]}
              value={entry.clock_in}
              onChangeText={(value) => updateClockIn(employee, value)}
              placeholder="09:00"
              placeholderTextColor={colors.textSecondary}
              editable={!hasExcelAttendance && !isHoliday}
            />
          )}
        </View>

        {/* Clock Out */}
        <View style={[styles.tableCell, { width: 80 }]}>
          {(hasOffDay || (entry.status as any) === 'off') || entry.status !== 'present' ? (
            <Text style={[styles.disabledText, { color: colors.textSecondary }]}>-</Text>
          ) : (
            <TextInput
              style={[styles.timeInputSmall, { color: colors.text, borderColor: colors.border }]}
              value={entry.clock_out}
              onChangeText={(value) => updateClockOut(employee, value)}
              placeholder="18:00"
              placeholderTextColor={colors.textSecondary}
              editable={!hasExcelAttendance && !isHoliday}
            />
          )}
        </View>

        {/* Status Dropdown */}
        <View style={[styles.tableCell, { width: 100 }]}>
          {(hasOffDay || (entry.status as any) === 'off') && entry.status !== 'present' ? (
            <View style={styles.offDayContainer}>
              <View style={[styles.statusBadgeSmall, { backgroundColor: colors.info }]}>
                <Text style={styles.statusBadgeTextSmall}>OFF DAY</Text>
              </View>
              <TouchableOpacity
                style={[styles.markPresentButtonSmall, { backgroundColor: colors.warning }]}
                onPress={() => updateAttendanceEntry(employee.employee_id, 'status', 'present')}
                disabled={hasExcelAttendance || isHoliday}
              >
                <Text style={styles.markPresentButtonTextSmall}>Present</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.statusDropdown}>
              {hasOffDay && entry.status === 'present' && !isThresholdBreached && (
                <Text style={[styles.statusHint, { color: colors.warning }]}>Off Day - Extra Pay</Text>
              )}
              {entry.sunday_bonus && entry.status === 'present' && (
                <Text style={[styles.statusHint, { color: colors.primary }]}>Sunday bonus (auto-marked)</Text>
              )}
              <Text style={[styles.statusText, { color: entry.status === 'present' ? colors.success : entry.status === 'absent' ? colors.error : colors.textSecondary }]}>
                {entry.status === 'present' ? 'Present' : entry.status === 'absent' ? 'Absent' : 'Unmarked'}
              </Text>
              <View style={styles.statusButtonsSmall}>
                <TouchableOpacity
                  style={[
                    styles.statusButtonSmall,
                    {
                      backgroundColor: entry.status === 'present' ? colors.success : colors.surface,
                      borderColor: entry.status === 'present' ? colors.success : colors.border,
                    },
                  ]}
                  onPress={() => {
                    const newStatus = entry.status === 'present' ? 'unmarked' : 'present';
                    updateAttendanceEntry(employee.employee_id, 'status', newStatus);
                  }}
                  disabled={hasExcelAttendance || isHoliday}
                >
                  <Text style={[styles.statusButtonTextSmall, { color: entry.status === 'present' ? 'white' : colors.text }]}>
                    P
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.statusButtonSmall,
                    {
                      backgroundColor: (entry.status === 'absent' || (entry.status as any) === 'off') ? colors.error : colors.surface,
                      borderColor: (entry.status === 'absent' || (entry.status as any) === 'off') ? colors.error : colors.border,
                    },
                  ]}
                  onPress={() => {
                    const newStatus = hasOffDay 
                      ? ((entry.status as any) === 'off' ? 'unmarked' : 'off')
                      : (entry.status === 'absent' ? 'unmarked' : 'absent');
                    updateAttendanceEntry(employee.employee_id, 'status', newStatus);
                  }}
                  disabled={hasExcelAttendance || isHoliday}
                >
                  <Text style={[styles.statusButtonTextSmall, { color: (entry.status === 'absent' || (entry.status as any) === 'off') ? 'white' : colors.text }]}>
                    {hasOffDay ? 'O' : 'A'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>

        {/* OT Hours */}
        <View style={[styles.tableCell, { width: 70, alignItems: 'center' }]}>
          {(hasOffDay || (entry.status as any) === 'off') || entry.status !== 'present' ? (
            <Text style={[styles.disabledText, { color: colors.textSecondary }]}>-</Text>
          ) : (
            <Text style={[styles.valueText, { color: colors.text }]}>{entry.ot_hours}</Text>
          )}
        </View>

        {/* Late Minutes */}
        <View style={[styles.tableCell, { width: 80, alignItems: 'center' }]}>
          {(hasOffDay || (entry.status as any) === 'off') || entry.status !== 'present' ? (
            <Text style={[styles.disabledText, { color: colors.textSecondary }]}>-</Text>
          ) : (
            <Text style={[styles.valueText, { color: colors.text }]}>{entry.late_minutes}</Text>
          )}
        </View>

        {/* Weekly Attendance */}
        <View style={[styles.tableCell, { width: 210 }]}>
          <View style={styles.weeklyChipsRow}>
            {['M', 'Tu', 'W', 'Th', 'F', 'Sa', 'Su'].map((day) => {
              let dayValue = weeklyData[day];
              if (selectedDayCode === day) {
                if (entry.status === 'present') dayValue = true;
                else if (entry.status === 'absent' || entry.status === 'off') dayValue = false;
              }

              const isFirstOffDay = firstOffDayCode ? day === firstOffDayCode : false;
              const isCurrentDay = selectedDayCode === day;
              const isCurrentDayAutoMarked = isCurrentDay ? (!!autoMarkedReasons?.[day] || !!entry.sunday_bonus) : false;
              const isCurrentDayManuallyPresent = isCurrentDay && entry.status === 'present' && !isCurrentDayAutoMarked;
              const isPresent = dayValue === true || (isCurrentDay && isCurrentDayManuallyPresent) || (showPenaltyPresentChip && isFirstOffDay);
              const isAbsent = dayValue === false && !(isCurrentDay && isCurrentDayManuallyPresent) && !(showPenaltyPresentChip && isFirstOffDay);
              const autoMarkReason = autoMarkedReasons[day];
              const isAutoMarked = !!autoMarkReason;
              const isPenaltyDay = isAbsent && autoMarkReason && autoMarkReason.includes('Penalty day');
              const isPenaltyPresentChip = showPenaltyPresentChip && isFirstOffDay && isPresent && !isAutoMarked;
              const hasPenaltyReasonButPresent = isPresent && autoMarkReason && autoMarkReason.includes('Penalty day');
              const wasReverted = entry?.penaltyIgnoredDays?.[day] || revertedPenaltyChips.has(`${employee.employee_id}-${day}`);
              const isPenaltyDayClickable = isPenaltyDay;

              let chipBackground = colors.surface;
              let chipBorder = colors.border;
              let chipText = colors.textSecondary;
              let chipTooltip = '';
              let showInfoIcon = false;

              if (isPresent) {
                if (isPenaltyPresentChip || hasPenaltyReasonButPresent) {
                  chipBackground = `${colors.warning}20`;
                  chipBorder = colors.warning;
                  chipText = colors.warning;
                  chipTooltip = 'Penalty day is marked as present';
                  showInfoIcon = true;
                } else if (isAutoMarked) {
                  chipBackground = `${colors.success}20`;
                  chipBorder = colors.success;
                  chipText = colors.success;
                  chipTooltip = autoMarkReason || 'Auto-marked present';
                  showInfoIcon = true;
                } else {
                  chipBackground = `${colors.success}20`;
                  chipBorder = colors.success;
                  chipText = colors.success;
                }
              } else if (isAbsent) {
                if (isPenaltyDay) {
                  if (wasReverted) {
                    chipBackground = '#C4B5FD';
                    chipBorder = '#7C3AED';
                    chipText = '#4C1D95';
                    chipTooltip = 'Penalty reverted for this day';
                    showInfoIcon = true;
                  } else {
                    chipBackground = `${colors.error}20`;
                    chipBorder = colors.error;
                    chipText = colors.error;
                    chipTooltip = autoMarkReason || 'Penalty day - Absent more than threshold';
                    showInfoIcon = true;
                  }
                } else {
                  chipBackground = `${colors.error}20`;
                  chipBorder = colors.error;
                  chipText = colors.error;
                }
              } else {
                chipBackground = colors.divider;
                chipBorder = colors.border;
                chipText = colors.textSecondary;
              }

              return (
                <TouchableOpacity
                  key={day}
                  style={[
                    styles.weeklyChip,
                    { backgroundColor: chipBackground, borderColor: chipBorder },
                    isPenaltyDayClickable && styles.weeklyChipClickable,
                  ]}
                  onPress={() => {
                    if (isPenaltyDayClickable) {
                      onPenaltyDayPress({
                        employeeId: employee.employee_id,
                        employeeName: employee.first_name && employee.last_name
                          ? `${employee.first_name} ${employee.last_name}`
                          : employee.name || 'Unknown',
                        weeklyAttendance: weeklyData,
                        penaltyDayCode: day,
                        initialPenaltyIgnored: wasReverted,
                      });
                    }
                  }}
                  disabled={!isPenaltyDayClickable}
                >
                  <Text style={[styles.weeklyChipText, { color: chipText }]}>{day}</Text>
                  {showInfoIcon && (
                    <TouchableOpacity
                      onPress={() => {
                        if (chipTooltip) {
                          Alert.alert('Attendance Info', chipTooltip);
                        }
                      }}
                      disabled={!chipTooltip}
                      style={styles.weeklyChipInfo}
                    >
                      <FontAwesome
                        name="info-circle"
                        size={10}
                        color={chipText}
                      />
                    </TouchableOpacity>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </View>
    );
  }, (prevProps, nextProps) => {
    // Custom comparison to prevent unnecessary re-renders
    return (
      prevProps.employee.employee_id === nextProps.employee.employee_id &&
      prevProps.entry.status === nextProps.entry.status &&
      prevProps.entry.clock_in === nextProps.entry.clock_in &&
      prevProps.entry.clock_out === nextProps.entry.clock_out &&
      prevProps.entry.ot_hours === nextProps.entry.ot_hours &&
      prevProps.entry.late_minutes === nextProps.entry.late_minutes &&
      prevProps.entry.weeklyAttendance === nextProps.entry.weeklyAttendance &&
      prevProps.entry.autoMarkedReasons === nextProps.entry.autoMarkedReasons &&
      prevProps.entry.weekly_penalty_days === nextProps.entry.weekly_penalty_days &&
      prevProps.entry.sunday_bonus === nextProps.entry.sunday_bonus &&
      prevProps.hasOffDay === nextProps.hasOffDay &&
      prevProps.hasExcelAttendance === nextProps.hasExcelAttendance &&
      prevProps.isHoliday === nextProps.isHoliday &&
      prevProps.dayName === nextProps.dayName &&
      prevProps.weeklyAbsentThreshold === nextProps.weeklyAbsentThreshold &&
      prevProps.revertedPenaltyChips === nextProps.revertedPenaltyChips
    );
  });

  // Save attendance
  const saveAttendance = async () => {
    try {
      setSaving(true);
      setError(null);
      
      if (!selectedDate) {
        setError('Please select a date');
        setSaving(false);
        return;
      }
      
      if (hasExcelAttendance) {
        Alert.alert('Info', 'Attendance interface is disabled: Excel data uploaded for this month');
        setSaving(false);
        return;
      }
      
      if (isHoliday && holidayInfo) {
        const message = `Cannot mark attendance on holiday: ${holidayInfo.name}${holidayInfo.description ? ` - ${holidayInfo.description}` : ''}`;
        Alert.alert('Info', message);
        setSaving(false);
        return;
      }
      
      const unmarkedEntries = Array.from(attendanceEntries.values()).filter(entry => {
        const emp = eligibleEmployees.find(e => e.employee_id === entry.employee_id);
        const isOffDay = entry.has_off_day || emp?.has_off_day;
        if (isOffDay) return false;
        return entry.status === 'unmarked';
      });
      
      if (unmarkedEntries.length > 0) {
        setSaving(false);
        const unmarkedNames = unmarkedEntries.map(entry => entry.name).join(', ');
        Alert.alert('Info', `Please mark attendance for: ${unmarkedNames}`);
        return;
      }
      
      const attendanceData = Array.from(attendanceEntries.values()).map(entry => ({
        employee_id: entry.employee_id,
        name: entry.name,
        department: entry.department,
        date: selectedDate,
        status: entry.status,
        present_days: entry.status === 'present' ? 1 : 0,
        absent_days: entry.status === 'absent' ? 1 : 0,
        ot_hours: entry.ot_hours,
        late_minutes: entry.late_minutes,
        calendar_days: 1,
        total_working_days: 1,
      }));
      
      const employeeIds = attendanceData.map(entry => entry.employee_id);
      const attendanceResult = await attendanceService.saveAttendance(selectedDate, attendanceData);
      
      Alert.alert('Success', attendanceResult?.message || 'Attendance saved successfully!');
      setError(null);
      
      setTimeout(() => {
        if (selectedDate) {
          fetchWeeklyAttendance(selectedDate);
        }
      }, 2000);
      
      attendanceService.updateMonthlySummaries(selectedDate, employeeIds).catch(() => {
        console.log('Monthly summary update failed');
      });
      
      await fetchEligibleEmployees();
    } catch (err: any) {
      console.error('Error saving attendance:', err);
      const message = err.message || 'Failed to save attendance';
      if (message.toLowerCase().includes('holiday')) {
        setIsHoliday(true);
      }
      setError(message);
      Alert.alert('Error', message);
    } finally {
      setSaving(false);
    }
    
    if (selectedDate) {
      const date = new Date(selectedDate);
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const year = date.getFullYear();
      fetchAttendanceDates(month, year);
    }
  };

  const handlePenaltyDayPress = useCallback((payload: { employeeId: string; employeeName: string; weeklyAttendance: { [day: string]: boolean }; penaltyDayCode?: string; initialPenaltyIgnored?: boolean; }) => {
    setSelectedPenaltyEmployee(payload);
    setPenaltyModalOpen(true);
  }, []);
  
  return (
    <GestureHandlerRootView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header with search only */}
      <View style={[styles.header, { backgroundColor: colors.primary }]}>
        <View style={styles.headerControls}>
          <View style={[styles.headerSearch, { backgroundColor: 'rgba(255,255,255,0.12)' }]}>
            <FontAwesome name="search" size={16} color="rgba(255,255,255,0.9)" />
            <TextInput
              style={styles.headerSearchInput}
              placeholder="Search by name or ID..."
              placeholderTextColor="rgba(255,255,255,0.9)"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <FontAwesome name="times-circle" size={16} color="rgba(255,255,255,0.9)" />
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>

      {/* Tabs */}
      <View style={[styles.tabsContainer, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <TouchableOpacity
          style={[
            styles.tab,
            activeTab === 'log' && [styles.activeTab, { backgroundColor: colors.primary }],
          ]}
          onPress={() => setActiveTab('log')}
        >
          <Text style={[
            styles.tabText,
            { color: activeTab === 'log' ? 'white' : colors.text }
          ]}>
            Mark Attendance
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.tab,
            activeTab === 'tracker' && [styles.activeTab, { backgroundColor: colors.primary }],
          ]}
          onPress={() => setActiveTab('tracker')}
        >
          <Text style={[
            styles.tabText,
            { color: activeTab === 'tracker' ? 'white' : colors.text }
          ]}>
            Track Attendance
          </Text>
        </TouchableOpacity>
      </View>

      {/* Tab Content */}
      {activeTab === 'log' ? (
        <>
          {/* Date Selection Button */}
          <View style={styles.dateButtonSection}>
            <TouchableOpacity
              style={[styles.dateButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
              onPress={() => setShowCalendar(!showCalendar)}
            >
              <FontAwesome name="calendar" size={16} color={colors.primary} />
              <Text style={[styles.dateButtonText, { color: colors.text }]}>
                {selectedDate ? new Date(selectedDate).toLocaleDateString('en-US', { 
                  weekday: 'short',
                  year: 'numeric', 
                  month: 'short', 
                  day: 'numeric' 
                }) : 'Select Date'}
              </Text>
              <FontAwesome name={showCalendar ? "chevron-up" : "chevron-down"} size={12} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Calendar Modal */}
          {showCalendar && (
            <View style={styles.calendarSection}>
              <Calendar
                current={selectedDate || undefined}
                onDayPress={(day) => {
                  handleDateSelect(day.dateString);
                  console.log('Selected date:', day.dateString);
                  console.log('Attendance dates:', attendanceDates);
                }}
                onMonthChange={(month) => {
                  const monthValue = String(month.month).padStart(2, '0');
                  setCalendarMonth({ month: monthValue, year: month.year });
                  fetchAttendanceDates(monthValue, month.year);
                }}
                markedDates={{
                  ...attendanceDates.reduce((acc, date) => ({
                    ...acc,
                    [date]: {
                      marked: true,
                      dotColor: '#14b8a6', // Teal-500
                    }
                  }), {}),
                  ...(selectedDate ? {
                    [selectedDate]: {
                      selected: true,
                      selectedColor: '#0d9488', // Teal-600
                      marked: attendanceDates.includes(selectedDate),
                      dotColor: '#ffffff', // White dot on selected date
                    }
                  } : {})
                }}
                maxDate={new Date().toISOString().split('T')[0]}
                theme={{
                  backgroundColor: colors.background,
                  calendarBackground: colors.surface,
                  textSectionTitleColor: colors.text,
                  selectedDayBackgroundColor: '#0d9488',
                  selectedDayTextColor: '#ffffff',
                  todayTextColor: '#14b8a6',
                  dayTextColor: colors.text,
                  textDisabledColor: colors.textLight,
                  dotColor: '#14b8a6',
                  selectedDotColor: '#ffffff',
                  arrowColor: colors.primary,
                  monthTextColor: colors.text,
                  indicatorColor: colors.primary,
                  textDayFontWeight: '400',
                  textMonthFontWeight: '600',
                  textDayHeaderFontWeight: '500',
                  textDayFontSize: 14,
                  textMonthFontSize: 16,
                  textDayHeaderFontSize: 12,
                }}
                style={[styles.calendar, { backgroundColor: colors.surface }]}
              />
            </View>
          )}

          {/* Department Filter with Save Button */}
          <View style={[styles.departmentSection, { paddingHorizontal: 16, paddingTop: 8 }]}>
            <Text style={[styles.sectionLabel, { color: colors.text }]}>Department</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <FlatList
                horizontal
                showsHorizontalScrollIndicator={false}
                data={departments}
                keyExtractor={(item) => item}
                renderItem={({ item: dept }) => (
                <TouchableOpacity
                  key={dept}
                  style={[
                    styles.departmentButton,
                    {
                      backgroundColor: selectedDepartment === dept ? colors.primary : colors.surface,
                      borderColor: selectedDepartment === dept ? colors.primary : colors.border,
                    },
                  ]}
                  onPress={() => setSelectedDepartment(dept)}
                >
                  <Text
                    style={[
                      styles.departmentButtonText,
                      { color: selectedDepartment === dept ? 'white' : colors.text },
                    ]}
                  >
                    {dept}
                  </Text>
                </TouchableOpacity>
                )}
              />
              {!loading && sortedEmployees.length > 0 && !hasExcelAttendance && !isHoliday && (
              <TouchableOpacity
                style={[styles.compactSaveButton, { backgroundColor: colors.primary, marginLeft: 12 }]}
                onPress={saveAttendance}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <FontAwesome name="save" size={14} color="white" />
                )}
                <Text style={styles.compactSaveButtonText}>
                  {saving ? 'Saving...' : 'Save'}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

          {/* Bulk Actions */}
          <View style={[styles.bulkActionsSection, { paddingHorizontal: 16 }]}>
            <Text style={[styles.sectionLabel, { color: colors.text }]}>Bulk Actions</Text>
            <View style={styles.bulkButtons}>
              <TouchableOpacity
                style={[styles.bulkButton, { backgroundColor: colors.success, opacity: (hasExcelAttendance || isHoliday || !progressiveLoadingComplete) ? 0.5 : 1 }]}
                onPress={markAllPresent}
                disabled={hasExcelAttendance || isHoliday || !progressiveLoadingComplete}
              >
                <FontAwesome name="check-circle" size={16} color="white" />
                <Text style={styles.bulkButtonText}>Mark All Present</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.bulkButton, { backgroundColor: colors.error, opacity: (hasExcelAttendance || isHoliday || !progressiveLoadingComplete) ? 0.5 : 1 }]}
                onPress={markAllAbsent}
                disabled={hasExcelAttendance || isHoliday || !progressiveLoadingComplete}
              >
                <FontAwesome name="times-circle" size={16} color="white" />
                <Text style={styles.bulkButtonText}>Mark All Absent</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Holiday/Excel Warning */}
          {(hasExcelAttendance || isHoliday) && (
            <View style={[styles.warningBox, { backgroundColor: colors.warning + '20', borderColor: colors.warning, marginHorizontal: 16 }]}>
              <FontAwesome name="exclamation-triangle" size={16} color={colors.warning} />
              <Text style={[styles.warningText, { color: colors.warning }]}>
                {hasExcelAttendance 
                  ? 'Attendance interface is disabled: Excel data uploaded for this month'
                  : `Cannot mark attendance on holiday: ${holidayInfo?.name || 'Holiday'}`
                }
              </Text>
            </View>
          )}

          {/* Employee List - Single FlatList with NO nested ScrollViews */}
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
                Loading employees...
              </Text>
            </View>
          ) : error ? (
            <View style={[styles.errorBox, { backgroundColor: colors.error + '20', borderColor: colors.error }]}>
              <FontAwesome name="exclamation-circle" size={16} color={colors.error} />
              <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
            </View>
          ) : hasExcelAttendance ? (
            <View style={[styles.disabledBox, { backgroundColor: colors.divider, borderColor: colors.border }]}>
              <Text style={[styles.disabledTitle, { color: colors.text }]}>Attendance interface is disabled for this month</Text>
              <Text style={[styles.disabledTextBody, { color: colors.textSecondary }]}>
                Attendance data has been uploaded via Excel for {new Date(selectedDate).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              </Text>
            </View>
          ) : isHoliday ? (
            <View style={[styles.disabledBox, { backgroundColor: colors.divider, borderColor: colors.border }]}>
              <Text style={[styles.disabledTitle, { color: colors.text }]}>Attendance interface is disabled for this holiday</Text>
              <Text style={[styles.disabledTextBody, { color: colors.textSecondary }]}>
                Cannot mark attendance on {holidayInfo?.name || 'holidays'}
              </Text>
            </View>
          ) : sortedEmployees.length === 0 ? (
            <View style={styles.emptyContainer}>
              <FontAwesome name="users" size={48} color={colors.textSecondary} />
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                {searchQuery ? 'No employees found matching your search' : 'No employees found for this date'}
              </Text>
            </View>
          ) : (
            <View style={{ flex: 1, paddingHorizontal: 16 }}>
              <ScrollView horizontal showsHorizontalScrollIndicator={true} style={styles.tableScrollContainer}>
              <FlatList
                data={sortedEmployees}
                keyExtractor={(item) => item.employee_id}
                ListHeaderComponent={() => (
                  <View style={[styles.tableHeader, { backgroundColor: colors.primary }]}>
                    <Text style={[styles.headerCell, { width: 150, color: 'white' }]}>Employee</Text>
                    <Text style={[styles.headerCell, { width: 80, color: 'white' }]}>Clock In</Text>
                    <Text style={[styles.headerCell, { width: 80, color: 'white' }]}>Clock Out</Text>
                    <Text style={[styles.headerCell, { width: 100, color: 'white' }]}>Status</Text>
                    <Text style={[styles.headerCell, { width: 70, color: 'white' }]}>OT Hours</Text>
                    <Text style={[styles.headerCell, { width: 80, color: 'white' }]}>Late Min</Text>
                    <Text style={[styles.headerCell, { width: 210, color: 'white' }]}>Weekly</Text>
                  </View>
                )}
                stickyHeaderIndices={[0]}
                removeClippedSubviews={true}
                maxToRenderPerBatch={20}
                updateCellsBatchingPeriod={100}
                initialNumToRender={20}
                windowSize={5}
                maintainVisibleContentPosition={{
                  minIndexForVisible: 0,
                }}
                onScrollToIndexFailed={() => {}}
              ListFooterComponent={
                loadingMore ? (
                  <View style={{ padding: 16, alignItems: 'center' }}>
                    <ActivityIndicator size="small" color={colors.primary} />
                    <Text style={{ color: colors.textSecondary, marginTop: 8, fontSize: 12 }}>
                      Loading more employees...
                    </Text>
                  </View>
                ) : progressiveLoadingComplete && sortedEmployees.length > 0 ? (
                  <View style={{ padding: 16, alignItems: 'center' }}>
                    <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
                      ✓ All {sortedEmployees.length} employees loaded
                    </Text>
                  </View>
                ) : null
              }
              renderItem={({ item: employee }) => {
                const entry = attendanceEntries.get(employee.employee_id);
                if (!entry) return null;

                const hasOffDay = entry.has_off_day !== undefined ? entry.has_off_day : (employee.has_off_day || false);

                return (
                  <AttendanceTableRow
                    employee={employee}
                    entry={entry}
                    hasOffDay={hasOffDay}
                    colors={colors}
                    updateAttendanceEntry={updateAttendanceEntry}
                    updateClockIn={updateClockIn}
                    updateClockOut={updateClockOut}
                    hasExcelAttendance={hasExcelAttendance}
                    isHoliday={isHoliday}
                    dayName={dayName}
                    weeklyAbsentThreshold={weeklyAbsentThreshold}
                    revertedPenaltyChips={revertedPenaltyChips}
                    onPenaltyDayPress={handlePenaltyDayPress}
                  />
                );
              }}
              ListEmptyComponent={() => (
                <View style={styles.emptyContainer}>
                  <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                    No employees found
                  </Text>
                </View>
              )}
            />
              </ScrollView>
            </View>
          )}
        </>
      ) : (
        /* Track Attendance Tab - Redesigned to match web dashboard */
        <TrackAttendanceTab 
          colors={colors}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
        />
      )}

      {selectedPenaltyEmployee && (
        <PenaltyRevertModal
          isOpen={penaltyModalOpen}
          onClose={() => {
            setPenaltyModalOpen(false);
            setSelectedPenaltyEmployee(null);
          }}
          employeeId={selectedPenaltyEmployee.employeeId}
          employeeName={selectedPenaltyEmployee.employeeName}
          date={selectedDate}
          weeklyAbsentThreshold={weeklyAbsentThreshold}
          weeklyAttendance={selectedPenaltyEmployee.weeklyAttendance}
          initialPenaltyIgnored={selectedPenaltyEmployee.initialPenaltyIgnored}
          onSuccess={(newIgnored?: boolean) => {
            if (selectedPenaltyEmployee?.penaltyDayCode) {
              const key = `${selectedPenaltyEmployee.employeeId}-${selectedPenaltyEmployee.penaltyDayCode}`;
              setRevertedPenaltyChips(prev => {
                const next = new Set(prev);
                if (newIgnored) {
                  next.add(key);
                } else {
                  next.delete(key);
                }
                return next;
              });
              setAttendanceEntries((prev) => {
                const next = new Map(prev);
                const entry = next.get(selectedPenaltyEmployee.employeeId);
                if (entry) {
                  const penaltyIgnoredDays = { ...(entry.penaltyIgnoredDays || {}) };
                  penaltyIgnoredDays[selectedPenaltyEmployee.penaltyDayCode!] = !!newIgnored;
                  next.set(selectedPenaltyEmployee.employeeId, {
                    ...entry,
                    penaltyIgnoredDays,
                  });
                }
                return next;
              });
            }
            fetchEligibleEmployees();
            if (selectedDate) {
              fetchWeeklyAttendance(selectedDate);
            }
          }}
        />
      )}
    </GestureHandlerRootView>
  );
}

// Styles for the new attendance log design
const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingTop: 10,
    paddingBottom: 12,
    paddingHorizontal: 16,
  },
  headerControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerSearch: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 40,
    gap: 8,
  },
  headerSearchInput: {
    flex: 1,
    paddingVertical: 6,
    paddingHorizontal: 4,
    color: 'white',
    fontSize: 14,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  filtersContainer: {
    flex: 1,
    padding: 16,
  },
  sectionLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  dateSection: {
    marginBottom: 24,
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  dateButtonText: {
    fontSize: 16,
    fontWeight: '500',
    flex: 1,
    marginLeft: 12,
  },
  searchSection: {
    marginBottom: 24,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  searchInput: {
    flex: 1,
    marginLeft: 12,
    fontSize: 16,
  },
  departmentSection: {
    marginBottom: 24,
  },
  departmentButtons: {
    flexDirection: 'row',
    paddingVertical: 8,
  },
  departmentButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    marginRight: 8,
  },
  departmentButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
  bulkActionsSection: {
    marginBottom: 24,
  },
  bulkButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  bulkButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 8,
    gap: 8,
  },
  bulkButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 24,
    gap: 8,
  },
  warningText: {
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
  },
  employeeListSection: {
    marginBottom: 24,
  },
  loadingContainer: {
    alignItems: 'center',
    padding: 40,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    gap: 12,
  },
  errorText: {
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
  },
  disabledBox: {
    marginHorizontal: 16,
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  disabledTitle: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  disabledTextBody: {
    marginTop: 6,
    fontSize: 12,
    textAlign: 'center',
  },
  emptyContainer: {
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    marginTop: 12,
    fontSize: 16,
    textAlign: 'center',
  },
  employeeList: {
    gap: 12,
  },
  employeeCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    marginBottom: 12,
  },
  employeeInfo: {
    marginBottom: 16,
  },
  employeeDetails: {
    flex: 1,
  },
  employeeName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  employeeId: {
    fontSize: 14,
    marginBottom: 2,
  },
  employeeDepartment: {
    fontSize: 14,
  },
  attendanceSection: {
    gap: 12,
  },
    statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    alignSelf: 'flex-start',
  },
  statusBadgeText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  markPresentButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  markPresentButtonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  statusButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  statusButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    borderWidth: 1,
    alignItems: 'center',
  },
  statusButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
  timeInputs: {
    flexDirection: 'row',
    gap: 12,
  },
  timeInputContainer: {
    flex: 1,
  },
  timeLabel: {
    fontSize: 12,
    marginBottom: 4,
  },
  timeInput: {
    padding: 8,
    borderRadius: 6,
    borderWidth: 1,
    fontSize: 14,
    textAlign: 'center',
  },
  otLateContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 8,
    backgroundColor: 'rgba(0,0,0,0.02)',
    borderRadius: 6,
  },
  otLateItem: {
    alignItems: 'center',
  },
  otLateLabel: {
    fontSize: 12,
    marginBottom: 2,
  },
  otLateValue: {
    fontSize: 16,
    fontWeight: '600',
  },
  saveSection: {
    marginBottom: 24,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 8,
    gap: 8,
  },
  // Top save button styles
  topSaveSection: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  topSaveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    borderRadius: 8,
    gap: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  // Compact save button styles
  compactSaveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    gap: 6,
  },
  compactSaveButtonText: {
    color: 'white',
    fontSize: 13,
    fontWeight: '600',
  },
  saveButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  // Calendar styles
  dateButtonSection: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  calendarSection: {
    marginBottom: 16,
    paddingHorizontal: 16,
  },
  calendar: {
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  // Table styles
  tableScrollContainer: {
    flex: 1,
  },
  tableHeader: {
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
  },
  headerCell: {
    fontSize: 14,
    fontWeight: '600',
    paddingHorizontal: 8,
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    minHeight: 80,
  },
  tableCell: {
    paddingHorizontal: 8,
    justifyContent: 'center',
  },
  timeInputSmall: {
    padding: 6,
    borderRadius: 4,
    borderWidth: 1,
    fontSize: 12,
    textAlign: 'center',
    minWidth: 60,
  },
  disabledText: {
    fontSize: 14,
    fontStyle: 'italic',
  },
  valueText: {
    fontSize: 14,
    fontWeight: '500',
  },
  statusDropdown: {
    alignItems: 'flex-start',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 4,
  },
  statusHint: {
    fontSize: 10,
    fontWeight: '600',
    marginBottom: 4,
  },
  statusButtonsSmall: {
    flexDirection: 'row',
    gap: 4,
  },
  statusButtonSmall: {
    width: 24,
    height: 24,
    borderRadius: 4,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusButtonTextSmall: {
    fontSize: 10,
    fontWeight: '600',
  },
  statusBadgeSmall: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginBottom: 4,
  },
  statusBadgeTextSmall: {
    color: 'white',
    fontSize: 10,
    fontWeight: '600',
  },
  markPresentButtonSmall: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  markPresentButtonTextSmall: {
    color: 'white',
    fontSize: 10,
    fontWeight: '600',
  },
  offDayContainer: {
    alignItems: 'flex-start',
  },
  weeklyChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  weeklyChip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginRight: 4,
    marginBottom: 4,
  },
  weeklyChipClickable: {
    opacity: 0.9,
  },
  weeklyChipText: {
    fontSize: 10,
    fontWeight: '600',
  },
  weeklyChipInfo: {
    marginLeft: 4,
  },
  // Tab styles
  tabsContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
  },
  tab: {
    flex: 1,
    paddingVertical: 16,
    alignItems: 'center',
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabText: {
    fontSize: 16,
    fontWeight: '600',
  },
  // Track Attendance styles
  trackAttendanceContainer: {
    flex: 1,
  },
  trackHeader: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
  },
  trackTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  trackSubtitle: {
    marginTop: 2,
    fontSize: 12,
  },
  trackFiltersContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  monthSection: {
    marginBottom: 16,
  },
  monthYearContainer: {
    marginTop: 8,
  },
  monthYearButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  summaryContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 12,
  },
  summaryCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
  },
  summaryContent: {
    marginLeft: 12,
  },
  summaryValue: {
    fontSize: 20,
    fontWeight: '700',
  },
  summaryLabel: {
    fontSize: 12,
    marginTop: 2,
  },
  attendanceListContainer: {
    flex: 1,
    paddingHorizontal: 16,
  },
  attendanceRecordsList: {
    flex: 1,
  },
  attendanceRecord: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 8,
  },
  recordDate: {
    flex: 2,
  },
  recordDateText: {
    fontSize: 16,
    fontWeight: '600',
  },
  recordDayText: {
    fontSize: 14,
    marginTop: 2,
  },
  recordStatus: {
    flex: 1,
    alignItems: 'center',
  },
  recordTimes: {
    flex: 2,
    alignItems: 'flex-end',
  },
  recordTimeText: {
    fontSize: 14,
    fontWeight: '500',
  },
  recordOTText: {
    fontSize: 12,
    marginTop: 2,
  },
  // Optimized table styles for better performance
  tableRowOptimized: {
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    minHeight: 60,
    elevation: 0,
    shadowOpacity: 0,
  },
  // Fast input styles
  timeInputOptimized: {
    padding: 6,
    borderRadius: 4,
    borderWidth: 1,
    fontSize: 12,
    textAlign: 'center',
    minWidth: 60,
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
  // Track Attendance Tab Styles
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    gap: 6,
  },
  filterButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
  departmentScroll: {
    flex: 1,
  },
  departmentChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    marginRight: 8,
  },
  departmentChipText: {
    fontSize: 12,
    fontWeight: '500',
  },
  dateSelectionRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  dateSelectButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  dateSelectButtonFull: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    gap: 8,
  },
  dateSelectButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
  kpiContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    paddingBottom: 8,
    gap: 8,
  },
  kpiCard: {
    flex: 1,
    minWidth: '30%',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  kpiLabel: {
    fontSize: 11,
    fontWeight: '500',
    marginBottom: 4,
    textAlign: 'center',
  },
  kpiValue: {
    fontSize: 18,
    fontWeight: '700',
  },
  percentageBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    alignItems: 'center',
  },
  percentageText: {
    fontSize: 12,
    fontWeight: '600',
  },
  // Card-based tracker list
  attendanceCardsContainer: {
    flex: 1,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  attendanceCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 10,
    marginBottom: 8,
  },
  attendanceCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 8,
  },
  attendanceName: {
    fontSize: 15,
    fontWeight: '600',
  },
  attendanceSub: {
    marginTop: 2,
    fontSize: 12,
  },
  attendanceStatusPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  attendanceStatusText: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  attendanceMetricsRow: {
    flexDirection: 'row',
    marginTop: 4,
  },
  attendanceMetric: {
    flex: 1,
    paddingVertical: 4,
  },
  metricLabelSmall: {
    fontSize: 11,
  },
  metricValueSmall: {
    marginTop: 2,
    fontSize: 13,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingVertical: 20,
    maxHeight: '70%',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  modalOptionText: {
    fontSize: 16,
    fontWeight: '500',
  },
});
