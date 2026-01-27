// Employee Details/Edit Screen - Replicates web dashboard functionality
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Switch,
  Alert,
  ActivityIndicator,
  FlatList,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { api } from '@/services/api';
import { API_ENDPOINTS } from '@/constants/Config';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { ListItemSkeleton } from '@/components/LoadingSkeleton';
import Dropdown from '@/components/Dropdown';
import { getCountryOptions, getStateOptions, getCityOptions, CountryOption, StateOption, CityOption } from '@/services/locationService';

export const options = {
  headerShown: false,
};

interface EmployeeData {
  id?: number;
  employee_id: string;
  name: string;
  first_name: string;
  last_name: string;
  mobile_number: string;
  email: string;
  date_of_birth: string;
  marital_status: string;
  gender: string;
  nationality: string;
  country: string;
  address: string;
  city: string;
  state: string;
  department: string;
  designation: string;
  employment_type: string;
  date_of_joining: string;
  branch_location: string;
  shift_start_time: string;
  shift_end_time: string;
  basic_salary: string;
  tds_percentage: string;
  ot_charge?: string;
  ot_charge_per_hour?: string;
  off_monday?: boolean;
  off_tuesday?: boolean;
  off_wednesday?: boolean;
  off_thursday?: boolean;
  off_friday?: boolean;
  off_saturday?: boolean;
  off_sunday?: boolean;
  is_active?: boolean;
  weekly_rules_enabled?: boolean;
}

interface AttendanceRecord {
  date: string;
  ot_hours: number;
  late_minutes: number;
  attendance_status?: string;
  status: 'Present' | 'Absent' | 'Half Day';
}

const EMPLOYMENT_TYPE_OPTIONS = [
  { value: 'FULL_TIME', label: 'Full Time' },
  { value: 'PART_TIME', label: 'Part Time' },
  { value: 'CONTRACT', label: 'Contract' },
  { value: 'INTERN', label: 'Intern' },
];

const MARITAL_STATUS_OPTIONS = [
  { value: 'Single', label: 'Single' },
  { value: 'Married', label: 'Married' },
  { value: 'Divorced', label: 'Divorced' },
  { value: 'Widowed', label: 'Widowed' },
];

const GENDER_OPTIONS = [
  { value: 'Male', label: 'Male' },
  { value: 'Female', label: 'Female' },
  { value: 'Other', label: 'Other' },
];

const DAYS_OF_WEEK = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

export default function EmployeeDetailsScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  // Main state
  const [activeTab, setActiveTab] = useState<'personal' | 'professional' | 'attendance'>('personal');
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Data state
  const [employeeData, setEmployeeData] = useState<EmployeeData | null>(null);
  const [editData, setEditData] = useState<EmployeeData | null>(null);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);

  // Options state
  const [departments, setDepartments] = useState<string[]>([]);
  const [designations, setDesignations] = useState<string[]>([]);
  const [locations, setLocations] = useState<string[]>([]);

  // Dropdown options management
  const [dropdownOptions, setDropdownOptions] = useState({
    departments: [] as string[],
    designations: [] as string[],
    locations: [] as string[],
  });

  // Location state
  const [countryOptions, setCountryOptions] = useState<CountryOption[]>([]);
  const [stateOptions, setStateOptions] = useState<StateOption[]>([]);
  const [cityOptions, setCityOptions] = useState<CityOption[]>([]);
  const [selectedCountry, setSelectedCountry] = useState<string>('');
  const [selectedState, setSelectedState] = useState<string>('');
  const [selectedCity, setSelectedCity] = useState<string>('');

  useEffect(() => {
    if (id) {
      loadEmployeeData();
      loadDropdownOptions();
    }
  }, [id]);

  const loadEmployeeData = async () => {
    try {
      setLoading(true);

      // Load employee profile
      const employee = await api.get(`${API_ENDPOINTS.employees}${id}/`);

      // Load attendance data
      let attendance: any[] = [];
      try {
        const employeeIdForAttendance = employee?.employee_id || id;
        const attendanceResponse = await api.get(
          `${API_ENDPOINTS.employeeAttendance}?employee_id=${employeeIdForAttendance}&page_size=100`
        );
        console.log('📊 Attendance response:', attendanceResponse);

        // Support paginated responses (data.results) or plain list
        const attendanceArrayRaw = Array.isArray(attendanceResponse)
          ? attendanceResponse
          : (attendanceResponse && Array.isArray(attendanceResponse.results)
              ? attendanceResponse.results
              : []);

        attendance = attendanceArrayRaw as any[];
        console.log('📊 Processed attendance records:', attendance.length);
      } catch (attendanceError) {
        console.error('❌ Failed to load attendance data:', attendanceError);
        // Continue without attendance data - don't fail the whole page
        attendance = [];
      }

      setEmployeeData(employee);

      // Initialize selected location values
      setSelectedCountry(employee.country || employee.nationality || '');
      setSelectedState(employee.state || '');
      setSelectedCity(employee.city || '');

      // Load states and cities for existing employee data
      if (employee.country || employee.nationality) {
        try {
          const countryCode = employee.country || employee.nationality;
          const states = await getStateOptions(countryCode);
          setStateOptions(states);

          if (employee.state && states.length > 0) {
            const cities = await getCityOptions(countryCode, employee.state);
            setCityOptions(cities);
          }
        } catch (error) {
          console.error('Error loading location data for employee:', error);
        }
      }

      // Process attendance records (matching web dashboard logic)
      const processedRecords = attendance.map((record: any) => ({
        date: record.date,
        ot_hours: parseFloat(record.ot_hours?.toString() || '0'),
        late_minutes: Number(record.late_minutes) || 0,
        status: record.attendance_status ?
          (record.attendance_status === 'PRESENT' ? 'Present' :
           record.attendance_status === 'HALF_DAY' ? 'Half Day' : 'Absent') : 'Absent'
      }));

      setAttendanceRecords(processedRecords);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to load employee data');
    } finally {
      setLoading(false);
    }
  };

  const loadDropdownOptions = async () => {
    try {
      // Load dropdown options from API
      const options = await api.get('/api/dropdown-options/');
      const depts = options.departments || [];
      const desigs = options.designations || [];
      const locs = options.locations || [];

      setDepartments(depts);
      setDesignations(desigs);
      setLocations(locs);

      // Set dropdown options for local management
      setDropdownOptions({
        departments: depts,
        designations: desigs,
        locations: locs,
      });

      // Load location data
      const countries = await getCountryOptions();
      setCountryOptions(countries);
    } catch (error) {
      console.warn('Failed to load dropdown options:', error);
    }
  };

  const handleCustomDepartmentAdd = (value: string) => {
    setDropdownOptions(prev => ({
      ...prev,
      departments: prev.departments.includes(value) ? prev.departments : [...prev.departments, value]
    }));
  };

  const handleCustomDesignationAdd = (value: string) => {
    setDropdownOptions(prev => ({
      ...prev,
      designations: prev.designations.includes(value) ? prev.designations : [...prev.designations, value]
    }));
  };

  // Location handlers
  const handleCountryChange = async (countryCode: string) => {
    setSelectedCountry(countryCode);
    setSelectedState('');
    setSelectedCity('');
    setStateOptions([]);
    setCityOptions([]);

    if (countryCode && isEditing) {
      setValue('country', countryCode);
      setValue('nationality', countryCode); // For backward compatibility
    }

    if (countryCode) {
      try {
        const states = await getStateOptions(countryCode);
        setStateOptions(states);
      } catch (error) {
        console.error('Error loading states:', error);
      }
    }
  };

  const handleStateChange = async (stateCode: string) => {
    setSelectedState(stateCode);
    setSelectedCity('');
    setCityOptions([]);

    if (stateCode && isEditing) {
      setValue('state', stateCode);
    }

    if (stateCode && selectedCountry) {
      try {
        const cities = await getCityOptions(selectedCountry, stateCode);
        setCityOptions(cities);
      } catch (error) {
        console.error('Error loading cities:', error);
      }
    }
  };

  const handleCityChange = (cityName: string) => {
    setSelectedCity(cityName);
    if (cityName && isEditing) {
      setValue('city', cityName);
    }
  };

  const handleEditToggle = () => {
    if (isEditing) {
      // Cancel editing
      setEditData(null);
      setIsEditing(false);
    } else {
      // Start editing
      setEditData({ ...employeeData });
      setIsEditing(true);
    }
  };

  const handleSave = async () => {
    if (!editData) return;

    try {
      setSaving(true);

      // Prepare update data
      const updateData: any = {};

      // Compare and include only changed fields
      Object.keys(editData).forEach(key => {
        const oldValue = employeeData?.[key as keyof EmployeeData];
        const newValue = editData[key as keyof EmployeeData];

        if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
          updateData[key] = newValue;
        }
      });

      if (Object.keys(updateData).length === 0) {
        Alert.alert('No Changes', 'No changes were made to save.');
        return;
      }

      // Handle special fields
      if (updateData.ot_charge !== undefined) {
        updateData.ot_charge_per_hour = updateData.ot_charge;
        delete updateData.ot_charge;
      }

      await api.patch(`${API_ENDPOINTS.employees}${id}/`, updateData);

      Alert.alert('Success', 'Employee details updated successfully', [
        {
          text: 'OK',
          onPress: () => {
            setIsEditing(false);
            loadEmployeeData(); // Refresh data
          }
        }
      ]);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to save employee data');
    } finally {
      setSaving(false);
    }
  };

  const handleCheckboxChange = (day: string) => {
    if (!isEditing || !editData) return;

    const fieldName = `off_${day.toLowerCase()}` as keyof EmployeeData;
    setEditData(prev => ({
      ...prev!,
      [fieldName]: !(prev![fieldName] as boolean)
    }));
  };

  const getValue = (field: keyof EmployeeData) => {
    if (isEditing && editData) {
      return editData[field] || '';
    }
    return employeeData?.[field] || '';
  };

  const setValue = (field: keyof EmployeeData, value: any) => {
    if (isEditing && editData) {
      setEditData(prev => ({
        ...prev!,
        [field]: value
      }));
    }
  };

  const renderTabButton = (tab: 'personal' | 'professional' | 'attendance', label: string, icon: string) => (
    <TouchableOpacity
      style={[
        styles.tabButton,
        activeTab === tab && [styles.activeTabButton, { borderBottomColor: colors.primary }]
      ]}
      onPress={() => setActiveTab(tab)}
    >
      <FontAwesome name={icon as any} size={16} color={activeTab === tab ? colors.primary : colors.textSecondary} />
      <Text style={[
        styles.tabButtonText,
        { color: activeTab === tab ? colors.primary : colors.textSecondary }
      ]}>
        {label}
      </Text>
    </TouchableOpacity>
  );

  const renderPersonalTab = () => (
    <View style={styles.tabContent}>
      <View style={styles.grid}>
        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: colors.text }]}>First Name <Text style={styles.required}>*</Text></Text>
          <TextInput
            style={[styles.input, {
              color: colors.text,
              borderColor: isEditing ? colors.primary + '40' : colors.border,
              backgroundColor: isEditing ? colors.surface : colors.surface + '80'
            }]}
            value={getValue('first_name')}
            onChangeText={(value) => setValue('first_name', value)}
            placeholder="First Name"
            editable={isEditing}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: colors.text }]}>Last Name <Text style={styles.required}>*</Text></Text>
          <TextInput
            style={[styles.input, {
              color: colors.text,
              borderColor: isEditing ? colors.primary + '40' : colors.border,
              backgroundColor: isEditing ? colors.surface : colors.surface + '80'
            }]}
            value={getValue('last_name')}
            onChangeText={(value) => setValue('last_name', value)}
            placeholder="Last Name"
            editable={isEditing}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: colors.text }]}>Mobile Number</Text>
          <TextInput
            style={[styles.input, {
              color: colors.text,
              borderColor: isEditing ? colors.primary + '40' : colors.border,
              backgroundColor: isEditing ? colors.surface : colors.surface + '80'
            }]}
            value={getValue('mobile_number')}
            onChangeText={(value) => setValue('mobile_number', value)}
            placeholder="Mobile Number"
            editable={isEditing}
            keyboardType="phone-pad"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: colors.text }]}>Email Address</Text>
          <TextInput
            style={[styles.input, {
              color: colors.text,
              borderColor: isEditing ? colors.primary + '40' : colors.border,
              backgroundColor: isEditing ? colors.surface : colors.surface + '80'
            }]}
            value={getValue('email')}
            onChangeText={(value) => setValue('email', value)}
            placeholder="Email Address"
            editable={isEditing}
            keyboardType="email-address"
            autoCapitalize="none"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: colors.text }]}>Date of Birth</Text>
          <TextInput
            style={[styles.input, {
              color: colors.text,
              borderColor: isEditing ? colors.primary + '40' : colors.border,
              backgroundColor: isEditing ? colors.surface : colors.surface + '80'
            }]}
            value={getValue('date_of_birth')}
            onChangeText={(value) => setValue('date_of_birth', value)}
            placeholder="YYYY-MM-DD"
            editable={isEditing}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: colors.text }]}>Marital Status</Text>
          <Dropdown
            options={MARITAL_STATUS_OPTIONS}
            value={getValue('marital_status')}
            onChange={(value) => setValue('marital_status', value)}
            placeholder="Select Marital Status"
            disabled={!isEditing}
            colors={colors}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: colors.text }]}>Gender</Text>
          <Dropdown
            options={GENDER_OPTIONS}
            value={getValue('gender')}
            onChange={(value) => setValue('gender', value)}
            placeholder="Select Gender"
            disabled={!isEditing}
            colors={colors}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: colors.text }]}>Country</Text>
          <Dropdown
            options={(() => {
              // Ensure saved country is always in options
              const currentValue = isEditing
                ? (editData?.country || editData?.nationality || employeeData?.country || employeeData?.nationality || '')
                : (employeeData?.country || employeeData?.nationality || '');
              if (currentValue && !countryOptions.find(c => c.value === currentValue)) {
                return [...countryOptions, { value: currentValue, label: currentValue }];
              }
              return countryOptions;
            })()}
            value={isEditing
              ? (editData?.country || editData?.nationality || employeeData?.country || employeeData?.nationality || selectedCountry || '')
              : (employeeData?.country || employeeData?.nationality || selectedCountry || '')
            }
            onChange={handleCountryChange}
            placeholder={countryOptions.length > 0 ? "Select Country" : "Loading countries..."}
            disabled={!isEditing || countryOptions.length === 0}
            colors={colors}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: colors.text }]}>State</Text>
          <Dropdown
            options={(() => {
              // Ensure saved state is always in options
              const currentValue = isEditing
                ? (editData?.state || employeeData?.state || '')
                : (employeeData?.state || '');
              if (currentValue && !stateOptions.find(s => s.value === currentValue)) {
                return [...stateOptions, { value: currentValue, label: currentValue }];
              }
              return stateOptions;
            })()}
            value={isEditing
              ? (editData?.state || employeeData?.state || selectedState || '')
              : (employeeData?.state || selectedState || '')
            }
            onChange={handleStateChange}
            placeholder="Select State"
            disabled={!isEditing}
            colors={colors}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: colors.text }]}>City</Text>
          <Dropdown
            options={(() => {
              // Ensure saved city is always in options
              const currentValue = isEditing
                ? (editData?.city || employeeData?.city || '')
                : (employeeData?.city || '');
              if (currentValue && !cityOptions.find(c => c.value === currentValue)) {
                return [...cityOptions, { value: currentValue, label: currentValue }];
              }
              return cityOptions;
            })()}
            value={isEditing
              ? (editData?.city || employeeData?.city || selectedCity || '')
              : (employeeData?.city || selectedCity || '')
            }
            onChange={handleCityChange}
            placeholder="Select City"
            disabled={!isEditing}
            colors={colors}
          />
        </View>

        <View style={styles.fullWidthInputGroup}>
          <Text style={[styles.label, { color: colors.text }]}>Address</Text>
          <TextInput
            style={[styles.textArea, {
              color: colors.text,
              borderColor: isEditing ? colors.primary + '40' : colors.border,
              backgroundColor: isEditing ? colors.surface : colors.surface + '80'
            }]}
            value={getValue('address')}
            onChangeText={(value) => setValue('address', value)}
            placeholder="Full Address"
            editable={isEditing}
            multiline
            numberOfLines={3}
          />
        </View>
      </View>
    </View>
  );

  const renderProfessionalTab = () => (
    <View style={styles.tabContent}>
      <View style={styles.grid}>
        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: colors.text }]}>Employee ID</Text>
          <TextInput
            style={[styles.input, {
              color: colors.text,
              borderColor: colors.border,
              backgroundColor: colors.surface + '80'
            }]}
            value={getValue('employee_id')}
            editable={false}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: colors.text }]}>Employment Type</Text>
          <Dropdown
            options={EMPLOYMENT_TYPE_OPTIONS}
            value={getValue('employment_type')}
            onChange={(value) => setValue('employment_type', value)}
            placeholder="Select Employment Type"
            disabled={!isEditing}
            colors={colors}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: colors.text }]}>Department</Text>
          <Dropdown
            options={dropdownOptions.departments.map(d => ({ value: d, label: d }))}
            value={getValue('department')}
            onChange={(value) => setValue('department', value)}
            placeholder="Select Department"
            disabled={!isEditing}
            allowCustom={isEditing}
            onCustomAdd={handleCustomDepartmentAdd}
            customPlaceholder="Enter new department"
            onRemoveOption={(value) => {
              setDropdownOptions(prev => ({
                ...prev,
                departments: prev.departments.filter(d => d !== value)
              }));
              if (getValue('department') === value) {
                setValue('department', '');
              }
            }}
            colors={colors}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: colors.text }]}>Designation</Text>
          <Dropdown
            options={dropdownOptions.designations.map(d => ({ value: d, label: d }))}
            value={getValue('designation')}
            onChange={(value) => setValue('designation', value)}
            placeholder="Select Designation"
            disabled={!isEditing}
            allowCustom={isEditing}
            onCustomAdd={handleCustomDesignationAdd}
            customPlaceholder="Enter new designation"
            onRemoveOption={(value) => {
              setDropdownOptions(prev => ({
                ...prev,
                designations: prev.designations.filter(d => d !== value)
              }));
              if (getValue('designation') === value) {
                setValue('designation', '');
              }
            }}
            colors={colors}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: colors.text }]}>Office Location</Text>
          <Dropdown
            options={dropdownOptions.locations.map(l => ({ value: l, label: l }))}
            value={getValue('branch_location')}
            onChange={(value) => setValue('branch_location', value)}
            placeholder="Select Office Location"
            disabled={!isEditing}
            colors={colors}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: colors.text }]}>Date of Joining</Text>
          <TextInput
            style={[styles.input, {
              color: colors.text,
              borderColor: isEditing ? colors.primary + '40' : colors.border,
              backgroundColor: isEditing ? colors.surface : colors.surface + '80'
            }]}
            value={getValue('date_of_joining')}
            onChangeText={(value) => setValue('date_of_joining', value)}
            placeholder="YYYY-MM-DD"
            editable={isEditing}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: colors.text }]}>Shift Start Time <Text style={styles.required}>*</Text></Text>
          <TextInput
            style={[styles.input, {
              color: colors.text,
              borderColor: isEditing ? colors.primary + '40' : colors.border,
              backgroundColor: isEditing ? colors.surface : colors.surface + '80'
            }]}
            value={getValue('shift_start_time')}
            onChangeText={(value) => setValue('shift_start_time', value)}
            placeholder="HH:MM"
            editable={isEditing}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: colors.text }]}>Shift End Time <Text style={styles.required}>*</Text></Text>
          <TextInput
            style={[styles.input, {
              color: colors.text,
              borderColor: isEditing ? colors.primary + '40' : colors.border,
              backgroundColor: isEditing ? colors.surface : colors.surface + '80'
            }]}
            value={getValue('shift_end_time')}
            onChangeText={(value) => setValue('shift_end_time', value)}
            placeholder="HH:MM"
            editable={isEditing}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: colors.text }]}>Basic Salary</Text>
          <TextInput
            style={[styles.input, {
              color: colors.text,
              borderColor: isEditing ? colors.primary + '40' : colors.border,
              backgroundColor: isEditing ? colors.surface : colors.surface + '80'
            }]}
            value={getValue('basic_salary')}
            onChangeText={(value) => setValue('basic_salary', value)}
            placeholder="Basic Salary"
            editable={isEditing}
            keyboardType="numeric"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: colors.text }]}>TDS Percentage</Text>
          <TextInput
            style={[styles.input, {
              color: colors.text,
              borderColor: isEditing ? colors.primary + '40' : colors.border,
              backgroundColor: isEditing ? colors.surface : colors.surface + '80'
            }]}
            value={getValue('tds_percentage')}
            onChangeText={(value) => setValue('tds_percentage', value)}
            placeholder="TDS %"
            editable={isEditing}
            keyboardType="numeric"
          />
        </View>

        <View style={styles.fullWidthInputGroup}>
          <Text style={[styles.label, { color: colors.text }]}>OT Charge per Hour</Text>
          <TextInput
            style={[styles.input, {
              color: colors.text,
              borderColor: isEditing ? colors.primary + '40' : colors.border,
              backgroundColor: isEditing ? colors.surface : colors.surface + '80'
            }]}
            value={getValue('ot_charge')}
            onChangeText={(value) => setValue('ot_charge', value)}
            placeholder="OT Charge (auto-calculated if empty)"
            editable={isEditing}
            keyboardType="numeric"
          />
        </View>

        <View style={styles.fullWidthInputGroup}>
          <Text style={[styles.label, { color: colors.text, marginBottom: 12 }]}>Weekly Off Days</Text>
          <View style={styles.checkboxGrid}>
            {DAYS_OF_WEEK.map((day) => {
              const fieldName = `off_${day}` as keyof EmployeeData;
              const isChecked = getValue(fieldName) as boolean;

              return (
                <TouchableOpacity
                  key={day}
                  style={[styles.checkboxItem, {
                    backgroundColor: isChecked ? colors.primary + '20' : colors.surface,
                    borderColor: isChecked ? colors.primary : colors.border
                  }]}
                  onPress={() => handleCheckboxChange(day)}
                  disabled={!isEditing}
                >
                  <Text style={[styles.checkboxText, {
                    color: isChecked ? colors.primary : colors.text,
                    fontWeight: isChecked ? '600' : 'normal'
                  }]}>
                    {day.charAt(0).toUpperCase() + day.slice(1)}
                  </Text>
                  {isChecked && (
                    <FontAwesome name="check" size={14} color={colors.primary} />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </View>
    </View>
  );

  const renderAttendanceTab = () => (
    <View style={styles.tabContent}>
      <Text style={[styles.sectionTitle, { color: colors.text, marginBottom: 16 }]}>
        Recent Attendance Records
      </Text>

      {attendanceRecords.length === 0 ? (
        <View style={styles.emptyState}>
          <FontAwesome name="calendar-o" size={48} color={colors.textSecondary} />
          <Text style={[styles.emptyStateText, { color: colors.textSecondary }]}>
            No attendance records found
          </Text>
        </View>
      ) : (
        <View style={styles.attendanceList}>
          {attendanceRecords.slice(0, 30).map((item, index) => (
            <View key={`${item.date}-${index}`} style={[styles.attendanceItem, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={styles.attendanceHeader}>
                <Text style={[styles.attendanceDate, { color: colors.text }]}>
                  {new Date(item.date).toLocaleDateString()}
                </Text>
                <View style={[styles.statusBadge, {
                  backgroundColor: item.status === 'Present' ? '#10b981' :
                                   item.status === 'Absent' ? '#ef4444' : '#f59e0b'
                }]}>
                  <Text style={styles.statusBadgeText}>{item.status}</Text>
                </View>
              </View>

              <View style={styles.attendanceDetails}>
                <Text style={[styles.attendanceDetail, { color: colors.textSecondary }]}>
                  OT Hours: {item.ot_hours.toFixed(1)}
                </Text>
                <Text style={[styles.attendanceDetail, { color: colors.textSecondary }]}>
                  Late Minutes: {item.late_minutes}
                </Text>
              </View>
            </View>
          ))}
        </View>
      )}
    </View>
  );

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { backgroundColor: colors.primary }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <FontAwesome name="arrow-left" size={20} color="white" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Employee Details</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.loadingContainer}>
          <ListItemSkeleton />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.primary }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <FontAwesome name="arrow-left" size={20} color="white" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {employeeData ? `${employeeData.first_name} ${employeeData.last_name}` : 'Employee Details'}
        </Text>
        <TouchableOpacity
          onPress={handleEditToggle}
          style={styles.editButton}
          disabled={saving}
        >
          <FontAwesome
            name={isEditing ? "times" : "edit"}
            size={20}
            color="white"
          />
        </TouchableOpacity>
      </View>

      {/* Tab Navigation */}
      <View style={[styles.tabContainer, { backgroundColor: colors.surface }]}>
        {renderTabButton('personal', 'Personal', 'user')}
        {renderTabButton('professional', 'Professional', 'briefcase')}
        {renderTabButton('attendance', 'Attendance', 'calendar')}
      </View>

      {/* Tab Content */}
      <ScrollView style={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        {activeTab === 'personal' && renderPersonalTab()}
        {activeTab === 'professional' && renderProfessionalTab()}
        {activeTab === 'attendance' && renderAttendanceTab()}
      </ScrollView>

      {/* Save/Cancel Buttons */}
      {isEditing && (
        <View style={[styles.actionContainer, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
          <TouchableOpacity
            style={[styles.actionButton, styles.cancelButton, { borderColor: colors.error }]}
            onPress={handleEditToggle}
            disabled={saving}
          >
            <Text style={[styles.actionButtonText, { color: colors.error }]}>Cancel</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.saveButton, { backgroundColor: colors.primary }]}
            onPress={handleSave}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <Text style={[styles.actionButtonText, { color: 'white' }]}>Save Changes</Text>
            )}
          </TouchableOpacity>
        </View>
      )}
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
    fontSize: 18,
    fontWeight: 'bold',
    color: 'white',
    flex: 1,
    textAlign: 'center',
  },
  editButton: {
    padding: 8,
  },
  tabContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
    gap: 8,
  },
  activeTabButton: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  tabButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
  scrollContainer: {
    flex: 1,
  },
  tabContent: {
    padding: 16,
  },
  grid: {
    gap: 16,
  },
  inputGroup: {
    marginBottom: 16,
  },
  fullWidthInputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  required: {
    color: '#ef4444',
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  textArea: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    height: 80,
    textAlignVertical: 'top',
  },
  checkboxGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  checkboxItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderRadius: 20,
    minWidth: 80,
  },
  checkboxText: {
    fontSize: 14,
  },
  attendanceList: {
    paddingBottom: 20,
  },
  attendanceItem: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
  },
  attendanceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  attendanceDate: {
    fontSize: 16,
    fontWeight: '600',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusBadgeText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  attendanceDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  attendanceDetail: {
    fontSize: 14,
  },
  emptyState: {
    alignItems: 'center',
    padding: 48,
  },
  emptyStateText: {
    fontSize: 16,
    marginTop: 16,
    textAlign: 'center',
  },
  loadingContainer: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  actionContainer: {
    flexDirection: 'row',
    padding: 16,
    borderTopWidth: 1,
    gap: 12,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
  },
  saveButton: {
    backgroundColor: '#0B5E59',
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
