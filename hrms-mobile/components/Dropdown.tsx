import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  FlatList,
  TextInput,
  StyleSheet,
  TouchableWithoutFeedback,
} from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import Colors from '@/constants/Colors';
import { useColorScheme } from './useColorScheme';

export interface DropdownOption {
  value: string;
  label: string;
  disabled?: boolean;
}

interface DropdownProps {
  options: DropdownOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  searchable?: boolean;
  loading?: boolean;
  error?: string;
  label?: string;
  required?: boolean;
  allowCustom?: boolean;
  onCustomAdd?: (value: string) => void;
  customPlaceholder?: string;
  colors?: any;
}

const Dropdown: React.FC<DropdownProps> = ({
  options,
  value,
  onChange,
  placeholder = "Select an option",
  disabled = false,
  searchable = false,
  loading = false,
  error,
  label,
  required = false,
  allowCustom = false,
  onCustomAdd,
  customPlaceholder = "Enter custom value",
  colors: themeColors,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [customValue, setCustomValue] = useState("");
  const colorScheme = useColorScheme();
  const colors = themeColors || Colors[colorScheme ?? 'light'];

  // Filter options based on search
  const filteredOptions = searchable 
    ? options.filter(option => 
        option.label.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : options;

  // Get selected option label
  const selectedOption = options.find(option => option.value === value);
  const displayValue = selectedOption ? selectedOption.label : placeholder;

  const handleOptionSelect = (optionValue: string) => {
    onChange(optionValue);
    setIsOpen(false);
    setSearchQuery("");
    setCustomValue("");
  };

  const handleCustomAdd = () => {
    if (customValue.trim() && onCustomAdd) {
      onCustomAdd(customValue.trim());
      onChange(customValue.trim());
      setIsOpen(false);
      setCustomValue("");
      setSearchQuery("");
    }
  };

  return (
    <View style={styles.container}>
      {label && (
        <Text style={[styles.label, { color: colors.text }]}>
          {label}
          {required && <Text style={{ color: colors.error }}> *</Text>}
        </Text>
      )}
      
      <TouchableOpacity
        style={[
          styles.dropdown,
          { 
            backgroundColor: disabled ? colors.background : colors.surface,
            borderColor: error ? colors.error : (isOpen ? colors.primary : colors.border),
            opacity: disabled ? 0.6 : 1,
          }
        ]}
        onPress={() => !disabled && setIsOpen(true)}
        disabled={disabled}
      >
        <Text style={[
          styles.dropdownText,
          { color: selectedOption ? colors.text : colors.textLight }
        ]}>
          {displayValue}
        </Text>
        <FontAwesome 
          name={isOpen ? "chevron-up" : "chevron-down"} 
          size={14} 
          color={colors.textSecondary} 
        />
      </TouchableOpacity>

      {error && (
        <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
      )}

      <Modal
        visible={isOpen}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setIsOpen(false)}
      >
        <TouchableWithoutFeedback onPress={() => setIsOpen(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback onPress={(e) => e.stopPropagation()}>
              <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
                {/* Header */}
                <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
                  <Text style={[styles.modalTitle, { color: colors.text }]}>
                    {label || 'Select Option'}
                  </Text>
                  <TouchableOpacity onPress={() => setIsOpen(false)}>
                    <FontAwesome name="times" size={18} color={colors.textSecondary} />
                  </TouchableOpacity>
                </View>

                {/* Search */}
                {searchable && (
                  <View style={[styles.searchContainer, { borderBottomColor: colors.border }]}>
                    <FontAwesome name="search" size={16} color={colors.textSecondary} style={styles.searchIcon} />
                    <TextInput
                      style={[styles.searchInput, { color: colors.text }]}
                      placeholder="Search..."
                      placeholderTextColor={colors.textLight}
                      value={searchQuery}
                      onChangeText={setSearchQuery}
                    />
                  </View>
                )}

                {/* Options List */}
                <FlatList
                  data={filteredOptions}
                  keyExtractor={(item) => item.value}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={[
                        styles.optionItem,
                        item.value === value && { backgroundColor: colors.primary + '20' },
                        item.disabled && { opacity: 0.5 }
                      ]}
                      onPress={() => !item.disabled && handleOptionSelect(item.value)}
                      disabled={item.disabled}
                    >
                      <Text style={[
                        styles.optionText,
                        { color: item.value === value ? colors.primary : colors.text },
                        item.disabled && { color: colors.textLight }
                      ]}>
                        {item.label}
                      </Text>
                      {item.value === value && (
                        <FontAwesome name="check" size={16} color={colors.primary} />
                      )}
                    </TouchableOpacity>
                  )}
                  ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                      <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                        {searchable && searchQuery ? 'No options found' : 'No options available'}
                      </Text>
                    </View>
                  }
                />

                {/* Custom Add */}
                {allowCustom && (
                  <View style={[styles.customContainer, { borderTopColor: colors.border }]}>
                    <Text style={[styles.customLabel, { color: colors.textSecondary }]}>Add Custom</Text>
                    <View style={styles.customInputRow}>
                      <TextInput
                        style={[styles.customInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
                        value={customValue}
                        onChangeText={setCustomValue}
                        placeholder={customPlaceholder}
                        placeholderTextColor={colors.textLight}
                      />
                      <TouchableOpacity
                        style={[styles.customAddButton, { backgroundColor: colors.primary }]}
                        onPress={handleCustomAdd}
                        disabled={!customValue.trim()}
                      >
                        <Text style={styles.customAddButtonText}>Add</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  dropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    minHeight: 48,
  },
  dropdownText: {
    fontSize: 15,
    flex: 1,
  },
  errorText: {
    fontSize: 12,
    marginTop: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
    paddingBottom: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
  },
  optionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: '#E5E7EB',
  },
  optionText: {
    fontSize: 15,
    flex: 1,
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
  },
  customContainer: {
    padding: 16,
    borderTopWidth: 1,
  },
  customLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 8,
  },
  customInputRow: {
    flexDirection: 'row',
    gap: 10,
  },
  customInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  customAddButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    justifyContent: 'center',
  },
  customAddButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
});

export default Dropdown;

