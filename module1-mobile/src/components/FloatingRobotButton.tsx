import React from 'react';
import {
  StyleSheet,
  TouchableOpacity,
  View,
  Text,
  Platform
} from 'react-native';
import Svg, { Path, Circle, Rect } from 'react-native-svg';

interface FloatingRobotButtonProps {
  onPress: () => void;
  unreadCount?: number;
}

export const FloatingRobotButton: React.FC<FloatingRobotButtonProps> = ({
  onPress,
  unreadCount = 0
}) => {
  return (
    <TouchableOpacity
      style={styles.container}
      onPress={onPress}
      activeOpacity={0.82}
      accessibilityRole="button"
      accessibilityLabel="Open Swaram AI Assistant"
      accessibilityHint="Opens conversational ASHA frontline medical protocol chatbot"
    >
      <View style={styles.glowRing} />
      <View style={styles.buttonBody}>
        {/* Cute Futuristic Robot Head SVG */}
        <Svg width={30} height={30} viewBox="0 0 24 24" fill="none">
          {/* Antenna with LED bulb */}
          <Path
            d="M12 2.5v3.5"
            stroke="#6EE7B7"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
          <Circle cx="12" cy="2" r="1.6" fill="#34D399" />

          {/* Left & Right Ears / Sensors */}
          <Rect x="2" y="10.5" width="2" height="5" rx="1" fill="#047857" stroke="#34D399" strokeWidth="0.8" />
          <Rect x="20" y="10.5" width="2" height="5" rx="1" fill="#047857" stroke="#34D399" strokeWidth="0.8" />

          {/* Robot Head Chassis */}
          <Rect
            x="4"
            y="6"
            width="16"
            height="14"
            rx="3.8"
            fill="#064E3B"
            stroke="#10B981"
            strokeWidth="1.6"
          />

          {/* Visor Area */}
          <Rect
            x="6"
            y="9"
            width="12"
            height="6"
            rx="2"
            fill="#022C22"
          />

          {/* Glowing Eyes */}
          <Circle cx="9" cy="12" r="1.4" fill="#34D399" />
          <Circle cx="15" cy="12" r="1.4" fill="#34D399" />

          {/* Friendly Tech Mouth */}
          <Path
            d="M9.2 16.5h5.6"
            stroke="#6EE7B7"
            strokeWidth="1.4"
            strokeLinecap="round"
          />
        </Svg>

        {/* Small Active/AI Chip Badge */}
        <View style={styles.activeDot} />
      </View>

      {/* Unread / Notification Counter if applicable */}
      {unreadCount > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{unreadCount}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 76,
    right: 18,
    zIndex: 9999,
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#064E3B',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.38,
        shadowRadius: 6
      },
      android: {
        elevation: 10
      },
      web: {
        filter: 'drop-shadow(0px 4px 10px rgba(6, 78, 59, 0.45))',
        cursor: 'pointer'
      }
    })
  },
  glowRing: {
    position: 'absolute',
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(16, 185, 129, 0.25)',
    transform: [{ scale: 1.08 }]
  },
  buttonBody: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#064E3B',
    borderWidth: 2,
    borderColor: '#34D399',
    alignItems: 'center',
    justifyContent: 'center'
  },
  activeDot: {
    position: 'absolute',
    bottom: 3,
    right: 3,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10B981',
    borderWidth: 1.5,
    borderColor: '#FFFFFF'
  },
  badge: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: '#EF4444',
    borderRadius: 9,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 1.5,
    borderColor: '#FFFFFF'
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700'
  }
});
