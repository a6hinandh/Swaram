import React from 'react';
import {
  StyleSheet,
  TouchableOpacity,
  View,
  Text,
  Platform
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path, Circle } from 'react-native-svg';

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
      activeOpacity={0.88}
      accessibilityRole="button"
      accessibilityLabel="Open Swaram AI Assistant"
      accessibilityHint="Opens conversational ASHA frontline medical protocol chatbot"
    >
      <View style={styles.glowRing} />
      
      {/* Modern Gradient Circular Body */}
      <LinearGradient
        colors={['#042F2E', '#0D9488']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.buttonBody}
      >
        {/* Sleek Healthcare AI Assistant Icon */}
        <Svg width={26} height={26} viewBox="0 0 24 24" fill="none">
          {/* Friendly Bot Head / Chat Capsule */}
          <Path
            d="M12 3C7.03 3 3 6.8 3 11.5c0 2.22.92 4.24 2.45 5.75L4.5 21l4.2-1.35C9.8 19.88 10.88 20 12 20c4.97 0 9-3.8 9-8.5S16.97 3 12 3z"
            stroke="#FFFFFF"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* Friendly Eyes */}
          <Circle cx="9.5" cy="11.5" r="1.3" fill="#5EEAD4" />
          <Circle cx="14.5" cy="11.5" r="1.3" fill="#5EEAD4" />
          {/* Gentle Smile */}
          <Path
            d="M10 14.5c.5.5 1.5.8 2 .8s1.5-.3 2-.8"
            stroke="#5EEAD4"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          {/* AI Sparkle on top corner */}
          <Path
            d="M19 3l.6 1.4L21 5l-1.4.6L19 7l-.6-1.4L17 5l1.4-.6z"
            fill="#FDE047"
          />
        </Svg>

        {/* Small Active Online Indicator Dot */}
        <View style={styles.activeDot} />
      </LinearGradient>

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
    bottom: 80,
    right: 18,
    zIndex: 9999,
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#0D9488',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.35,
        shadowRadius: 8
      },
      android: {
        elevation: 10
      },
      web: {
        boxShadow: '0 4px 14px rgba(13, 148, 136, 0.38)',
        cursor: 'pointer'
      }
    })
  },
  glowRing: {
    position: 'absolute',
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(45, 212, 191, 0.22)',
    transform: [{ scale: 1.1 }]
  },
  buttonBody: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#5EEAD4'
  },
  activeDot: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    width: 9,
    height: 9,
    borderRadius: 4.5,
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
