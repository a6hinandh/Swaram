import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppIcon, IconName } from './AppIcon';

export type AppTab = 'core' | 'lifestyle' | 'vitals' | 'mental' | 'climate' | 'profile';

interface TabItem {
  id: AppTab;
  label: string;
  icon: IconName;
}

const TABS: TabItem[] = [
  { id: 'core', label: 'സർവേ', icon: 'mic' },
  { id: 'lifestyle', label: 'CBAC', icon: 'lifestyle' },
  { id: 'vitals', label: 'വൈറ്റൽസ്', icon: 'vitals' },
  { id: 'mental', label: 'മാനസികം', icon: 'mental' },
  { id: 'climate', label: 'കാലാവസ്ഥ', icon: 'climate' }
];

interface BottomTabBarProps {
  activeTab: AppTab;
  onTabSelect: (tab: AppTab) => void;
}

export const BottomTabBar: React.FC<BottomTabBarProps> = ({
  activeTab,
  onTabSelect
}) => {
  return (
    <SafeAreaView edges={['bottom']} style={styles.safeArea}>
      <View style={styles.container}>
        {TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          const iconColor = isActive ? '#047857' : '#64748B';

          return (
            <TouchableOpacity
              key={tab.id}
              style={[styles.tabButton, isActive && styles.activeTabButton]}
              onPress={() => onTabSelect(tab.id)}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityState={{ selected: isActive }}
              accessibilityLabel={tab.label}
            >
              <View style={[styles.iconWrapper, isActive && styles.activeIconWrapper]}>
                <AppIcon name={tab.icon} size={20} color={iconColor} />
              </View>
              <Text style={[styles.tabLabel, isActive && styles.activeTabLabel]} numberOfLines={1}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    ...Platform.select({
      ios: {
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: -3 },
        shadowOpacity: 0.06,
        shadowRadius: 6
      },
      android: {
        elevation: 10
      },
      web: {
        boxShadow: '0 -3px 12px rgba(15, 23, 42, 0.06)'
      }
    })
  },
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    height: 62,
    paddingHorizontal: 6,
    backgroundColor: '#FFFFFF'
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    borderRadius: 10
  },
  activeTabButton: {},
  iconWrapper: {
    paddingHorizontal: 14,
    paddingVertical: 3.5,
    borderRadius: 16,
    marginBottom: 2,
    alignItems: 'center',
    justifyContent: 'center'
  },
  activeIconWrapper: {
    backgroundColor: '#ECFDF5'
  },
  tabLabel: {
    fontSize: 10.5,
    fontWeight: '500',
    color: '#64748B',
    marginTop: 1
  },
  activeTabLabel: {
    color: '#047857',
    fontWeight: '700'
  }
});
