// Face Attendance Screen - Dedicated screen for face attendance features
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import Dropdown from '@/components/Dropdown';
import { employeeService } from '@/services/employeeService';
import { azureFaceService } from '@/services/azureFaceService';
import * as ImagePicker from 'expo-image-picker';
import { EmployeeProfile } from '@/types';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useFaceDetection } from '@infinitered/react-native-mlkit-face-detection';

const RecognitionCamera = React.memo(
  ({
    cameraRef,
    active,
    borderColor,
  }: {
    cameraRef: React.RefObject<CameraView>;
    active: boolean;
    borderColor: string;
  }) => (
    <View style={[styles.cameraContainer, { borderColor }]}>
      <CameraView
        ref={cameraRef}
        style={styles.cameraPreview}
        facing="front"
        active={active}
        animateShutter={false}
      />
    </View>
  ),
  (prev, next) => prev.active === next.active && prev.borderColor === next.borderColor
);

export default function FaceAttendanceScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  // Sub-tab state
  const [activeSubTab, setActiveSubTab] = useState<'check-log' | 'registration' | 'recognition'>('check-log');
  const [employees, setEmployees] = useState<EmployeeProfile[]>([]);
  const [employeesLoading, setEmployeesLoading] = useState(false);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [selectedImage, setSelectedImage] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [registering, setRegistering] = useState(false);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [captureMode, setCaptureMode] = useState<'clock_in' | 'clock_out'>('clock_in');
  const [sessionActive, setSessionActive] = useState(false);
  const [captureInProgress, setCaptureInProgress] = useState(false);
  const [cooldownUntil, setCooldownUntil] = useState<number | null>(null);
  const [faceDetected, setFaceDetected] = useState(false);
  const [lastRecognition, setLastRecognition] = useState<{
    timestamp: string;
    message: string;
  } | null>(null);
  const [recognitionLog, setRecognitionLog] = useState<
    Array<{ id: string; timestamp: string; status: 'success' | 'failed'; message: string }>
  >([]);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const cameraRef = React.useRef<CameraView | null>(null);
  const faceDetectedRef = React.useRef(false);
  const lastFaceSeenAtRef = React.useRef(0);
  const captureInProgressRef = React.useRef(false);
  const faceDetector = useFaceDetection();

  useEffect(() => {
    const loadEmployees = async () => {
      setEmployeesLoading(true);
      try {
        const response = await employeeService.getEmployees(1);
        const results = Array.isArray(response) ? response : response.results || [];
        setEmployees(results);
      } catch (error: any) {
        Alert.alert('Error', error.message || 'Failed to load employees');
      } finally {
        setEmployeesLoading(false);
      }
    };

    loadEmployees();
  }, []);

  const employeeOptions = employees.map((employee) => ({
    value: employee.id.toString(),
    label: `${employee.first_name} ${employee.last_name || ''}`.trim() + (employee.employee_id ? ` (${employee.employee_id})` : ''),
  }));

  const pickFromCamera = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (permission.status !== 'granted') {
      Alert.alert('Permission Needed', 'Camera access is required to take a face photo.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });

    if (!result.canceled && result.assets?.length) {
      setSelectedImage(result.assets[0]);
    }
  };

  const pickFromGallery = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (permission.status !== 'granted') {
      Alert.alert('Permission Needed', 'Photo library access is required to select a face photo.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });

    if (!result.canceled && result.assets?.length) {
      setSelectedImage(result.assets[0]);
    }
  };

  const handleRegisterFace = async () => {
    if (!selectedEmployeeId) {
      Alert.alert('Missing Employee', 'Please select an employee to register.');
      return;
    }

    if (!selectedImage) {
      Alert.alert('Missing Photo', 'Please capture or select a face photo.');
      return;
    }

    setRegistering(true);
    try {
      const imageName =
        selectedImage.fileName ||
        selectedImage.uri.split('/').pop() ||
        `face-${Date.now()}.jpg`;

      const payload = {
        uri: selectedImage.uri,
        type: selectedImage.mimeType || 'image/jpeg',
        name: imageName,
      };

      const response = await azureFaceService.registerFace(selectedEmployeeId, payload);
      Alert.alert('Success', response.message || 'Face registered successfully');
      setSelectedImage(null);
    } catch (error: any) {
      Alert.alert('Registration Failed', error.message || 'Unable to register face');
    } finally {
      setRegistering(false);
    }
  };

  const requestCameraAccess = async () => {
    await requestCameraPermission();
  };

  const sendForRecognition = async (photoUri: string, source: 'auto' | 'manual') => {
    try {
      const fileName = photoUri.split('/').pop() || `face-${Date.now()}.jpg`;
      const result = await azureFaceService.recognizeFace(captureMode, {
        uri: photoUri,
        type: 'image/jpeg',
        name: fileName,
      });

      if (result.recognized) {
        const message = `${result.employee_name} marked ${captureMode.replace('_', ' ')}`;
        setLastRecognition({
          timestamp: new Date().toLocaleTimeString(),
          message,
        });
        setToast({ message: 'Face verified and attendance marked.', type: 'success' });
        setRecognitionLog((prev) => [
          {
            id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
            timestamp: new Date().toLocaleTimeString(),
            status: 'success',
            message,
          },
          ...prev,
        ]);
        setCooldownUntil(Date.now() + 8000);
      } else if (source === 'manual') {
        setLastRecognition({
          timestamp: new Date().toLocaleTimeString(),
          message: result.message || 'Face not recognized',
        });
        setToast({ message: result.message || 'Face not recognized', type: 'error' });
        setRecognitionLog((prev) => [
          {
            id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
            timestamp: new Date().toLocaleTimeString(),
            status: 'failed',
            message: result.message || 'Face not recognized',
          },
          ...prev,
        ]);
      }
    } catch (error: any) {
      if (source === 'manual') {
        setLastRecognition({
          timestamp: new Date().toLocaleTimeString(),
          message: error.message || 'Recognition failed',
        });
        setToast({ message: error.message || 'Recognition failed', type: 'error' });
        setRecognitionLog((prev) => [
          {
            id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
            timestamp: new Date().toLocaleTimeString(),
            status: 'failed',
            message: error.message || 'Recognition failed',
          },
          ...prev,
        ]);
      }
    } finally {
      // Caller controls captureInProgress for auto/manual flows.
    }
  };

  const captureAutoIfFaceAppears = async () => {
    if (!cameraRef.current || captureInProgressRef.current) return;
    if (cooldownUntil && Date.now() < cooldownUntil) return;
    captureInProgressRef.current = true;
    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.35,
        skipProcessing: true,
        shutterSound: false,
      });
      const photoUri = photo.uri;
      const result = await faceDetector.detectFaces(photoUri);
      const now = Date.now();
      const hasFace = Boolean(result?.faces?.length);
      if (hasFace) {
        lastFaceSeenAtRef.current = now;
        if (!faceDetectedRef.current) {
          faceDetectedRef.current = true;
          setFaceDetected(true);
          setToast({ message: 'Face captured, sent for verification...', type: 'info' });
          await sendForRecognition(photoUri, 'auto');
        }
      } else if (faceDetectedRef.current && now - lastFaceSeenAtRef.current > 3000) {
        faceDetectedRef.current = false;
        setFaceDetected(false);
      }
    } finally {
      captureInProgressRef.current = false;
    }
  };

  const handleManualCapture = async () => {
    if (!cameraRef.current || captureInProgressRef.current) return;
    captureInProgressRef.current = true;
    setCaptureInProgress(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.7,
        skipProcessing: true,
        shutterSound: false,
      });
      await sendForRecognition(photo.uri, 'manual');
    } finally {
      captureInProgressRef.current = false;
      setCaptureInProgress(false);
    }
  };

  useEffect(() => {
    if (!sessionActive) return;
    const interval = setInterval(() => {
      if (!captureInProgressRef.current) {
        captureAutoIfFaceAppears();
      }
    }, 2500);
    return () => clearInterval(interval);
  }, [sessionActive, captureMode, captureInProgress, cooldownUntil]);

  useEffect(() => {
    faceDetector.initialize({
      performanceMode: 'fast',
      landmarkMode: false,
      contourMode: false,
      classificationMode: false,
      minFaceSize: 0.12,
      isTrackingEnabled: false,
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(timer);
  }, [toast]);



  const renderFaceCheckLog = () => {
    const getStatusColor = (status: 'success' | 'failed') =>
      status === 'success' ? colors.success : colors.error;

    return (
      <View>
        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Recognition Log</Text>

          <Text style={[styles.label, { color: colors.text, marginBottom: 16 }]}>
            Track face recognition attempts from this device.
          </Text>

          <View style={[styles.infoBox, { backgroundColor: colors.primary + '15', borderColor: colors.primary + '30' }]}>
            <FontAwesome name="clock-o" size={20} color={colors.primary} style={{ marginBottom: 8 }} />
            <Text style={[styles.infoText, { color: colors.text }]}>
              📊 Recognition Summary:
            </Text>
            <Text style={[styles.infoSubText, { color: colors.textSecondary }]}>
              • Total Attempts: {recognitionLog.length}{'\n'}
              • सफल/Success: {recognitionLog.filter(item => item.status === 'success').length}{'\n'}
              • Failed: {recognitionLog.filter(item => item.status === 'failed').length}
            </Text>
          </View>

          <Text style={[styles.sectionTitle, { color: colors.text, fontSize: 16, marginTop: 20, marginBottom: 12 }]}>
            Latest Attempts
          </Text>

          {recognitionLog.length === 0 && (
            <View style={styles.comingSoonContainer}>
              <FontAwesome name="info-circle" size={32} color={colors.textSecondary} />
              <Text style={[styles.comingSoonText, { color: colors.textSecondary }]}>
                No recognition activity yet.
              </Text>
            </View>
          )}

          {recognitionLog.map((entry) => (
            <View key={entry.id} style={[styles.checkLogItem, { backgroundColor: colors.background, borderColor: colors.border }]}>
              <View style={styles.checkLogHeader}>
                <Text style={[styles.checkLogName, { color: colors.text }]}>{entry.message}</Text>
                <View style={[styles.statusBadge, { backgroundColor: getStatusColor(entry.status) + '20' }]}>
                  <Text style={[styles.statusText, { color: getStatusColor(entry.status) }]}>
                    {entry.status === 'success' ? 'Success' : 'Failed'}
                  </Text>
                </View>
              </View>

              <View style={styles.checkLogTimes}>
                <View style={styles.timeItem}>
                  <FontAwesome name="clock-o" size={14} color={colors.primary} />
                  <Text style={[styles.timeText, { color: colors.text }]}>
                    {entry.timestamp}
                  </Text>
                  <Text style={[styles.timeLabel, { color: colors.textSecondary }]}>Time</Text>
                </View>
              </View>
            </View>
          ))}

          <TouchableOpacity
            style={[styles.saveButton, { backgroundColor: colors.primary, marginTop: 20 }]}
            onPress={() => setRecognitionLog([])}
          >
            <Text style={[styles.saveButtonText, { color: 'white' }]}>Clear Log</Text>
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

          <View style={styles.formGroup}>
            <Text style={[styles.label, { color: colors.text }]}>Select Employee</Text>
            {employeesLoading ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading employees...</Text>
              </View>
            ) : (
              <Dropdown
                options={employeeOptions}
                value={selectedEmployeeId}
                onChange={setSelectedEmployeeId}
                placeholder="Choose an employee"
                searchable
                colors={colors}
              />
            )}
          </View>

          <View style={styles.formGroup}>
            <Text style={[styles.label, { color: colors.text }]}>Capture Face Photo</Text>
            <View style={styles.actionRow}>
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: colors.primary }]}
                onPress={pickFromCamera}
              >
                <FontAwesome name="camera" size={16} color="white" />
                <Text style={styles.actionButtonText}>Take Photo</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: colors.secondary }]}
                onPress={pickFromGallery}
              >
                <FontAwesome name="image" size={16} color="white" />
                <Text style={styles.actionButtonText}>Choose Photo</Text>
              </TouchableOpacity>
            </View>

            {selectedImage ? (
              <View style={[styles.previewContainer, { borderColor: colors.border }]}>
                <Image source={{ uri: selectedImage.uri }} style={styles.previewImage} />
                <Text style={[styles.previewText, { color: colors.textSecondary }]}>
                  Ready to register this face.
                </Text>
              </View>
            ) : (
              <View style={[styles.previewPlaceholder, { borderColor: colors.border }]}>
                <FontAwesome name="user" size={32} color={colors.textSecondary} />
                <Text style={[styles.previewText, { color: colors.textSecondary }]}>
                  No face photo selected yet.
                </Text>
              </View>
            )}
          </View>

          <TouchableOpacity
            style={[
              styles.saveButton,
              {
                backgroundColor: selectedEmployeeId && selectedImage ? colors.primary : colors.border,
                opacity: registering ? 0.7 : 1,
              },
            ]}
            onPress={handleRegisterFace}
            disabled={registering || !selectedEmployeeId || !selectedImage}
          >
            {registering ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text style={[styles.saveButtonText, { color: 'white' }]}>Register Face</Text>
            )}
          </TouchableOpacity>
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

          {!cameraPermission?.granted ? (
            <View style={styles.permissionContainer}>
              <FontAwesome name="camera" size={36} color={colors.textSecondary} />
              <Text style={[styles.permissionText, { color: colors.textSecondary }]}>
                Camera access is required to run face recognition.
              </Text>
              <TouchableOpacity
                style={[styles.saveButton, { backgroundColor: colors.primary }]}
                onPress={requestCameraAccess}
              >
                <Text style={[styles.saveButtonText, { color: 'white' }]}>Grant Camera Access</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <View style={styles.modeToggleRow}>
                <TouchableOpacity
                  style={[
                    styles.modeButton,
                    {
                      backgroundColor: captureMode === 'clock_in' ? colors.primary : colors.surface,
                      borderColor: colors.primary,
                    },
                  ]}
                  onPress={() => setCaptureMode('clock_in')}
                >
                  <Text
                    style={[
                      styles.modeButtonText,
                      { color: captureMode === 'clock_in' ? 'white' : colors.primary },
                    ]}
                  >
                    Clock In
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.modeButton,
                    {
                      backgroundColor: captureMode === 'clock_out' ? colors.primary : colors.surface,
                      borderColor: colors.primary,
                    },
                  ]}
                  onPress={() => setCaptureMode('clock_out')}
                >
                  <Text
                    style={[
                      styles.modeButtonText,
                      { color: captureMode === 'clock_out' ? 'white' : colors.primary },
                    ]}
                  >
                    Clock Out
                  </Text>
                </TouchableOpacity>
              </View>

              <RecognitionCamera
                cameraRef={cameraRef}
                active={activeSubTab === 'recognition'}
                borderColor={
                  sessionActive ? (faceDetected ? colors.success : colors.error) : colors.border
                }
              />

              <View style={styles.sessionRow}>
                <TouchableOpacity
                  style={[
                    styles.saveButton,
                    { backgroundColor: sessionActive ? colors.error : colors.primary },
                  ]}
                  onPress={() => setSessionActive((prev) => !prev)}
                >
                  <Text style={[styles.saveButtonText, { color: 'white' }]}>
                    {sessionActive ? 'Stop Auto Capture' : 'Start Auto Capture'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.secondaryButton, { borderColor: colors.border }]}
                  onPress={handleManualCapture}
                  disabled={captureInProgress}
                >
                  <Text style={[styles.secondaryButtonText, { color: colors.text }]}>Capture Now</Text>
                </TouchableOpacity>
              </View>

              {lastRecognition && (
                <View style={[styles.recognitionStatus, { borderColor: colors.border }]}>
                  <Text style={[styles.recognitionTime, { color: colors.textSecondary }]}>
                    {lastRecognition.timestamp}
                  </Text>
                  <Text style={[styles.recognitionMessage, { color: colors.text }]}>
                    {lastRecognition.message}
                  </Text>
                </View>
              )}
            </>
          )}
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {toast && (
        <View
          style={[
            styles.toast,
            { backgroundColor: toast.type === 'success' ? colors.success : toast.type === 'error' ? colors.error : colors.text }
          ]}
        >
          <Text style={styles.toastText}>{toast.message}</Text>
        </View>
      )}
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
  formGroup: {
    marginBottom: 16,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  loadingText: {
    fontSize: 13,
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
  actionRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  actionButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  previewContainer: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    gap: 8,
  },
  previewImage: {
    width: 200,
    height: 200,
    borderRadius: 12,
  },
  previewPlaceholder: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    gap: 8,
  },
  previewText: {
    fontSize: 13,
    textAlign: 'center',
  },
  permissionContainer: {
    alignItems: 'center',
    gap: 12,
    paddingVertical: 24,
  },
  permissionText: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  modeToggleRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  modeButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  modeButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  cameraContainer: {
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    marginBottom: 16,
  },
  cameraPreview: {
    width: '100%',
    height: 280,
  },
  sessionRow: {
    gap: 12,
  },
  secondaryButton: {
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
  },
  secondaryButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  recognitionStatus: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginTop: 16,
  },
  recognitionTime: {
    fontSize: 12,
    marginBottom: 4,
  },
  recognitionMessage: {
    fontSize: 14,
    fontWeight: '600',
  },
  toast: {
    position: 'absolute',
    top: 60,
    right: 16,
    left: 16,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    zIndex: 10,
  },
  toastText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
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
