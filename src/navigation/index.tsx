import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { ActivityIndicator, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { useAuth } from '../context/AuthContext';
import { theme } from '../theme';

import LoginScreen from '../screens/auth/LoginScreen';
import RegisterScreen from '../screens/auth/RegisterScreen';
import DashboardScreen from '../screens/DashboardScreen';
import TransactionsScreen from '../screens/TransactionsScreen';
import ReportsScreen from '../screens/ReportsScreen';
import AlertsScreen from '../screens/AlertsScreen';
import AddTransactionScreen from '../screens/AddTransactionScreen';
import ToolsScreen from '../screens/ToolsScreen';
import ExportScreen from '../screens/ExportScreen';
import ImportScreen from '../screens/ImportScreen';
import AudioEntryScreen from '../screens/AudioEntryScreen';
import PdfImportScreen from '../screens/PdfImportScreen';
import SettingsScreen from '../screens/SettingsScreen';
import BoletoScanScreen from '../screens/BoletoScanScreen';

export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
};

export type MainTabParamList = {
  Dashboard: undefined;
  'Transações': undefined;
  'Relatórios': undefined;
  Alertas: undefined;
  Ferramentas: undefined;
};

export type RootStackParamList = {
  MainTabs: undefined;
  AddTransaction: { type?: 'receita' | 'despesa' };
  ExportScreen: undefined;
  ImportScreen: undefined;
  AudioEntryScreen: undefined;
  PdfImportScreen: undefined;
  SettingsScreen: undefined;
  BoletoScanScreen: undefined;
};

const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();
const RootStack = createNativeStackNavigator<RootStackParamList>();

function AuthNavigator() {
  return (
    <AuthStack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: theme.colors.background },
      }}
    >
      <AuthStack.Screen name="Login" component={LoginScreen} />
      <AuthStack.Screen name="Register" component={RegisterScreen} />
    </AuthStack.Navigator>
  );
}

type TabIconName =
  | 'view-dashboard'
  | 'format-list-bulleted'
  | 'chart-bar'
  | 'bell-alert'
  | 'tools';

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          const icons: Record<string, TabIconName> = {
            Dashboard: 'view-dashboard',
            'Transações': 'format-list-bulleted',
            'Relatórios': 'chart-bar',
            Alertas: 'bell-alert',
            Ferramentas: 'tools',
          };
          const iconName: TabIconName = icons[route.name] ?? 'view-dashboard';
          return (
            <MaterialCommunityIcons name={iconName} size={size} color={color} />
          );
        },
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.textSecondary,
        tabBarStyle: {
          backgroundColor: theme.colors.surface,
          borderTopColor: theme.colors.border,
          paddingBottom: 4,
        },
        headerStyle: {
          backgroundColor: theme.colors.primary,
        },
        headerTintColor: '#fff',
        headerTitleStyle: {
          fontWeight: 'bold',
        },
      })}
    >
      <Tab.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{ title: 'Dashboard' }}
      />
      <Tab.Screen
        name="Transações"
        component={TransactionsScreen}
        options={{ title: 'Transações' }}
      />
      <Tab.Screen
        name="Relatórios"
        component={ReportsScreen}
        options={{ title: 'Relatórios' }}
      />
      <Tab.Screen
        name="Alertas"
        component={AlertsScreen}
        options={{ title: 'Alertas' }}
      />
      <Tab.Screen
        name="Ferramentas"
        component={ToolsScreen}
        options={{ title: 'Ferramentas' }}
      />
    </Tab.Navigator>
  );
}

function MainNavigator() {
  return (
    <RootStack.Navigator>
      <RootStack.Screen
        name="MainTabs"
        component={MainTabs}
        options={{ headerShown: false }}
      />
      <RootStack.Screen
        name="AddTransaction"
        component={AddTransactionScreen}
        options={{
          title: 'Nova Transação',
          presentation: 'modal',
          headerStyle: { backgroundColor: theme.colors.primary },
          headerTintColor: '#fff',
          headerTitleStyle: { fontWeight: 'bold' },
        }}
      />
      <RootStack.Screen
        name="ExportScreen"
        component={ExportScreen}
        options={{
          title: 'Exportar Dados',
          presentation: 'modal',
          headerStyle: { backgroundColor: theme.colors.primary },
          headerTintColor: '#fff',
          headerTitleStyle: { fontWeight: 'bold' },
        }}
      />
      <RootStack.Screen
        name="ImportScreen"
        component={ImportScreen}
        options={{
          title: 'Importar Excel',
          presentation: 'modal',
          headerStyle: { backgroundColor: '#217346' },
          headerTintColor: '#fff',
          headerTitleStyle: { fontWeight: 'bold' },
        }}
      />
      <RootStack.Screen
        name="AudioEntryScreen"
        component={AudioEntryScreen}
        options={{
          title: 'Lançamento por Voz',
          presentation: 'modal',
          headerStyle: { backgroundColor: '#9334e6' },
          headerTintColor: '#fff',
          headerTitleStyle: { fontWeight: 'bold' },
        }}
      />
      <RootStack.Screen
        name="PdfImportScreen"
        component={PdfImportScreen}
        options={{
          title: 'Importar Fatura PDF',
          presentation: 'modal',
          headerStyle: { backgroundColor: '#f57c00' },
          headerTintColor: '#fff',
          headerTitleStyle: { fontWeight: 'bold' },
        }}
      />
      <RootStack.Screen
        name="SettingsScreen"
        component={SettingsScreen}
        options={{
          title: 'Configurações',
          presentation: 'modal',
          headerStyle: { backgroundColor: theme.colors.primary },
          headerTintColor: '#fff',
          headerTitleStyle: { fontWeight: 'bold' },
        }}
      />
      <RootStack.Screen
        name="BoletoScanScreen"
        component={BoletoScanScreen}
        options={{
          title: 'Escanear Boleto',
          presentation: 'modal',
          headerStyle: { backgroundColor: '#00796b' },
          headerTintColor: '#fff',
          headerTitleStyle: { fontWeight: 'bold' },
        }}
      />
    </RootStack.Navigator>
  );
}

export function RootNavigator() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.colors.background }}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  return user ? <MainNavigator /> : <AuthNavigator />;
}
