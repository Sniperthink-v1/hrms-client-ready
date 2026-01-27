// Employees List Screen
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  RefreshControl,
  Alert,
  ScrollView,
  Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { setEmployees, addEmployees, setLoading, setPagination, clearEmployees } from '@/store/slices/employeeSlice';
import { employeeService } from '@/services/employeeService';
import { EmployeeProfile } from '@/types';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { EmployeeListSkeleton } from '@/components/LoadingSkeleton';
import CreditProtectedScreen from '@/components/CreditProtectedScreen';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Dropdown, { DropdownOption } from '@/components/Dropdown';

export default function EmployeesScreen() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const { employees, isLoading, pagination } = useAppSelector((state) => state.employees);
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const insets = useSafeAreaInsets();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState('All');
  const [selectedStatus, setSelectedStatus] = useState<'all' | 'active' | 'inactive'>('all');
  const [showFilters, setShowFilters] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [departments, setDepartments] = useState<string[]>(['All']);
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeProfile | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [lastFetchParams, setLastFetchParams] = useState({ search: '', department: '' });
  const [editData, setEditData] = useState<Partial<EmployeeProfile> | null>(null);
  const [saving, setSaving] = useState(false);
  
  // Ref to track current employees count to avoid stale closure
  const employeesRef = useRef(employees);
  useEffect(() => {
    employeesRef.current = employees;
  }, [employees]);
  
  // Bulk selection state
  const [selectedEmployees, setSelectedEmployees] = useState<Set<number>>(new Set());
  const [bulkMode, setBulkMode] = useState(false);
  const [showBulkActions, setShowBulkActions] = useState(false);
  const [showRecentActions, setShowRecentActions] = useState(false);
  const [showBulkUpdateModal, setShowBulkUpdateModal] = useState(false);
  const [bulkUpdateField, setBulkUpdateField] = useState<string>('');
  const [bulkUpdateValue, setBulkUpdateValue] = useState<any>('');
  const [bulkUpdating, setBulkUpdating] = useState(false);

  // Automatically load all employees on mount and when filters change
  useEffect(() => {
    // Check if we need to reload based on filter changes
    const paramsChanged = 
      lastFetchParams.search !== searchQuery || 
      lastFetchParams.department !== selectedDepartment;
    
    // Only reload if filters changed OR no data cached
    if (paramsChanged || employees.length === 0) {
      loadAllEmployees();
      setLastFetchParams({ search: searchQuery, department: selectedDepartment });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, selectedDepartment]);

  // Automatically load all pages in background
  const loadAllEmployees = async () => {
    try {
      dispatch(setLoading(true));
      dispatch(clearEmployees());
      
      // Load first page
      const firstPage = await employeeService.getEmployees(1, searchQuery, selectedDepartment);
      dispatch(setEmployees(firstPage.results));
      dispatch(setPagination({
        count: firstPage.count,
        next: firstPage.next,
        previous: firstPage.previous,
      }));

      // Check if we already have all data (cached scenario)
      const totalCount = firstPage.count;
      const loadedCount = firstPage.results.length;
      
      // If first page has all data, no need to load more
      if (loadedCount >= totalCount) {
        dispatch(setLoading(false));
        setRefreshing(false);
        return;
      }

      // Calculate total pages and load remaining pages automatically
      const pageSize = firstPage.results.length || 20;
      const totalPages = Math.ceil(totalCount / pageSize);
      
      if (totalPages > 1) {
        setIsLoadingMore(true);
        // Load all remaining pages in background
        for (let page = 2; page <= totalPages; page++) {
          try {
            const response = await employeeService.getEmployees(page, searchQuery, selectedDepartment);
            dispatch(addEmployees(response.results));
            dispatch(setPagination({
              count: response.count,
              next: response.next,
              previous: response.previous,
            }));
            
            // Check if we've loaded all data using ref to avoid stale closure
            const currentLoadedCount = employeesRef.current.length + response.results.length;
            if (currentLoadedCount >= totalCount) {
              console.log(`✅ All ${totalCount} employees loaded from cache/API`);
              break;
            }
          } catch (error) {
            console.error(`Error loading page ${page}:`, error);
            break;
          }
        }
        setIsLoadingMore(false);
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to load employees');
    } finally {
      dispatch(setLoading(false));
      setRefreshing(false);
    }
  };

  const loadEmployees = async (page: number = 1, reset: boolean = false) => {
    try {
      dispatch(setLoading(true));
      const response = await employeeService.getEmployees(page, searchQuery, selectedDepartment);
      
      if (reset) {
        dispatch(setEmployees(response.results));
      } else {
        dispatch(addEmployees(response.results));
      }
      
      dispatch(setPagination({
        count: response.count,
        next: response.next,
        previous: response.previous,
      }));
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to load employees');
    } finally {
      dispatch(setLoading(false));
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadAllEmployees();
  };

  const handleEmployeePress = (employee: EmployeeProfile) => {
    router.push(`/(drawer)/employee-details/${employee.id}`);
  };

  const handleSave = async () => {
    if (!editData || !selectedEmployee) return;
    
    try {
      setSaving(true);
      await employeeService.updateEmployee(selectedEmployee.id, editData);
      
      // Refresh employee list
      await loadAllEmployees();
      
      // Update selected employee
      const updated = await employeeService.getEmployeeById(selectedEmployee.id);
      setSelectedEmployee(updated);
      setIsEditing(false);
      setEditData(null);
      Alert.alert('Success', 'Employee details updated successfully');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to update employee');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditData(null);
  };

  const toggleBulkMode = () => {
    setBulkMode(!bulkMode);
    if (bulkMode) {
      setSelectedEmployees(new Set());
    }
  };

  const toggleEmployeeSelection = (id: number) => {
    const newSelection = new Set(selectedEmployees);
    if (newSelection.has(id)) {
      newSelection.delete(id);
    } else {
      newSelection.add(id);
    }
    setSelectedEmployees(newSelection);
  };

  const handleBulkAction = async (action: 'activate' | 'deactivate' | 'delete' | 'update') => {
    const selectedIds = Array.from(selectedEmployees);
    if (selectedIds.length === 0) {
      Alert.alert('No Selection', 'Please select at least one employee');
      return;
    }

    const selectedEmployeesData = employees.filter(emp => selectedIds.includes(emp.id));

    try {
      switch (action) {
        case 'activate': {
          const inactiveIds = selectedEmployeesData
            .filter(emp => !emp.is_active)
            .map(emp => emp.id);
          
          if (inactiveIds.length === 0) {
            Alert.alert('Info', 'All selected employees are already active');
            setSelectedEmployees(new Set());
            return;
          }

          await employeeService.bulkToggleActiveStatus(inactiveIds, true);
          Alert.alert('Success', `Successfully activated ${inactiveIds.length} employee(s)`);
          await loadAllEmployees();
          setSelectedEmployees(new Set());
          setBulkMode(false);
          break;
        }
        case 'deactivate': {
          const activeIds = selectedEmployeesData
            .filter(emp => emp.is_active)
            .map(emp => emp.id);
          
          if (activeIds.length === 0) {
            Alert.alert('Info', 'All selected employees are already inactive');
            setSelectedEmployees(new Set());
            return;
          }

          await employeeService.bulkToggleActiveStatus(activeIds, false);
          Alert.alert('Success', `Successfully deactivated ${activeIds.length} employee(s)`);
          await loadAllEmployees();
          setSelectedEmployees(new Set());
          setBulkMode(false);
          break;
        }
        case 'delete': {
          Alert.alert(
            'Confirm Delete',
            `Are you sure you want to delete ${selectedEmployeesData.length} employee(s)? This action cannot be undone.`,
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Delete',
                style: 'destructive',
                onPress: async () => {
                  for (const emp of selectedEmployeesData) {
                    await employeeService.deleteEmployee(emp.id);
                  }
                  await loadAllEmployees();
                  setSelectedEmployees(new Set());
                  setBulkMode(false);
                  Alert.alert('Success', 'Employees deleted successfully');
                },
              },
            ]
          );
          break;
        }
        case 'update': {
          // Open bulk update modal - field selection will be handled in modal
          setBulkUpdateField('');
          setBulkUpdateValue('');
          setShowBulkUpdateModal(true);
          break;
        }
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to perform bulk action');
    }
  };

  // Sort employees alphabetically by first name and ensure unique keys
  // Memoize filtered and sorted employees to avoid unnecessary recalculations
  const sortedEmployees = useMemo(() => {
    return [...employees]
      .filter((emp, index, self) => 
        // Remove duplicates based on ID
        index === self.findIndex((e) => e.id === emp.id)
      )
      .sort((a, b) => {
        const nameA = (a.first_name || '').toLowerCase();
        const nameB = (b.first_name || '').toLowerCase();
        return nameA.localeCompare(nameB);
      });
  }, [employees]);

  // Memoize render function to prevent unnecessary re-renders
  const renderEmployeeItem = useCallback(({ item }: { item: EmployeeProfile }) => {
    const isSelected = selectedEmployees.has(item.id);
    
    return (
      <TouchableOpacity
        style={[
          styles.employeeCard, 
          { backgroundColor: colors.surface },
          bulkMode && isSelected && { borderColor: colors.primary, borderWidth: 2 }
        ]}
        onPress={() => bulkMode ? toggleEmployeeSelection(item.id) : handleEmployeePress(item)}
        onLongPress={() => {
          if (!bulkMode) {
            setBulkMode(true);
            toggleEmployeeSelection(item.id);
          }
        }}
        activeOpacity={0.6}
      >
        {/* Main Content */}
        <View style={styles.cardContent}>
          {/* Checkbox (when in bulk mode) */}
          {bulkMode && (
            <TouchableOpacity
              style={[
                styles.checkbox,
                { borderColor: colors.border },
                isSelected && { backgroundColor: colors.primary, borderColor: colors.primary }
              ]}
              onPress={() => toggleEmployeeSelection(item.id)}
            >
              {isSelected && <FontAwesome name="check" size={14} color="white" />}
            </TouchableOpacity>
          )}
          
          {/* Left: Avatar */}
          <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
            <Text style={styles.avatarText}>
              {item.first_name?.[0]?.toUpperCase() || 'E'}
            </Text>
          </View>

        {/* Middle: Name and Details */}
        <View style={styles.infoSection}>
          <Text style={[styles.employeeName, { color: colors.text }]} numberOfLines={1}>
            {item.first_name} {item.last_name || ''}
          </Text>
          <Text style={[styles.employeeId, { color: colors.textSecondary }]} numberOfLines={1}>
            {item.employee_id}
          </Text>
          <View style={styles.detailsRow}>
            {item.department && (
              <Text style={[styles.department, { color: colors.textSecondary }]} numberOfLines={1}>
                {item.department}
              </Text>
            )}
            {item.department && item.designation && (
              <Text style={[styles.dot, { color: colors.textSecondary }]}>•</Text>
            )}
            {item.designation && (
              <Text style={[styles.designation, { color: colors.primary }]} numberOfLines={1}>
                {item.designation}
              </Text>
            )}
          </View>
        </View>

        {/* Right: Status */}
        <View style={[styles.statusIndicator, { backgroundColor: item.is_active ? colors.success : colors.error }]} />
      </View>
    </TouchableOpacity>
    );
  }, [bulkMode, selectedEmployees, colors, toggleEmployeeSelection, handleEmployeePress]);

  const renderFooter = () => {
    if (!isLoadingMore) return null;
    return (
      <View style={styles.footer}>
        <ActivityIndicator size="small" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
          Loading all employees...
        </Text>
      </View>
    );
  };

  return (
    <CreditProtectedScreen>
      <View style={[styles.container, { backgroundColor: colors.background }]}>

        {/* Search and Filter Bar */}
      <View style={styles.searchFilterContainer}>
        {/* Search Bar */}
        <View style={[styles.searchContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <FontAwesome name="search" size={16} color={colors.textSecondary} style={styles.searchIcon} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder="Search by name, ID..."
            placeholderTextColor={colors.textLight}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <FontAwesome name="times" size={16} color={colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>

        {/* Recent Actions Button */}
        <TouchableOpacity
          style={[styles.recentActionsButton, { backgroundColor: '#E6F7F6', borderColor: colors.primary }]}
          onPress={() => setShowRecentActions(true)}
        >
          <FontAwesome name="clock-o" size={14} color={colors.primary} />
          <Text style={[styles.recentActionsButtonText, { color: colors.primary }]}>Recent</Text>
        </TouchableOpacity>

        {/* Bulk Mode Toggle */}
        {bulkMode ? (
          <TouchableOpacity
            style={[styles.bulkModeButton, { backgroundColor: colors.error }]}
            onPress={toggleBulkMode}
          >
            <FontAwesome name="times" size={16} color="white" />
          </TouchableOpacity>
        ) : (
          <>
            <TouchableOpacity
              style={[styles.filterButton, { backgroundColor: colors.primary }]}
              onPress={() => setShowFilters(!showFilters)}
            >
              <FontAwesome name="sliders" size={16} color="white" />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.bulkModeButton, { backgroundColor: colors.primary }]}
              onPress={toggleBulkMode}
            >
              <FontAwesome name="check-square-o" size={16} color="white" />
            </TouchableOpacity>
          </>
        )}
      </View>

      {/* Bulk Actions Bar */}
      {bulkMode && selectedEmployees.size > 0 && (
        <View style={[styles.bulkActionsBar, { backgroundColor: colors.primary }]}>
          <Text style={styles.bulkActionsText}>
            {selectedEmployees.size} selected
          </Text>
          <View style={styles.bulkActionsButtons}>
            <TouchableOpacity
              style={styles.bulkActionButton}
              onPress={() => handleBulkAction('activate')}
            >
              <FontAwesome name="check-circle" size={16} color="white" />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.bulkActionButton}
              onPress={() => handleBulkAction('deactivate')}
            >
              <FontAwesome name="times-circle" size={16} color="white" />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.bulkActionButton}
              onPress={() => handleBulkAction('update')}
            >
              <FontAwesome name="edit" size={16} color="white" />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.bulkActionButton}
              onPress={() => handleBulkAction('delete')}
            >
              <FontAwesome name="trash" size={16} color="white" />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Filters Panel */}
      {showFilters && (
        <View style={[styles.filtersPanel, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {/* Department Filter */}
          <View style={styles.filterGroup}>
            <Text style={[styles.filterLabel, { color: colors.text }]}>Department</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterOptions}>
              {['All', 'Sales', 'Engineering', 'HR', 'Finance', 'Operations'].map((dept) => (
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

          {/* Status Filter */}
          <View style={styles.filterGroup}>
            <Text style={[styles.filterLabel, { color: colors.text }]}>Status</Text>
            <View style={styles.statusFilterRow}>
              {(['all', 'active', 'inactive'] as const).map((status) => (
                <TouchableOpacity
                  key={status}
                  style={[
                    styles.statusFilterButton,
                    selectedStatus === status && { backgroundColor: colors.primary },
                    selectedStatus !== status && { backgroundColor: colors.background, borderColor: colors.border },
                  ]}
                  onPress={() => setSelectedStatus(status)}
                >
                  <Text
                    style={[
                      styles.statusFilterText,
                      selectedStatus === status ? { color: 'white' } : { color: colors.text },
                    ]}
                  >
                    {status.charAt(0).toUpperCase() + status.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      )}

      {/* Employee List */}
      {isLoading ? (
        <ScrollView style={styles.listContent} contentContainerStyle={{ padding: 16 }}>
          <EmployeeListSkeleton count={8} />
        </ScrollView>
      ) : sortedEmployees.length === 0 ? (
        <View style={styles.emptyContainer}>
          <FontAwesome name="users" size={48} color={colors.textLight} />
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
            No employees found
          </Text>
          <TouchableOpacity
            style={[styles.emptyButton, { backgroundColor: colors.primary }]}
            onPress={() => router.push('/employees/add')}
          >
            <Text style={styles.emptyButtonText}>Add Employee</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={sortedEmployees}
          renderItem={renderEmployeeItem}
          keyExtractor={(item, index) => `${item.id}-${index}`}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
          }
          ListFooterComponent={renderFooter}
        />
      )}

      {/* Employee Details Modal */}
      <Modal
        visible={showDetailsModal}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setShowDetailsModal(false)}
      >
        <View style={[styles.modalContainer, { backgroundColor: colors.background }]}>
          {/* Modal Header */}
          <View style={[styles.modalHeader, { backgroundColor: colors.primary, paddingTop: insets.top + 10 }]}>
            <TouchableOpacity onPress={() => setShowDetailsModal(false)}>
              <FontAwesome name="arrow-left" size={20} color="white" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Employee Details</Text>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              {isEditing ? (
                <>
                  <TouchableOpacity onPress={handleSave} disabled={saving}>
                    <FontAwesome name="check" size={20} color="white" />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={handleCancel} disabled={saving}>
                    <FontAwesome name="times" size={20} color="white" />
                  </TouchableOpacity>
                </>
              ) : (
                <TouchableOpacity onPress={() => {
                  setEditData({ ...selectedEmployee });
                  setIsEditing(true);
                }}>
                  <FontAwesome name="edit" size={20} color="white" />
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Modal Content */}
          {selectedEmployee && (
            <ScrollView style={styles.modalContent}>
              {/* Employee Header */}
              <View style={[styles.employeeHeader, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={[styles.largeAvatar, { backgroundColor: colors.primary }]}>
                  <Text style={styles.largeAvatarText}>
                    {selectedEmployee.first_name?.[0]?.toUpperCase() || 'E'}
                  </Text>
                </View>
                <View style={styles.employeeHeaderInfo}>
                  <Text style={[styles.employeeHeaderName, { color: colors.text }]}>
                    {selectedEmployee.first_name} {selectedEmployee.last_name || ''}
                  </Text>
                  <Text style={[styles.employeeHeaderId, { color: colors.textSecondary }]}>
                    {selectedEmployee.employee_id}
                  </Text>
                  <View style={[styles.statusBadge, { backgroundColor: selectedEmployee.is_active ? colors.success : colors.error }]}>
                    <Text style={styles.statusBadgeText}>
                      {selectedEmployee.is_active ? 'Active' : 'Inactive'}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Details Sections */}
              <View style={styles.detailsSection}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>Personal Information</Text>
                <EditableRow 
                  label="First Name" 
                  value={isEditing ? editData?.first_name : selectedEmployee.first_name}
                  onChange={(val) => setEditData(prev => ({ ...prev, first_name: val }))}
                  editable={isEditing}
                  colors={colors}
                />
                <EditableRow 
                  label="Last Name" 
                  value={isEditing ? editData?.last_name : selectedEmployee.last_name}
                  onChange={(val) => setEditData(prev => ({ ...prev, last_name: val }))}
                  editable={isEditing}
                  colors={colors}
                />
                <EditableRow 
                  label="Email" 
                  value={isEditing ? editData?.email : selectedEmployee.email}
                  onChange={(val) => setEditData(prev => ({ ...prev, email: val }))}
                  editable={isEditing}
                  colors={colors}
                />
                <EditableRow 
                  label="Phone" 
                  value={isEditing ? editData?.mobile_number : selectedEmployee.mobile_number}
                  onChange={(val) => setEditData(prev => ({ ...prev, mobile_number: val }))}
                  editable={isEditing}
                  colors={colors}
                />
                <EditableRow 
                  label="Date of Birth" 
                  value={isEditing ? editData?.date_of_birth : selectedEmployee.date_of_birth}
                  onChange={(val) => setEditData(prev => ({ ...prev, date_of_birth: val }))}
                  editable={isEditing}
                  colors={colors}
                />
                <EditableRow 
                  label="Gender" 
                  value={isEditing ? editData?.gender : selectedEmployee.gender}
                  onChange={(val) => setEditData(prev => ({ ...prev, gender: val as any }))}
                  editable={isEditing}
                  colors={colors}
                />
                <EditableRow 
                  label="Marital Status" 
                  value={isEditing ? editData?.marital_status : selectedEmployee.marital_status}
                  onChange={(val) => setEditData(prev => ({ ...prev, marital_status: val as any }))}
                  editable={isEditing}
                  colors={colors}
                />
                <EditableRow 
                  label="Nationality" 
                  value={isEditing ? editData?.nationality : selectedEmployee.nationality}
                  onChange={(val) => setEditData(prev => ({ ...prev, nationality: val }))}
                  editable={isEditing}
                  colors={colors}
                />
                <EditableRow 
                  label="Address" 
                  value={isEditing ? editData?.address : selectedEmployee.address}
                  onChange={(val) => setEditData(prev => ({ ...prev, address: val }))}
                  editable={isEditing}
                  colors={colors}
                  multiline
                />
                <EditableRow 
                  label="City" 
                  value={isEditing ? editData?.city : selectedEmployee.city}
                  onChange={(val) => setEditData(prev => ({ ...prev, city: val }))}
                  editable={isEditing}
                  colors={colors}
                />
                <EditableRow 
                  label="State" 
                  value={isEditing ? editData?.state : selectedEmployee.state}
                  onChange={(val) => setEditData(prev => ({ ...prev, state: val }))}
                  editable={isEditing}
                  colors={colors}
                />
              </View>

              <View style={styles.detailsSection}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>Professional Information</Text>
                <DetailRow label="Employee ID" value={selectedEmployee.employee_id} />
                <EditableRow 
                  label="Department" 
                  value={isEditing ? editData?.department : selectedEmployee.department}
                  onChange={(val) => setEditData(prev => ({ ...prev, department: val }))}
                  editable={isEditing}
                  colors={colors}
                />
                <EditableRow 
                  label="Designation" 
                  value={isEditing ? editData?.designation : selectedEmployee.designation}
                  onChange={(val) => setEditData(prev => ({ ...prev, designation: val }))}
                  editable={isEditing}
                  colors={colors}
                />
                <EditableRow 
                  label="Employment Type" 
                  value={isEditing ? editData?.employment_type : selectedEmployee.employment_type}
                  onChange={(val) => setEditData(prev => ({ ...prev, employment_type: val as any }))}
                  editable={isEditing}
                  colors={colors}
                />
                <EditableRow 
                  label="Date of Joining" 
                  value={isEditing ? editData?.date_of_joining : selectedEmployee.date_of_joining}
                  onChange={(val) => setEditData(prev => ({ ...prev, date_of_joining: val }))}
                  editable={isEditing}
                  colors={colors}
                />
                <EditableRow 
                  label="Location/Branch" 
                  value={isEditing ? editData?.location_branch : selectedEmployee.location_branch}
                  onChange={(val) => setEditData(prev => ({ ...prev, location_branch: val }))}
                  editable={isEditing}
                  colors={colors}
                />
                <EditableRow 
                  label="Basic Salary" 
                  value={isEditing ? editData?.basic_salary?.toString() : selectedEmployee.basic_salary?.toString()}
                  onChange={(val) => setEditData(prev => ({ ...prev, basic_salary: parseFloat(val) || 0 }))}
                  editable={isEditing}
                  colors={colors}
                  keyboardType="numeric"
                />
                <EditableRow 
                  label="Shift Start Time" 
                  value={isEditing ? editData?.shift_start_time : selectedEmployee.shift_start_time}
                  onChange={(val) => setEditData(prev => ({ ...prev, shift_start_time: val }))}
                  editable={isEditing}
                  colors={colors}
                />
                <EditableRow 
                  label="Shift End Time" 
                  value={isEditing ? editData?.shift_end_time : selectedEmployee.shift_end_time}
                  onChange={(val) => setEditData(prev => ({ ...prev, shift_end_time: val }))}
                  editable={isEditing}
                  colors={colors}
                />
              </View>
            </ScrollView>
          )}
        </View>
      </Modal>

      {/* Bulk Update Modal */}
      <BulkUpdateModal
        visible={showBulkUpdateModal}
        onClose={() => {
          setShowBulkUpdateModal(false);
          setBulkUpdateField('');
          setBulkUpdateValue('');
        }}
        onUpdate={async (field: string, value: any) => {
          const selectedIds = Array.from(selectedEmployees);
          if (selectedIds.length === 0) {
            Alert.alert('No Selection', 'Please select at least one employee');
            return;
          }

          try {
            setBulkUpdating(true);
            const updates: any = {};
            updates[field] = value;
            await employeeService.bulkUpdate(selectedIds, updates);
            Alert.alert('Success', `Successfully updated ${selectedIds.length} employee(s)`);
            await loadAllEmployees();
            setSelectedEmployees(new Set());
            setBulkMode(false);
            setShowBulkUpdateModal(false);
            setBulkUpdateField('');
            setBulkUpdateValue('');
          } catch (error: any) {
            Alert.alert('Error', error.message || 'Failed to update employees');
          } finally {
            setBulkUpdating(false);
          }
        }}
        field={bulkUpdateField}
        value={bulkUpdateValue}
        colors={colors}
      />

      {/* Recent Bulk Actions Modal */}
      {showRecentActions && (
        <RecentBulkActionsModal
          visible={showRecentActions}
          onClose={() => setShowRecentActions(false)}
          onActionReverted={() => {
            loadAllEmployees();
          }}
          colors={colors}
        />
      )}
      </View>
    </CreditProtectedScreen>
  );
}

// Format helper functions
const formatEmploymentType = (value?: string): string => {
  if (!value) return '';
  const map: Record<string, string> = {
    'FULL_TIME': 'Full-time',
    'PART_TIME': 'Part-time',
    'CONTRACT': 'Contract',
    'INTERN': 'Intern',
  };
  return map[value] || value;
};

const formatGender = (value?: string): string => {
  if (!value) return '';
  const map: Record<string, string> = {
    'MALE': 'Male',
    'FEMALE': 'Female',
    'OTHER': 'Other',
  };
  return map[value] || value;
};

const formatMaritalStatus = (value?: string): string => {
  if (!value) return '';
  const map: Record<string, string> = {
    'SINGLE': 'Single',
    'MARRIED': 'Married',
    'DIVORCED': 'Divorced',
    'WIDOWED': 'Widowed',
  };
  return map[value] || value;
};

// Detail Row Component
const DetailRow = ({ label, value, colors: themeColors }: { label: string; value?: string; colors?: any }) => {
  const colorScheme = useColorScheme();
  const colors = themeColors || Colors[colorScheme ?? 'light'];

  // Format value based on label
  let displayValue = value || '';
  if (label === 'Employment Type') {
    displayValue = formatEmploymentType(value);
  } else if (label === 'Gender') {
    displayValue = formatGender(value);
  } else if (label === 'Marital Status') {
    displayValue = formatMaritalStatus(value);
  }

  return (
    <View style={styles.detailRow}>
      <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>{label}</Text>
      <Text style={[styles.detailValue, { color: colors.text }]}>{displayValue || ''}</Text>
    </View>
  );
}

// Editable Row Component
const EditableRow = ({ 
  label, 
  value, 
  onChange, 
  editable, 
  colors: themeColors,
  multiline = false,
  keyboardType = 'default'
}: { 
  label: string; 
  value?: string; 
  onChange: (val: string) => void;
  editable: boolean;
  colors?: any;
  multiline?: boolean;
  keyboardType?: 'default' | 'numeric' | 'email-address';
}) => {
  const colorScheme = useColorScheme();
  const colors = themeColors || Colors[colorScheme ?? 'light'];

  if (editable) {
    return (
      <View style={styles.detailRow}>
        <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>{label}</Text>
        <TextInput
          style={[styles.editableInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface }]}
          value={value || ''}
          onChangeText={onChange}
          multiline={multiline}
          numberOfLines={multiline ? 3 : 1}
          keyboardType={keyboardType}
        />
      </View>
    );
  }

  // Format value for display when not editing
  let displayValue = value || '';
  if (label === 'Employment Type') {
    displayValue = formatEmploymentType(value);
  } else if (label === 'Gender') {
    displayValue = formatGender(value);
  } else if (label === 'Marital Status') {
    displayValue = formatMaritalStatus(value);
  }

  return <DetailRow label={label} value={displayValue} colors={colors} />;
}

// Bulk Update Modal Component
interface BulkUpdateModalProps {
  visible: boolean;
  onClose: () => void;
  onUpdate: (field: string, value: any) => Promise<void>;
  field: string;
  value: any;
  colors: any;
}

const BulkUpdateModal: React.FC<BulkUpdateModalProps> = ({ visible, onClose, onUpdate, field, value, colors }) => {
  const [updateField, setUpdateField] = useState('');
  const [updateValue, setUpdateValue] = useState<any>('');
  const [dropdownOptions, setDropdownOptions] = useState<{
    departments: string[];
    designations: string[];
    locations: string[];
  }>({
    departments: [],
    designations: [],
    locations: [],
  });

  useEffect(() => {
    if (visible && field) {
      setUpdateField(field);
      setUpdateValue(value || '');
    }
  }, [visible, field, value]);

  useEffect(() => {
    if (visible) {
      fetchDropdownOptions();
    }
  }, [visible]);

  const fetchDropdownOptions = async () => {
    try {
      // Fetch from API
      const { api } = await import('@/services/api');
      const response = await api.get<{
        departments: string[];
        designations: string[];
        locations: string[];
      }>('/api/dropdown-options/');
      
      // Also get from employees for any missing values
      const employeeResponse = await employeeService.getEmployees(1);
      const allEmployees = employeeResponse.results;
      
      const departments = new Set<string>(response.departments || []);
      const designations = new Set<string>(response.designations || []);
      const locations = new Set<string>(response.locations || []);
      
      // Add any additional values from employees
      allEmployees.forEach((emp: EmployeeProfile) => {
        if (emp.department) departments.add(emp.department);
        if (emp.designation) designations.add(emp.designation);
        if (emp.location_branch) locations.add(emp.location_branch);
      });
      
      setDropdownOptions({
        departments: Array.from(departments).sort(),
        designations: Array.from(designations).sort(),
        locations: Array.from(locations).sort(),
      });
    } catch (error) {
      console.error('Failed to fetch dropdown options:', error);
      // Fallback: extract from employees only
      try {
        const response = await employeeService.getEmployees(1);
        const allEmployees = response.results;
        
        const departments = new Set<string>();
        const designations = new Set<string>();
        const locations = new Set<string>();
        
        allEmployees.forEach((emp: EmployeeProfile) => {
          if (emp.department) departments.add(emp.department);
          if (emp.designation) designations.add(emp.designation);
          if (emp.location_branch) locations.add(emp.location_branch);
        });
        
        setDropdownOptions({
          departments: Array.from(departments).sort(),
          designations: Array.from(designations).sort(),
          locations: Array.from(locations).sort(),
        });
      } catch (fallbackError) {
        console.error('Failed to fetch from employees:', fallbackError);
      }
    }
  };

  const handleSubmit = async () => {
    if (!updateField) {
      Alert.alert('Error', 'Please select a field to update');
      return;
    }
    if (!updateValue || updateValue === '') {
      Alert.alert('Error', 'Please enter a value');
      return;
    }
    await onUpdate(updateField, updateValue);
  };

  const fieldOptions = [
    { value: 'department', label: 'Department' },
    { value: 'designation', label: 'Designation' },
    { value: 'employment_type', label: 'Employment Type' },
    { value: 'location_branch', label: 'Location/Branch' },
  ];

  const employmentTypeOptions = [
    { value: 'FULL_TIME', label: 'Full-time' },
    { value: 'PART_TIME', label: 'Part-time' },
    { value: 'CONTRACT', label: 'Contract' },
    { value: 'INTERN', label: 'Intern' },
  ];

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={[styles.bulkUpdateModal, { backgroundColor: colors.surface }]}>
          {/* Header */}
          <View style={[styles.bulkUpdateHeader, { backgroundColor: colors.primary }]}>
            <View style={styles.bulkUpdateHeaderLeft}>
              <FontAwesome name="edit" size={20} color="white" />
              <Text style={styles.bulkUpdateTitle}>Bulk Update Employees</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.bulkUpdateCloseButton}>
              <FontAwesome name="times" size={18} color="white" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.bulkUpdateContent} showsVerticalScrollIndicator={false}>
            {/* Info Box */}
            <View style={[styles.bulkUpdateInfoBox, { backgroundColor: colors.background, borderColor: colors.border }]}>
              <FontAwesome name="info-circle" size={16} color={colors.primary} />
              <Text style={[styles.bulkUpdateInfoText, { color: colors.textSecondary }]}>
                Select a field and enter the new value to update all selected employees.
              </Text>
            </View>

            {/* Field Selection */}
            <View style={styles.bulkUpdateSection}>
              <Text style={[styles.bulkUpdateSectionTitle, { color: colors.text }]}>1. Select Field</Text>
              <View style={styles.bulkUpdateOptionsGrid}>
                {fieldOptions.map((option) => (
                  <TouchableOpacity
                    key={option.value}
                    style={[
                      styles.bulkUpdateOptionCard,
                      updateField === option.value && { backgroundColor: colors.primary, borderColor: colors.primary },
                      updateField !== option.value && { backgroundColor: colors.background, borderColor: colors.border },
                    ]}
                    onPress={() => {
                      setUpdateField(option.value);
                      setUpdateValue(''); // Reset value when field changes
                    }}
                  >
                    <Text
                      style={[
                        styles.bulkUpdateOptionCardText,
                        updateField === option.value ? { color: 'white' } : { color: colors.text },
                      ]}
                    >
                      {option.label}
                    </Text>
                    {updateField === option.value && (
                      <FontAwesome name="check-circle" size={16} color="white" style={{ marginLeft: 8 }} />
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Value Input */}
            {updateField && (
              <View style={styles.bulkUpdateSection}>
                <Text style={[styles.bulkUpdateSectionTitle, { color: colors.text }]}>2. Enter New Value</Text>
                {updateField === 'employment_type' ? (
                  <View style={styles.bulkUpdateOptionsGrid}>
                    {employmentTypeOptions.map((option) => (
                      <TouchableOpacity
                        key={option.value}
                        style={[
                          styles.bulkUpdateOptionCard,
                          updateValue === option.value && { backgroundColor: colors.primary, borderColor: colors.primary },
                          updateValue !== option.value && { backgroundColor: colors.background, borderColor: colors.border },
                        ]}
                        onPress={() => setUpdateValue(option.value)}
                      >
                        <Text
                          style={[
                            styles.bulkUpdateOptionCardText,
                            updateValue === option.value ? { color: 'white' } : { color: colors.text },
                          ]}
                        >
                          {option.label}
                        </Text>
                        {updateValue === option.value && (
                          <FontAwesome name="check-circle" size={16} color="white" style={{ marginLeft: 8 }} />
                        )}
                      </TouchableOpacity>
                    ))}
                  </View>
                ) : updateField === 'department' ? (
                  <Dropdown
                    options={dropdownOptions.departments.map(dept => ({ value: dept, label: dept }))}
                    value={updateValue || ''}
                    onChange={setUpdateValue}
                    placeholder="Select Department"
                    searchable={true}
                    allowCustom={true}
                    onCustomAdd={(value) => {
                      setDropdownOptions(prev => ({
                        ...prev,
                        departments: [...prev.departments, value].sort()
                      }));
                      setUpdateValue(value);
                    }}
                    colors={colors}
                  />
                ) : updateField === 'designation' ? (
                  <Dropdown
                    options={dropdownOptions.designations.map(des => ({ value: des, label: des }))}
                    value={updateValue || ''}
                    onChange={setUpdateValue}
                    placeholder="Select Designation"
                    searchable={true}
                    allowCustom={true}
                    onCustomAdd={(value) => {
                      setDropdownOptions(prev => ({
                        ...prev,
                        designations: [...prev.designations, value].sort()
                      }));
                      setUpdateValue(value);
                    }}
                    colors={colors}
                  />
                ) : updateField === 'location_branch' ? (
                  <Dropdown
                    options={dropdownOptions.locations.map(loc => ({ value: loc, label: loc }))}
                    value={updateValue || ''}
                    onChange={setUpdateValue}
                    placeholder="Select Location/Branch"
                    searchable={true}
                    allowCustom={true}
                    onCustomAdd={(value) => {
                      setDropdownOptions(prev => ({
                        ...prev,
                        locations: [...prev.locations, value].sort()
                      }));
                      setUpdateValue(value);
                    }}
                    colors={colors}
                  />
                ) : (
                  <View style={[styles.bulkUpdateInputContainer, { backgroundColor: colors.background, borderColor: colors.border }]}>
                    <TextInput
                      style={[styles.bulkUpdateInput, { color: colors.text }]}
                      value={updateValue}
                      onChangeText={setUpdateValue}
                      placeholder={`Enter ${fieldOptions.find(f => f.value === updateField)?.label.toLowerCase() || 'value'}`}
                      placeholderTextColor={colors.textLight}
                      autoCapitalize="none"
                    />
                  </View>
                )}
              </View>
            )}
          </ScrollView>

          {/* Footer */}
          <View style={[styles.bulkUpdateFooter, { borderTopColor: colors.border, backgroundColor: colors.surface }]}>
            <TouchableOpacity
              style={[styles.bulkUpdateCancelButton, { backgroundColor: colors.background, borderColor: colors.border }]}
              onPress={onClose}
            >
              <Text style={[styles.bulkUpdateCancelButtonText, { color: colors.text }]}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.bulkUpdateSubmitButton,
                { backgroundColor: colors.primary },
                (!updateField || !updateValue) && { opacity: 0.5 }
              ]}
              onPress={handleSubmit}
              disabled={!updateField || !updateValue}
            >
              <FontAwesome name="check" size={16} color="white" style={{ marginRight: 8 }} />
              <Text style={styles.bulkUpdateSubmitButtonText}>Update Employees</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

// Recent Bulk Actions Modal Component
interface RecentBulkActionsModalProps {
  visible: boolean;
  onClose: () => void;
  onActionReverted?: () => void;
  colors: any;
}

interface BulkAction {
  action_id: string;
  action_type: string;
  employee_count: number;
  performed_at: string;
  performed_by: string | null;
  reverted: boolean;
  reverted_at: string | null;
  reverted_by: string | null;
  changes_summary: {
    fields_updated: string[];
    employee_count: number;
  };
}

const RecentBulkActionsModal: React.FC<RecentBulkActionsModalProps> = ({ visible, onClose, onActionReverted, colors }) => {
  const [actions, setActions] = useState<BulkAction[]>([]);
  const [loading, setLoading] = useState(false);
  const [reverting, setReverting] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      fetchActions();
    }
  }, [visible]);

  const fetchActions = async () => {
    setLoading(true);
    try {
      const data = await employeeService.getBulkUpdateHistory(10);
      console.log('Bulk actions data:', data);
      setActions(data.history || []);
    } catch (error: any) {
      console.error('Failed to fetch bulk actions:', error);
      Alert.alert('Error', error.message || 'Failed to load recent bulk actions');
      setActions([]);
    } finally {
      setLoading(false);
    }
  };

  const handleRevert = async (actionId: string) => {
    setReverting(actionId);
    try {
      const result = await employeeService.revertBulkUpdate(actionId);
      Alert.alert('Success', result.message || 'Action reverted successfully');
      fetchActions();
      if (onActionReverted) {
        onActionReverted();
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to revert action');
    } finally {
      setReverting(null);
      setShowConfirm(null);
    }
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)} days ago`;
    return date.toLocaleDateString();
  };

  const formatFieldName = (field: string) => {
    return field
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={[styles.recentActionsModal, { backgroundColor: colors.surface }]}>
          <View style={styles.recentActionsHeader}>
            <View style={styles.recentActionsHeaderLeft}>
              <FontAwesome name="clock-o" size={20} color="white" />
              <Text style={styles.recentActionsTitle}>Recent Bulk Actions</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.recentActionsCloseHeaderButton}>
              <FontAwesome name="times" size={18} color="white" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.recentActionsContent}>
            {loading ? (
              <View style={styles.recentActionsLoading}>
                <ActivityIndicator size="large" color={colors.primary} />
              </View>
            ) : actions.length === 0 ? (
              <View style={styles.recentActionsEmpty}>
                <FontAwesome name="clock-o" size={48} color={colors.textLight} />
                <Text style={[styles.recentActionsEmptyText, { color: colors.textSecondary }]}>
                  No recent bulk actions
                </Text>
              </View>
            ) : (
              <View style={styles.recentActionsList}>
                {actions.map((action) => (
                  <View
                    key={action.action_id}
                    style={[
                      styles.recentActionItem,
                      { backgroundColor: action.reverted ? colors.background : colors.surface, borderColor: colors.border }
                    ]}
                  >
                    <View style={styles.recentActionContent}>
                      <View style={styles.recentActionTime}>
                        <FontAwesome name="clock-o" size={14} color={colors.textSecondary} />
                        <Text style={[styles.recentActionTimeText, { color: colors.textSecondary }]}>
                          {formatTimeAgo(action.performed_at)}
                        </Text>
                      </View>

                      <Text style={[styles.recentActionTitle, { color: colors.text }]}>
                        Updated {action.employee_count} employee{action.employee_count !== 1 ? 's' : ''}
                      </Text>

                      <Text style={[styles.recentActionFields, { color: colors.textSecondary }]}>
                        Fields: {action.changes_summary.fields_updated.map(formatFieldName).join(', ')}
                      </Text>

                      <Text style={[styles.recentActionBy, { color: colors.textLight }]}>
                        By: {action.performed_by || 'Unknown'}
                      </Text>

                      {action.reverted && (
                        <View style={styles.recentActionReverted}>
                          <FontAwesome name="check-circle" size={14} color={colors.success} />
                          <Text style={[styles.recentActionRevertedText, { color: colors.success }]}>
                            Reverted by {action.reverted_by || 'Unknown'}
                          </Text>
                        </View>
                      )}
                    </View>

                    {!action.reverted && (
                      <View>
                        {showConfirm === action.action_id ? (
                          <View style={styles.recentActionConfirm}>
                            <Text style={[styles.recentActionConfirmText, { color: colors.textSecondary }]}>
                              Confirm revert?
                            </Text>
                            <View style={styles.recentActionConfirmButtons}>
                              <TouchableOpacity
                                style={[styles.recentActionConfirmButton, { backgroundColor: colors.error }]}
                                onPress={() => handleRevert(action.action_id)}
                                disabled={reverting === action.action_id}
                              >
                                {reverting === action.action_id ? (
                                  <ActivityIndicator size="small" color="white" />
                                ) : (
                                  <>
                                    <FontAwesome name="undo" size={12} color="white" />
                                    <Text style={styles.recentActionConfirmButtonText}>Yes</Text>
                                  </>
                                )}
                              </TouchableOpacity>
                              <TouchableOpacity
                                style={[styles.recentActionConfirmButton, { backgroundColor: colors.border }]}
                                onPress={() => setShowConfirm(null)}
                              >
                                <Text style={[styles.recentActionConfirmButtonText, { color: colors.text }]}>No</Text>
                              </TouchableOpacity>
                            </View>
                          </View>
                        ) : (
                          <TouchableOpacity
                            style={[styles.recentActionUndoButton, { backgroundColor: colors.primary }]}
                            onPress={() => setShowConfirm(action.action_id)}
                          >
                            <FontAwesome name="undo" size={14} color="white" />
                            <Text style={styles.recentActionUndoText}>Undo</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    )}
                  </View>
                ))}
              </View>
            )}
          </ScrollView>

          <View style={[styles.recentActionsFooter, { borderTopColor: colors.border }]}>
            <TouchableOpacity
              style={[styles.recentActionsCloseButton, { backgroundColor: colors.border }]}
              onPress={onClose}
            >
              <Text style={[styles.recentActionsCloseText, { color: colors.text }]}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchFilterContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    gap: 10,
  },
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
  },
  recentActionsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1.5,
    gap: 6,
    minHeight: 44,
  },
  recentActionsButtonText: {
    fontSize: 13,
    fontWeight: '600',
  },
  filterButton: {
    width: 44,
    height: 44,
    borderRadius: 10,
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
    borderTopWidth: 1,
    borderBottomWidth: 1,
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
  statusFilterRow: {
    flexDirection: 'row',
    gap: 10,
  },
  statusFilterButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
  },
  statusFilterText: {
    fontSize: 13,
    fontWeight: '500',
  },
  listContent: {
    padding: 16,
  },
  employeeCard: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  avatarText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '700',
  },
  infoSection: {
    flex: 1,
    justifyContent: 'center',
  },
  employeeName: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 2,
  },
  employeeId: {
    fontSize: 12,
    marginBottom: 3,
  },
  detailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  department: {
    fontSize: 11,
    fontWeight: '400',
  },
  dot: {
    fontSize: 10,
    fontWeight: '400',
  },
  designation: {
    fontSize: 11,
    fontWeight: '500',
  },
  statusIndicator: {
    width: 10,
    height: 10,
    borderRadius: 5,
    flexShrink: 0,
  },
  footer: {
    padding: 16,
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyText: {
    fontSize: 16,
    marginTop: 16,
    marginBottom: 24,
  },
  emptyButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  emptyButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 14,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: 'white',
  },
  modalContent: {
    flex: 1,
    padding: 16,
  },
  employeeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
    gap: 16,
  },
  largeAvatar: {
    width: 70,
    height: 70,
    borderRadius: 35,
    justifyContent: 'center',
    alignItems: 'center',
  },
  largeAvatarText: {
    color: 'white',
    fontSize: 28,
    fontWeight: '700',
  },
  employeeHeaderInfo: {
    flex: 1,
  },
  employeeHeaderName: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  employeeHeaderId: {
    fontSize: 13,
    marginBottom: 8,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  statusBadgeText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  detailsSection: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
  },
  detailRow: {
    paddingVertical: 10,
    borderBottomWidth: 0.5,
    borderBottomColor: '#e0e0e0',
  },
  detailLabel: {
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 4,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '500',
  },
  loadingText: {
    marginTop: 8,
    fontSize: 13,
    textAlign: 'center',
  },
  editableInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    marginTop: 4,
    fontSize: 14,
    minHeight: 40,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 4,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  bulkModeButton: {
    width: 44,
    height: 44,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  bulkActionsBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  bulkActionsText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  bulkActionsButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  bulkActionButton: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  bulkUpdateModal: {
    width: '95%',
    maxWidth: 500,
    height: '92%',
    maxHeight: '92%',
    minHeight: 600,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
  },
  bulkUpdateHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 18,
  },
  bulkUpdateHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  bulkUpdateTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: 'white',
  },
  bulkUpdateCloseButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  bulkUpdateContent: {
    flex: 1,
    padding: 20,
    paddingBottom: 10,
  },
  bulkUpdateInfoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 24,
    gap: 12,
  },
  bulkUpdateInfoText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
  bulkUpdateSection: {
    marginBottom: 24,
  },
  bulkUpdateSectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 12,
  },
  bulkUpdateOptionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  bulkUpdateOptionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1.5,
    minWidth: '45%',
    justifyContent: 'center',
  },
  bulkUpdateOptionCardText: {
    fontSize: 14,
    fontWeight: '600',
  },
  bulkUpdateInputContainer: {
    borderWidth: 1.5,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 4,
  },
  bulkUpdateInput: {
    fontSize: 16,
    paddingVertical: 12,
    minHeight: 48,
  },
  bulkUpdateFooter: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: 12,
  },
  bulkUpdateCancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1.5,
  },
  bulkUpdateCancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  bulkUpdateSubmitButton: {
    flex: 2,
    flexDirection: 'row',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  bulkUpdateSubmitButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '700',
  },
  recentActionsModal: {
    width: '95%',
    maxWidth: 500,
    height: '92%',
    maxHeight: '92%',
    minHeight: 600,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
  },
  recentActionsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 18,
    borderBottomWidth: 1,
    backgroundColor: '#176d67',
  },
  recentActionsHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  recentActionsTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: 'white',
  },
  recentActionsCloseHeaderButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  recentActionsContent: {
    flex: 1,
    padding: 20,
    paddingBottom: 10,
  },
  recentActionsLoading: {
    padding: 40,
    alignItems: 'center',
  },
  recentActionsEmpty: {
    padding: 40,
    alignItems: 'center',
  },
  recentActionsEmptyText: {
    marginTop: 16,
    fontSize: 16,
  },
  recentActionsList: {
    gap: 16,
  },
  recentActionItem: {
    borderRadius: 12,
    borderWidth: 1.5,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  recentActionContent: {
    flex: 1,
  },
  recentActionTime: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  recentActionTimeText: {
    fontSize: 12,
  },
  recentActionTitle: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 4,
  },
  recentActionFields: {
    fontSize: 13,
    marginBottom: 4,
  },
  recentActionBy: {
    fontSize: 11,
    marginBottom: 8,
  },
  recentActionReverted: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
  },
  recentActionRevertedText: {
    fontSize: 13,
    fontWeight: '500',
  },
  recentActionUndoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  recentActionUndoText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  recentActionConfirm: {
    gap: 8,
  },
  recentActionConfirmText: {
    fontSize: 12,
    marginBottom: 4,
  },
  recentActionConfirmButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  recentActionConfirmButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  recentActionConfirmButtonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  recentActionsFooter: {
    padding: 20,
    borderTopWidth: 1,
  },
  recentActionsCloseButton: {
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  recentActionsCloseText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
