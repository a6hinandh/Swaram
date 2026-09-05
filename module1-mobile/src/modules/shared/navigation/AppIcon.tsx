import React from 'react';
import Svg, { Path, Circle, Rect, Polyline } from 'react-native-svg';

export type IconName =
  | 'mic'
  | 'mental'
  | 'climate'
  | 'lifestyle'
  | 'vitals'
  | 'check'
  | 'alert'
  | 'refresh'
  | 'settings'
  | 'info'
  | 'chevron-right';

interface AppIconProps {
  name: IconName;
  size?: number;
  color?: string;
}

export const AppIcon: React.FC<AppIconProps> = ({
  name,
  size = 22,
  color = '#4B5563'
}) => {
  switch (name) {
    case 'mic':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Rect x="9" y="3" width="6" height="11" rx="3" stroke={color} strokeWidth="2" />
          <Path d="M5 10v1a7 7 0 0014 0v-1M12 18v4M8 22h8" stroke={color} strokeWidth="2" strokeLinecap="round" />
        </Svg>
      );

    case 'mental':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Path
            d="M12 3a6 6 0 00-6 6c0 2.22 1.21 4.16 3 5.2V17h6v-2.8c1.79-1.04 3-2.98 3-5.2a6 6 0 00-6-6z"
            stroke={color}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <Path d="M9 21h6M10 17v4M14 17v4" stroke={color} strokeWidth="2" strokeLinecap="round" />
        </Svg>
      );

    case 'climate':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Path
            d="M6.5 19A4.5 4.5 0 016 10.03 7 7 0 0118.5 8a5.5 5.5 0 011.5 10.79H6.5z"
            stroke={color}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      );

    case 'lifestyle':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Path
            d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"
            stroke={color}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <Path d="M9 12l2 2 4-4" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      );

    case 'vitals':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Path
            d="M2 12h4l3-7 4 14 3-7h6"
            stroke={color}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      );

    case 'check':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Polyline points="20 6 9 17 4 12" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      );

    case 'alert':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Path
            d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
            stroke={color}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <Path d="M12 9v4M12 17h.01" stroke={color} strokeWidth="2" strokeLinecap="round" />
        </Svg>
      );

    case 'refresh':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Path
            d="M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"
            stroke={color}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      );

    case 'settings':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Circle cx="12" cy="12" r="3" stroke={color} strokeWidth="2" />
          <Path
            d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 11-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 110-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 114 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 110 4h-.09a1.65 1.65 0 00-1.51 1z"
            stroke={color}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      );

    case 'info':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Circle cx="12" cy="12" r="10" stroke={color} strokeWidth="2" />
          <Path d="M12 16v-4M12 8h.01" stroke={color} strokeWidth="2" strokeLinecap="round" />
        </Svg>
      );

    case 'chevron-right':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Polyline points="9 18 15 12 9 6" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      );

    default:
      return null;
  }
};
