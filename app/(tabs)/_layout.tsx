import { Tabs } from 'expo-router';
import { StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BG, GOLD } from '@/theme';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: GOLD,
        tabBarInactiveTintColor: '#4A5C4A',
        tabBarStyle: {
          backgroundColor: BG,
          borderTopColor: '#1D2B1F',
          borderTopWidth: StyleSheet.hairlineWidth,
          paddingBottom: 28,
          paddingTop: 8,
          paddingHorizontal: 12,
          height: 76,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '500',
          marginTop: 2,
        },
      }}
    >
      {/* 1 — Guide */}
      <Tabs.Screen
        name="chat"
        options={{
          title: 'Guide',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'chatbubble-ellipses' : 'chatbubble-ellipses-outline'}
              size={22}
              color={color}
            />
          ),
        }}
      />

      {/* 2 — Research */}
      <Tabs.Screen
        name="skills"
        options={{
          title: 'Research',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'analytics' : 'analytics-outline'}
              size={22}
              color={color}
            />
          ),
        }}
      />

      {/* 3 — Intercept (central, slightly larger icon to signal primacy) */}
      <Tabs.Screen
        name="intercept"
        options={{
          title: 'Intercept',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'shield-checkmark' : 'shield-checkmark-outline'}
              size={26}
              color={color}
            />
          ),
        }}
      />

      {/* 4 — The Vault */}
      <Tabs.Screen
        name="vault"
        options={{
          title: 'The Vault',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'lock-closed' : 'lock-closed-outline'}
              size={22}
              color={color}
            />
          ),
        }}
      />

      {/* 5 — Decisions */}
      <Tabs.Screen
        name="decisions"
        options={{
          title: 'Decisions',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'journal' : 'journal-outline'}
              size={22}
              color={color}
            />
          ),
        }}
      />

      {/* 6 — Profile */}
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'person-circle' : 'person-circle-outline'}
              size={22}
              color={color}
            />
          ),
        }}
      />

      {/* Archive — hidden from tab bar but route still works for existing slides links */}
      <Tabs.Screen
        name="archive"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}
