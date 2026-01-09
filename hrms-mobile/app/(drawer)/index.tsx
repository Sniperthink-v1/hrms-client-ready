// Dashboard/Overview Screen
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
  Modal,
  FlatList,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAppSelector } from '@/store/hooks';
import { api } from '@/services/api';
import { API_ENDPOINTS } from '@/constants/Config';
import { DashboardStats, SalaryData } from '@/types';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { DashboardSkeleton } from '@/components/LoadingSkeleton';
import CreditProtectedScreen from '@/components/CreditProtectedScreen';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Calendar } from 'react-native-calendars';
import { format } from 'date-fns';

type TimePeriod = 'this_month' | 'last_6_months' | 'last_12_months' | 'last_5_years' | 'custom_range';

export default function DashboardScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const { user, tenant } = useAppSelector((state) => state.auth);

  const [stats, setStats] = useState<SalaryData | null>(null);
  const [loading, setLoading] = useState(false); // Changed to false - show UI immediately
  const [refreshing, setRefreshing] = useState(false);
  const [isLoadingInitial, setIsLoadingInitial] = useState(true); // Track initial load separately
  const [timePeriod, setTimePeriod] = useState<TimePeriod>('this_month');
  const [selectedDepartment, setSelectedDepartment] = useState('All');
  const [showFilters, setShowFilters] = useState(false);
  const [availableDepartments, setAvailableDepartments] = useState<string[]>([]);
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');
  const [showStartDateCalendar, setShowStartDateCalendar] = useState(false);
  const [showEndDateCalendar, setShowEndDateCalendar] = useState(false);

  // Define quick access shortcuts based on user role (limit to 4 items)
  const getQuickAccessItems = () => {
    const role = user?.role as string;
    const isAdmin = role === 'admin' || user?.is_admin || user?.is_superuser;
    const isHR = role === 'hr_manager' || role === 'hr-manager';
    const isPayroll = role === 'payroll_master';

    // Define all possible items with priority
    let items = [];

    if (isAdmin || isHR) {
      // Admin/HR: Employees, Payroll, Attendance, Reports
      items = [
        {
          icon: 'users',
          label: 'Employees',
          route: '/employees',
          color: colors.primary,
        },
        {
          icon: 'money',
          label: 'Payroll',
          route: '/payroll',
          color: colors.warning,
        },
        {
          icon: 'calendar-check-o',
          label: 'Attendance',
          route: '/(drawer)/attendance',
          color: colors.success,
        },
        {
          icon: 'file-text-o',
          label: 'Leaves',
          route: '/leaves',
          color: colors.info,
        },
      ];
    } else if (isPayroll) {
      // Payroll Master: Payroll, Employees, Attendance, Reports
      items = [
        {
          icon: 'money',
          label: 'Payroll',
          route: '/payroll',
          color: colors.warning,
        },
        {
          icon: 'users',
          label: 'Employees',
          route: '/employees',
          color: colors.primary,
        },
        {
          icon: 'calendar-check-o',
          label: 'Attendance',
          route: '/(drawer)/attendance',
          color: colors.success,
        },
        {
          icon: 'file-text-o',
          label: 'Leaves',
          route: '/leaves',
          color: colors.primary,
        },
      ];
    } else {
      // Regular Employee: Attendance, Leaves, Holidays, Profile
      items = [
        {
          icon: 'calendar-check-o',
          label: 'Attendance',
          route: '/(drawer)/attendance',
          color: colors.success,
        },
        {
          icon: 'file-text-o',
          label: 'Leave',
          route: '/leaves',
          color: colors.secondary,
        },
        {
          icon: 'calendar',
          label: 'Holidays',
          route: '/holidays',
          color: colors.info,
        },
        {
          icon: 'user',
          label: 'Profile',
          route: '/settings',
          color: colors.primary,
        },
      ];
    }

    return items.slice(0, 4); // Always return exactly 4 items
  };

  // Fetch available departments
  useEffect(() => {
    const fetchDepartments = async () => {
      try {
        const response = await api.get<{ departments: string[] }>('/api/dropdown-options/');
        setAvailableDepartments(response.departments || []);
      } catch (error) {
        console.error('Failed to fetch departments:', error);
      }
    };
    fetchDepartments();
  }, []);

  const loadDashboardData = async (showLoading = false) => {
    if (showLoading) {
      setLoading(true);
    }
    try {
      // Build query params exactly like web dashboard
      const params = new URLSearchParams();
      
      // Add time_period parameter
      if (timePeriod === 'custom_range' && customStartDate && customEndDate) {
        params.append('time_period', 'custom_range');
        params.append('start_date', customStartDate);
        params.append('end_date', customEndDate);
        params.append('no_cache', 'true'); // Cache-busting for custom ranges
      } else if (timePeriod === 'custom_range') {
        // Fallback to this_month if custom_range is selected but no dates provided
        params.append('time_period', 'this_month');
      } else {
        params.append('time_period', timePeriod);
      }
      
      // Add department parameter (always, even if 'All')
      // Handle "N/A" department like web dashboard
      const departmentParam = selectedDepartment === 'N/A' ? 'N/A' : (selectedDepartment || 'All');
      params.append('department', departmentParam);
      
      const url = `${API_ENDPOINTS.dashboardStats}?${params.toString()}`;
      console.log('📡 Dashboard API URL:', url);
      console.log('📡 Dashboard API Params:', { time_period: timePeriod, department: departmentParam });
      
      const data = await api.get<SalaryData>(url);
      console.log('📊 Dashboard data received:', {
        totalEmployees: data?.totalEmployees,
        avgAttendance: data?.avgAttendancePercentage,
        totalOTHours: data?.totalOTHours,
        totalLateMinutes: data?.totalLateMinutes,
        departmentDataLength: data?.departmentData?.length,
      });
      setStats(data);
    } catch (error: any) {
      console.error('❌ Failed to load dashboard data:', error);
      console.error('Error details:', error.response?.data || error.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
      setIsLoadingInitial(false);
    }
  };

  // Load data in background on mount - don't show loading spinner
  useEffect(() => {
    loadDashboardData(false); // Load in background
  }, [timePeriod, selectedDepartment, customStartDate, customEndDate]);

  const onRefresh = () => {
    setRefreshing(true);
    loadDashboardData(true); // Show loading on manual refresh
  };

  // Show skeleton only on initial load, not on subsequent loads
  if (isLoadingInitial && !stats) {
    return (
      <CreditProtectedScreen>
        <ScrollView style={[styles.container, { backgroundColor: colors.background }]}>
          <DashboardSkeleton />
        </ScrollView>
      </CreditProtectedScreen>
    );
  }

  const timePeriodOptions: { value: TimePeriod; label: string }[] = [
    { value: 'this_month', label: 'This Month' },
    { value: 'last_6_months', label: 'Last 6 Months' },
    { value: 'last_12_months', label: 'Last 12 Months' },
    { value: 'last_5_years', label: 'Last 5 Years' },
    { value: 'custom_range', label: 'Custom Range' },
  ];

  const departmentOptions = ['All', ...availableDepartments];

  return (
    <CreditProtectedScreen>
      <ScrollView
        style={[styles.container, { backgroundColor: colors.background }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
      <View style={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <Text style={[styles.welcomeText, { color: colors.text }]}>
              Welcome back, {user?.first_name || 'User'}!
            </Text>
            <TouchableOpacity
              style={[styles.filterButton, { backgroundColor: colors.primary }]}
              onPress={() => setShowFilters(!showFilters)}
            >
              <FontAwesome name="sliders" size={16} color="white" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Filters Panel */}
        {showFilters && (
          <View style={[styles.filtersPanel, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            {/* Time Period Filter */}
            <View style={styles.filterGroup}>
              <Text style={[styles.filterLabel, { color: colors.text }]}>Time Period</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterOptions}>
                {timePeriodOptions.map((option) => (
                  <TouchableOpacity
                    key={option.value}
                    style={[
                      styles.filterOption,
                      timePeriod === option.value && { backgroundColor: colors.primary },
                      timePeriod !== option.value && { backgroundColor: colors.background, borderColor: colors.border },
                    ]}
                    onPress={() => setTimePeriod(option.value)}
                  >
                    <Text
                      style={[
                        styles.filterOptionText,
                        timePeriod === option.value ? { color: 'white' } : { color: colors.text },
                      ]}
                    >
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            {/* Department Filter */}
            <View style={styles.filterGroup}>
              <Text style={[styles.filterLabel, { color: colors.text }]}>Department</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterOptions}>
                {departmentOptions.map((dept) => (
                  <TouchableOpacity
                    key={dept}
                    style={[
                      styles.filterOption,
                      selectedDepartment === dept && { backgroundColor: colors.primary },
                      selectedDepartment !== dept && { backgroundColor: colors.background, borderColor: colors.border },
                    ]}
                    onPress={() => setSelectedDepartment(dept)}
                  >
                    <Text
                      style={[
                        styles.filterOptionText,
                        selectedDepartment === dept ? { color: 'white' } : { color: colors.text },
                      ]}
                    >
                      {dept}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            {/* Custom Date Range */}
            {timePeriod === 'custom_range' && (
              <View style={styles.filterGroup}>
                <Text style={[styles.filterLabel, { color: colors.text }]}>Date Range</Text>
                <View style={styles.dateRangeContainer}>
                  <TouchableOpacity
                    style={[styles.dateInput, { backgroundColor: colors.background, borderColor: colors.border }]}
                    onPress={() => {
                      setShowStartDateCalendar(true);
                      setShowEndDateCalendar(false);
                    }}
                  >
                    <FontAwesome name="calendar" size={14} color={colors.primary} />
                    <Text style={[styles.dateInputText, { color: customStartDate ? colors.text : colors.textSecondary }]}>
                      {customStartDate ? format(new Date(customStartDate), 'dd MMM yyyy') : 'Start Date'}
                    </Text>
                  </TouchableOpacity>
                  
                  <Text style={[styles.dateRangeSeparator, { color: colors.textSecondary }]}>to</Text>
                  
                  <TouchableOpacity
                    style={[styles.dateInput, { backgroundColor: colors.background, borderColor: colors.border }]}
                    onPress={() => {
                      setShowEndDateCalendar(true);
                      setShowStartDateCalendar(false);
                    }}
                  >
                    <FontAwesome name="calendar" size={14} color={colors.primary} />
                    <Text style={[styles.dateInputText, { color: customEndDate ? colors.text : colors.textSecondary }]}>
                      {customEndDate ? format(new Date(customEndDate), 'dd MMM yyyy') : 'End Date'}
                    </Text>
                  </TouchableOpacity>
                </View>
                
                {(customStartDate || customEndDate) && (
                  <TouchableOpacity
                    style={[styles.clearDateButton, { backgroundColor: colors.error }]}
                    onPress={() => {
                      setCustomStartDate('');
                      setCustomEndDate('');
                    }}
                  >
                    <FontAwesome name="times" size={12} color="white" />
                    <Text style={styles.clearDateButtonText}>Clear Dates</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>
        )}

        {/* Date Calendar Modals */}
        {showStartDateCalendar && (
          <Modal
            visible={showStartDateCalendar}
            transparent={true}
            animationType="slide"
            onRequestClose={() => setShowStartDateCalendar(false)}
          >
            <View style={styles.calendarModalContainer}>
              <View style={[styles.calendarModalContent, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={styles.calendarModalHeader}>
                  <Text style={[styles.calendarModalTitle, { color: colors.text }]}>Select Start Date</Text>
                  <TouchableOpacity onPress={() => setShowStartDateCalendar(false)}>
                    <FontAwesome name="times" size={20} color={colors.text} />
                  </TouchableOpacity>
                </View>
                <Calendar
                  current={customStartDate || undefined}
                  onDayPress={(day) => {
                    setCustomStartDate(day.dateString);
                    setShowStartDateCalendar(false);
                  }}
                  maxDate={customEndDate || new Date().toISOString().split('T')[0]}
                  markedDates={{
                    ...(customStartDate ? {
                      [customStartDate]: {
                        selected: true,
                        selectedColor: colors.primary,
                      }
                    } : {})
                  }}
                  theme={{
                    backgroundColor: colors.surface,
                    calendarBackground: colors.surface,
                    textSectionTitleColor: colors.textSecondary,
                    selectedDayBackgroundColor: colors.primary,
                    selectedDayTextColor: '#ffffff',
                    todayTextColor: colors.primary,
                    dayTextColor: colors.text,
                    textDisabledColor: colors.textSecondary,
                    dotColor: colors.primary,
                    selectedDotColor: '#ffffff',
                    arrowColor: colors.primary,
                    monthTextColor: colors.text,
                    textDayFontWeight: '500',
                    textMonthFontWeight: '600',
                    textDayHeaderFontWeight: '600',
                  }}
                />
              </View>
            </View>
          </Modal>
        )}

        {showEndDateCalendar && (
          <Modal
            visible={showEndDateCalendar}
            transparent={true}
            animationType="slide"
            onRequestClose={() => setShowEndDateCalendar(false)}
          >
            <View style={styles.calendarModalContainer}>
              <View style={[styles.calendarModalContent, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={styles.calendarModalHeader}>
                  <Text style={[styles.calendarModalTitle, { color: colors.text }]}>Select End Date</Text>
                  <TouchableOpacity onPress={() => setShowEndDateCalendar(false)}>
                    <FontAwesome name="times" size={20} color={colors.text} />
                  </TouchableOpacity>
                </View>
                <Calendar
                  current={customEndDate || undefined}
                  onDayPress={(day) => {
                    setCustomEndDate(day.dateString);
                    setShowEndDateCalendar(false);
                  }}
                  minDate={customStartDate || undefined}
                  maxDate={new Date().toISOString().split('T')[0]}
                  markedDates={{
                    ...(customEndDate ? {
                      [customEndDate]: {
                        selected: true,
                        selectedColor: colors.primary,
                      }
                    } : {})
                  }}
                  theme={{
                    backgroundColor: colors.surface,
                    calendarBackground: colors.surface,
                    textSectionTitleColor: colors.textSecondary,
                    selectedDayBackgroundColor: colors.primary,
                    selectedDayTextColor: '#ffffff',
                    todayTextColor: colors.primary,
                    dayTextColor: colors.text,
                    textDisabledColor: colors.textSecondary,
                    dotColor: colors.primary,
                    selectedDotColor: '#ffffff',
                    arrowColor: colors.primary,
                    monthTextColor: colors.text,
                    textDayFontWeight: '500',
                    textMonthFontWeight: '600',
                    textDayHeaderFontWeight: '600',
                  }}
                />
              </View>
            </View>
          </Modal>
        )}

        {/* Quick Access Bar */}
        <View style={styles.quickAccessSection}>
          <View style={styles.quickAccessHeader}>
            <FontAwesome name="bolt" size={16} color={colors.primary} />
            <Text style={[styles.quickAccessTitle, { color: colors.text }]}>Quick Access</Text>
          </View>
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.quickAccessScroll}
          >
            {getQuickAccessItems().map((item, index) => (
              <TouchableOpacity
                key={index}
                style={styles.quickAccessItem}
                onPress={() => router.push(item.route as any)}
                activeOpacity={0.7}
              >
                <View style={[styles.quickAccessIconContainer, { backgroundColor: item.color }]}>
                  <FontAwesome name={item.icon as any} size={22} color="white" />
                </View>
                <Text style={[styles.quickAccessLabel, { color: colors.text }]} numberOfLines={2}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* KPI Section */}
        <View style={styles.kpiSection}>
          <Text style={[styles.kpiTitle, { color: colors.text }]}>Overview</Text>
          
          {/* KPI Grid - 2x2 */}
          <View style={styles.kpiGrid}>
            {/* Row 1 */}
            <View style={styles.kpiRow}>
              {/* Total Employees */}
              <View style={[styles.kpiCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={[styles.kpiIconCircle, { backgroundColor: colors.primary }]}>
                  <FontAwesome name="users" size={15} color="white" />
                </View>
                <Text style={[styles.kpiCardValue, { color: colors.text }]}>
                  {stats?.totalEmployees || 0}
                </Text>
                <Text style={[styles.kpiCardLabel, { color: colors.textSecondary }]}>
                  Total Employees
                </Text>
                {stats?.employeesChange !== undefined && stats.employeesChange !== 0 && (
                  <Text style={[styles.kpiChange, { color: stats.employeesChange > 0 ? colors.success : colors.error }]}>
                    {stats.employeesChange > 0 ? '+' : ''}{stats.employeesChange.toFixed(1)}%
                  </Text>
                )}
              </View>

              {/* Avg Attendance */}
              <View style={[styles.kpiCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={[styles.kpiIconCircle, { backgroundColor: colors.success }]}>
                  <FontAwesome name="check-circle" size={15} color="white" />
                </View>
                <Text style={[styles.kpiCardValue, { color: colors.text }]}>
                  {stats?.avgAttendancePercentage ? Math.round(stats.avgAttendancePercentage) : 0}%
                </Text>
                <Text style={[styles.kpiCardLabel, { color: colors.textSecondary }]}>
                  Avg Attendance
                </Text>
                {stats?.attendanceChange !== undefined && stats.attendanceChange !== 0 && (
                  <Text style={[styles.kpiChange, { color: stats.attendanceChange > 0 ? colors.success : colors.error }]}>
                    {stats.attendanceChange > 0 ? '+' : ''}{stats.attendanceChange.toFixed(1)}%
                  </Text>
                )}
              </View>
            </View>

            {/* Row 2 */}
            <View style={styles.kpiRow}>
              {/* Late Minutes */}
              <View style={[styles.kpiCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={[styles.kpiIconCircle, { backgroundColor: colors.error }]}>
                  <FontAwesome name="clock-o" size={15} color="white" />
                </View>
                <Text style={[styles.kpiCardValue, { color: colors.text }]}>
                  {stats?.totalLateMinutes ? Math.round(stats.totalLateMinutes) : 0}
                </Text>
                <Text style={[styles.kpiCardLabel, { color: colors.textSecondary }]}>
                  Late Minutes
                </Text>
                {stats?.lateMinutesChange !== undefined && stats.lateMinutesChange !== 0 && (
                  <Text style={[styles.kpiChange, { color: stats.lateMinutesChange < 0 ? colors.success : colors.error }]}>
                    {stats.lateMinutesChange > 0 ? '+' : ''}{stats.lateMinutesChange.toFixed(1)}%
                  </Text>
                )}
              </View>

              {/* OT Hours */}
              <View style={[styles.kpiCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={[styles.kpiIconCircle, { backgroundColor: colors.warning }]}>
                  <FontAwesome name="hourglass-half" size={15} color="white" />
                </View>
                <Text style={[styles.kpiCardValue, { color: colors.text }]}>
                  {stats?.totalOTHours ? Math.round(stats.totalOTHours) : 0}
                </Text>
                <Text style={[styles.kpiCardLabel, { color: colors.textSecondary }]}>
                  OT Hours
                </Text>
                {stats?.otHoursChange !== undefined && stats.otHoursChange !== 0 && (
                  <Text style={[styles.kpiChange, { color: stats.otHoursChange > 0 ? colors.success : colors.error }]}>
                    {stats.otHoursChange > 0 ? '+' : ''}{stats.otHoursChange.toFixed(1)}%
                  </Text>
                )}
              </View>
            </View>
          </View>
        </View>

        {/* Department Overview */}
        {stats?.departmentData && stats.departmentData.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Department Overview
            </Text>
            <View style={[styles.metricsGrid, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              {stats.departmentData.slice(0, 4).map((dept: { department: string; headcount: number; attendancePercentage: number }, index: number) => (
                <View key={index} style={styles.metricItem}>
                  <View style={[styles.metricIconContainer, { backgroundColor: `${colors.primary}15` }]}>
                    <FontAwesome name="building" size={16} color={colors.primary} />
                  </View>
                  <Text style={[styles.metricValue, { color: colors.text }]}>
                    {dept.headcount || 0}
                  </Text>
                  <Text style={[styles.metricLabel, { color: colors.textSecondary }]} numberOfLines={1}>
                    {dept.department || 'N/A'}
                  </Text>
                  <Text style={[styles.metricSubLabel, { color: colors.textSecondary }]}>
                    {dept.attendancePercentage ? Math.round(dept.attendancePercentage) : 0}% attendance
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Today's Attendance */}
        {stats?.todayAttendance && stats.todayAttendance.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Today's Attendance
            </Text>
            <View style={[styles.metricsGrid, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              {stats.todayAttendance.map((item: { status: string; count: number }, index: number) => (
                <View key={index} style={styles.metricItem}>
                  <View style={[styles.metricIconContainer, { 
                    backgroundColor: item.status === 'PRESENT' ? `${colors.success}15` : 
                                   item.status === 'ABSENT' ? `${colors.error}15` : 
                                   `${colors.warning}15` 
                  }]}>
                    <FontAwesome 
                      name={item.status === 'PRESENT' ? 'check-circle' : item.status === 'ABSENT' ? 'times-circle' : 'clock-o'} 
                      size={16} 
                      color={item.status === 'PRESENT' ? colors.success : item.status === 'ABSENT' ? colors.error : colors.warning} 
                    />
                  </View>
                  <Text style={[styles.metricValue, { 
                    color: item.status === 'PRESENT' ? colors.success : item.status === 'ABSENT' ? colors.error : colors.warning 
                  }]}>
                    {item.count || 0}
                  </Text>
                  <Text style={[styles.metricLabel, { color: colors.textSecondary }]}>
                    {item.status}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Salary Distribution */}
        {stats?.salaryDistribution && stats.salaryDistribution.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Salary Distribution
            </Text>
            <View style={[styles.cardContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              {stats.salaryDistribution.map((item: { range: string; count: number }, index: number) => {
                const maxCount = Math.max(...stats.salaryDistribution.map((d: { count: number }) => d.count));
                return (
                  <View key={index} style={styles.distributionRow}>
                    <Text style={[styles.distributionLabel, { color: colors.text }]}>
                      {item.range}
                    </Text>
                    <View style={[styles.distributionBarContainer, { backgroundColor: colors.border }]}>
                      <View 
                        style={[
                          styles.distributionBar, 
                          { 
                            width: `${Math.min((item.count / maxCount) * 100, 100)}%`,
                            backgroundColor: colors.primary 
                          }
                        ]} 
                      />
                    </View>
                    <Text style={[styles.distributionValue, { color: colors.text }]}>
                      {item.count}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* Salary Trends */}
        {stats?.salaryTrends && stats.salaryTrends.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Salary Trends
            </Text>
            <View style={[styles.cardContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              {stats.salaryTrends.slice(-6).map((trend: { month: string; averageSalary: number }, index: number) => (
                <View key={index} style={styles.trendRow}>
                  <Text style={[styles.trendLabel, { color: colors.textSecondary }]}>
                    {trend.month}
                  </Text>
                  <Text style={[styles.trendValue, { color: colors.text }]}>
                    ₹{Math.round(trend.averageSalary).toLocaleString()}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* OT Trends */}
        {stats?.otTrends && stats.otTrends.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              OT Hours Trends
            </Text>
            <View style={[styles.cardContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              {stats.otTrends.slice(-6).map((trend: { month: string; averageOTHours: number }, index: number, array: { month: string; averageOTHours: number }[]) => (
                <View key={index} style={[styles.trendRow, index === array.length - 1 && styles.trendRowLast]}>
                  <Text style={[styles.trendLabel, { color: colors.textSecondary }]}>
                    {trend.month}
                  </Text>
                  <Text style={[styles.trendValue, { color: colors.text }]}>
                    {Math.round(trend.averageOTHours)} hrs
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Late Minute Trends */}
        {stats?.lateMinuteTrends && stats.lateMinuteTrends.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Late Minutes Trends
            </Text>
            <View style={[styles.cardContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              {stats.lateMinuteTrends.slice(-6).map((trend: { month: string; averageLateMinutes: number }, index: number, array: { month: string; averageLateMinutes: number }[]) => (
                <View key={index} style={[styles.trendRow, index === array.length - 1 && styles.trendRowLast]}>
                  <Text style={[styles.trendLabel, { color: colors.textSecondary }]}>
                    {trend.month}
                  </Text>
                  <Text style={[styles.trendValue, { color: colors.text }]}>
                    {Math.round(trend.averageLateMinutes)} min
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Top Salaried Employees */}
        {stats?.topSalariedEmployees && stats.topSalariedEmployees.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Top Salaried Employees
            </Text>
            <View style={[styles.cardContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              {stats.topSalariedEmployees.slice(0, 5).map((emp: { name: string; salary: number; department: string }, index: number, array: { name: string; salary: number; department: string }[]) => (
                <View key={index} style={[styles.employeeRow, index === array.length - 1 && styles.employeeRowLast]}>
                  <View style={styles.employeeInfo}>
                    <Text style={[styles.employeeName, { color: colors.text }]}>
                      {emp.name}
                    </Text>
                    <Text style={[styles.employeeDept, { color: colors.textSecondary }]}>
                      {emp.department || 'N/A'}
                    </Text>
                  </View>
                  <Text style={[styles.employeeSalary, { color: colors.primary }]}>
                    ₹{Math.round(emp.salary).toLocaleString()}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Top Attendance Employees */}
        {stats?.topAttendanceEmployees && stats.topAttendanceEmployees.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Top Attendance Employees
            </Text>
            <View style={[styles.cardContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              {stats.topAttendanceEmployees.slice(0, 5).map((emp: { name: string; attendancePercentage: number; department: string }, index: number, array: { name: string; attendancePercentage: number; department: string }[]) => (
                <View key={index} style={[styles.employeeRow, index === array.length - 1 && styles.employeeRowLast]}>
                  <View style={styles.employeeInfo}>
                    <Text style={[styles.employeeName, { color: colors.text }]}>
                      {emp.name}
                    </Text>
                    <Text style={[styles.employeeDept, { color: colors.textSecondary }]}>
                      {emp.department || 'N/A'}
                    </Text>
                  </View>
                  <Text style={[styles.employeeAttendance, { color: colors.success }]}>
                    {Math.round(emp.attendancePercentage)}%
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}
      </View>
      </ScrollView>
    </CreditProtectedScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
  },
  header: {
    marginBottom: 20,
  },
  welcomeText: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  companyText: {
    fontSize: 16,
  },
  quickAccessSection: {
    marginBottom: 24,
  },
  quickAccessHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  quickAccessTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  quickAccessScroll: {
    paddingRight: 16,
  },
  quickAccessItem: {
    width: 70,
    marginRight: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickAccessIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  quickAccessLabel: {
    fontSize: 11,
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 14,
  },
  kpiSection: {
    marginBottom: 24,
  },
  kpiTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  kpiGrid: {
    gap: 12,
  },
  kpiRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  kpiCard: {
    flex: 1,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 95,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  kpiIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  kpiCardValue: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 2,
  },
  kpiCardLabel: {
    fontSize: 10,
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 12,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  deptCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  deptHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  deptName: {
    fontSize: 16,
    fontWeight: '500',
  },
  deptCount: {
    fontSize: 16,
    fontWeight: '600',
  },
  deptSalary: {
    fontSize: 14,
  },
  chartWrapper: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
    alignItems: 'center',
  },
  chart: {
    borderRadius: 8,
  },
  metricsGrid: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  metricItem: {
    alignItems: 'center',
    flex: 1,
  },
  metricIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  metricValue: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  metricLabel: {
    fontSize: 12,
    textAlign: 'center',
  },
  metricSubLabel: {
    fontSize: 10,
    textAlign: 'center',
    marginTop: 2,
  },
  kpiChange: {
    fontSize: 10,
    fontWeight: '600',
    marginTop: 4,
    textAlign: 'center',
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
  },
  filterButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  filtersPanel: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
    gap: 16,
  },
  filterGroup: {
    gap: 10,
  },
  filterLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 4,
  },
  filterOptions: {
    flexDirection: 'row',
  },
  filterOption: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginRight: 8,
    borderWidth: 1,
  },
  filterOptionText: {
    fontSize: 12,
    fontWeight: '500',
  },
  cardContainer: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    gap: 12,
  },
  distributionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  distributionLabel: {
    fontSize: 12,
    fontWeight: '500',
    minWidth: 80,
  },
  distributionBarContainer: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  distributionBar: {
    height: '100%',
    borderRadius: 4,
  },
  distributionValue: {
    fontSize: 12,
    fontWeight: '600',
    minWidth: 30,
    textAlign: 'right',
  },
  trendRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  trendRowLast: {
    borderBottomWidth: 0,
  },
  trendLabel: {
    fontSize: 13,
    fontWeight: '500',
  },
  trendValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  employeeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  employeeRowLast: {
    borderBottomWidth: 0,
  },
  employeeInfo: {
    flex: 1,
  },
  employeeName: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  employeeDept: {
    fontSize: 12,
  },
  employeeSalary: {
    fontSize: 14,
    fontWeight: '600',
  },
  employeeAttendance: {
    fontSize: 14,
    fontWeight: '600',
  },
  dateRangeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 8,
  },
  dateInput: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    gap: 8,
  },
  dateInputText: {
    fontSize: 13,
    fontWeight: '500',
  },
  dateRangeSeparator: {
    fontSize: 13,
    fontWeight: '500',
  },
  clearDateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    marginTop: 8,
    gap: 6,
  },
  clearDateButtonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  calendarModalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  calendarModalContent: {
    width: '90%',
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
  },
  calendarModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  calendarModalTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
});
