import { Tabs } from 'expo-router';
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
      <Tabs.Screen
        name="archive"
        options={{
          title: 'Archive',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'albums' : 'albums-outline'}
              size={22}
              color={color}
            />
          ),
        }}
      />
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
    </Tabs>
  );
}

import { StyleSheet } from 'react-native';
