/**
 * Tab layout — Modern Archivist edition.
 *
 * Custom tab bar: serif italic labels, gold underline for active tab,
 * no border, glass backdrop blur. Five tabs matching the design:
 *   Nora · Research · Intercept · Vault · Profile
 *
 * The Decisions tab remains routable but hidden from the bar — accessible
 * via the Profile → Decision Log link (Chapter III).
 */

import { Tabs } from 'expo-router';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { BG, GOLD, G2, SERIF, R } from '@/theme';
import Svg, { Path, Circle, Rect, Line } from 'react-native-svg';

// ─── Minimal icon set (matches design exactly) ────────────────────────────────

function IconCompass({ color }: { color: string }) {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.4}>
      <Circle cx="12" cy="12" r="9"/>
      <Path d="M14 10 L11 14 L8 16 L11 12 L14 10 Z" fill={color} stroke="none"/>
    </Svg>
  );
}

function IconBeaker({ color }: { color: string }) {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.4}>
      <Path d="M9 4 H15 M10 4 V10 L5 19 H19 L14 10 V4" strokeLinecap="round" strokeLinejoin="round"/>
    </Svg>
  );
}

function IconIntercept({ color }: { color: string }) {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.4}>
      <Path d="M3 12 H8 M16 12 H21" strokeLinecap="round"/>
      <Circle cx="12" cy="12" r="3.5"/>
    </Svg>
  );
}

function IconVault({ color }: { color: string }) {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.2}>
      <Rect x="4" y="5" width="16" height="14" rx="1"/>
      <Circle cx="12" cy="12" r="3"/>
      <Path d="M12 9 V8 M12 16 V15 M9 12 H8 M16 12 H15" strokeLinecap="round"/>
    </Svg>
  );
}

function IconPerson({ color }: { color: string }) {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.2}>
      <Circle cx="12" cy="9" r="3.5"/>
      <Path d="M5 20 Q5 14 12 14 Q19 14 19 20" strokeLinecap="round"/>
    </Svg>
  );
}

// ─── Custom tab bar ───────────────────────────────────────────────────────────

const TAB_ITEMS = [
  { name: 'chat',      label: 'Nora',      Icon: IconCompass   },
  { name: 'skills',    label: 'Research',  Icon: IconBeaker    },
  { name: 'intercept', label: 'Intercept', Icon: IconIntercept },
  { name: 'vault',     label: 'Vault',     Icon: IconVault     },
  { name: 'profile',   label: 'Profile',   Icon: IconPerson    },
];

function SITabBar({ state, descriptors, navigation }: any) {
  const visibleItems = TAB_ITEMS;

  return (
    <View style={s.barWrapper}>
      {Platform.OS === 'ios' ? (
        <BlurView intensity={60} tint="dark" style={StyleSheet.absoluteFill}/>
      ) : (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(7, 22, 16, 0.92)' }]}/>
      )}

      <View style={s.barInner}>
        {visibleItems.map((item) => {
          // Find the matching route index in state.routes
          const routeIndex = state.routes.findIndex((r: any) => r.name === item.name);
          const isActive = routeIndex === state.index;
          const color = isActive ? GOLD : G2;

          const onPress = () => {
            if (routeIndex < 0) return;
            const event = navigation.emit({
              type: 'tabPress',
              target: state.routes[routeIndex].key,
              canPreventDefault: true,
            });
            if (!isActive && !event.defaultPrevented) {
              navigation.navigate({ name: item.name, merge: true });
            }
          };

          return (
            <TouchableOpacity
              key={item.name}
              onPress={onPress}
              activeOpacity={0.7}
              style={s.tabItem}
            >
              <item.Icon color={color}/>
              <Text style={[s.tabLabel, { color }]}>{item.label}</Text>
              {isActive && <View style={s.tabUnderline}/>}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

// ─── Layout ───────────────────────────────────────────────────────────────────

export default function TabLayout() {
  return (
    <Tabs
      tabBar={(props) => <SITabBar {...props}/>}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen name="chat"      options={{ title: 'Nora' }}/>
      <Tabs.Screen name="skills"    options={{ title: 'Research' }}/>
      <Tabs.Screen name="intercept" options={{ title: 'Intercept' }}/>
      <Tabs.Screen name="vault"     options={{ title: 'Vault' }}/>
      <Tabs.Screen name="profile"   options={{ title: 'Profile' }}/>

      {/* Routable but hidden from the tab bar */}
      <Tabs.Screen name="decisions" options={{ href: null }}/>
      <Tabs.Screen name="archive"   options={{ href: null }}/>
    </Tabs>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  barWrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    overflow: 'hidden',
    // No border — design philosophy: no lines.
  },
  barInner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 10,
    paddingBottom: 28,   // safe area + extra breathing room
    paddingHorizontal: 6,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    gap: 5,
    paddingVertical: 4,
  },
  tabLabel: {
    fontFamily: SERIF,
    fontStyle: 'italic',
    fontSize: 11,
    lineHeight: 13,
    fontWeight: '400',
    letterSpacing: 0,
  },
  tabUnderline: {
    width: 14,
    height: 1,
    backgroundColor: GOLD,
    marginTop: 1,
  },
});
