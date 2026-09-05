import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  SafeAreaView,
  Platform
} from 'react-native';
import { AppIcon, IconName } from './AppIcon';

export type AppTab = 'core' | 'mental' | 'climate' | 'lifestyle' | 'vitals';

interface TabItem {
  id: AppTab;
  label: string;
  icon: IconName;
}

const TABS: TabItem[] = [
  { id: 'core', label: 'Survey', icon: 'mic' },
  { id: 'mental', label: 'Mental', icon: 'mental' },
  { id: 'climate', label: 'Climate', icon: 'climate' },
  { id: 'lifestyle', label: 'CBAC Survey', icon: 'lifestyle' },
  { id: 'vitals', label: 'Vitals', icon: 'vitals' }
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
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          const iconColor = isActive ? '#065F46' : '#9CA3AF';

          return (
            <TouchableOpacity
              key={tab.id}
              style={styles.tabButton}
              onPress={() => onTabSelect(tab.id)}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityState={{ selected: isActive }}
              accessibilityLabel={tab.label}
            >
              <View style={[styles.iconWrapper, isActive && styles.activeIconWrapper]}>
                <AppIcon name={tab.icon} size={20} color={iconColor} />
              </View>
              <Text style={[styles.tabLabel, isActive && styles.activeTabLabel]}>
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
    borderTopColor: '#E5E7EB'
  },
  container: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    height: 58,
    paddingHorizontal: 6,
    backgroundColor: '#FFFFFF'
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4
  },
  iconWrapper: {
    paddingHorizontal: 12,
    paddingVertical: 3,
    borderRadius: 14,
    marginBottom: 2
  },
  activeIconWrapper: {
    backgroundColor: '#DCFCE7'
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: '500',
    color: '#6B7280',
    marginTop: 1
  },
  activeTabLabel: {
    color: '#065F46',
    fontWeight: '700'
  }
});
