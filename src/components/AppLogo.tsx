/**
 * AppLogo - placeholder mark until branding is finalised.
 * Three ascending bars inside a rounded rectangle.
 * Swap this file's SVG content when the real brand asset is ready.
 */
import React from 'react';
import Svg, { Rect, Path } from 'react-native-svg';
import type { ViewStyle } from 'react-native';

interface Props {
  size?: number;
  color?: string;
  style?: ViewStyle;
}

export function AppLogo({ size = 24, color = '#FFFFFF', style }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" style={style}>
      {/* Outer rounded rectangle */}
      <Rect
        x="1.5"
        y="1.5"
        width="21"
        height="21"
        rx="5"
        fill="none"
        stroke={color}
        strokeWidth="1.5"
      />
      {/* Three ascending bars - financial chart motif */}
      <Rect x="5"  y="15" width="3" height="5" rx="1" fill={color} />
      <Rect x="10" y="11" width="3" height="9" rx="1" fill={color} />
      <Rect x="15" y="7"  width="3" height="13" rx="1" fill={color} />
    </Svg>
  );
}
