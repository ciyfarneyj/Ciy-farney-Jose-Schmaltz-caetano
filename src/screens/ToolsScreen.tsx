import React, { useState } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { Text, ActivityIndicator } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { theme } from '../theme';
import { RootStackParamList } from '../navigation';
import { useAuth } from '../context/AuthContext';
import { getTransactionsByUser } from '../services/transactions';
import { scheduleAllPushReminders, requestNotificationPermission } from '../services/calendar';

type NavProp = NativeStackNavigationProp<RootStackParamList>;

interface ToolCardProps {
  icon: string;
  title: string;
  description: string;
  color: string;
  onPress: () => void;
  disabled?: boolean;
}

function ToolCard({ icon, title, description, color, onPress, disabled }: ToolCardProps) {
  return (
    <TouchableOpacity
      style={[styles.card, disabled && styles.cardDisabled]}
      onPress={onPress}
      activeOpacity={0.7}
      disabled={disabled}
    >
      <View style={[styles.iconContainer, { backgroundColor: color + '20' }]}>
        <MaterialCommunityIcons name={icon as any} size={28} color={color} />
      </View>
      <View style={styles.cardContent}>
        <Text style={styles.cardTitle}>{title}</Text>
        <Text style={styles.cardDescription}>{description}</Text>
      </View>
      <MaterialCommunityIcons name="chevron-right" size={20} color={theme.colors.textSecondary} />
    </TouchableOpacity>
  );
}

export default function ToolsScreen() {
  const navigation = useNavigation<NavProp>();
  const { user } = useAuth();
  const [loadingCalendar, setLoadingCalendar] = useState(false);

  async function handleScheduleReminders() {
    if (!user) return;

    Alert.alert(
      'Lembretes de Vencimento',
      'Deseja criar lembretes no calendário para todas as despesas com vencimento nos próximos 30 dias?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Criar Lembretes',
          onPress: async () => {
            setLoadingCalendar(true);
            try {
              const granted = await requestNotificationPermission();
              if (!granted) {
                Alert.alert('Erro', 'Permissão de notificações não concedida.');
                return;
              }
              const transactions = await getTransactionsByUser(user.uid);
              const count = await scheduleAllPushReminders(transactions);
              Alert.alert(
                'Sucesso',
                count > 0
                  ? `${count} lembrete(s) criado(s) no calendário.`
                  : 'Nenhuma despesa pendente com vencimento nos próximos 30 dias.'
              );
            } catch (error) {
              Alert.alert('Erro', 'Não foi possível criar os lembretes. Verifique as permissões de calendário.');
            } finally {
              setLoadingCalendar(false);
            }
          },
        },
      ]
    );
  }

  const tools = [
    {
      icon: 'export-variant',
      title: 'Exportar Dados',
      description: 'Exporte transações em Excel, PDF ou Word',
      color: theme.colors.primary,
      onPress: () => navigation.navigate('ExportScreen'),
    },
    {
      icon: 'microsoft-excel',
      title: 'Importar Excel',
      description: 'Importe transações de uma planilha .xlsx',
      color: '#217346',
      onPress: () => navigation.navigate('ImportScreen'),
    },
    {
      icon: 'microphone',
      title: 'Lançamento por Voz',
      description: 'Grave um áudio e crie uma transação automaticamente',
      color: '#9334e6',
      onPress: () => navigation.navigate('AudioEntryScreen'),
    },
    {
      icon: 'credit-card-scan-outline',
      title: 'Importar Fatura PDF',
      description: 'Extraia transações de faturas de cartão de crédito',
      color: '#f57c00',
      onPress: () => navigation.navigate('PdfImportScreen'),
    },
    {
      icon: 'barcode-scan',
      title: 'Escanear Boleto / Carnê',
      description: 'Tire foto do boleto e extraia valor e vencimento automaticamente',
      color: '#00796b',
      onPress: () => navigation.navigate('BoletoScanScreen'),
    },
    {
      icon: 'calendar-check',
      title: 'Vencimentos no Calendário',
      description: 'Crie lembretes para despesas a vencer nos próximos 30 dias',
      color: '#00897b',
      onPress: handleScheduleReminders,
    },
    {
      icon: 'cog',
      title: 'Configurações',
      description: 'Configure chaves de API, WhatsApp e preferências',
      color: theme.colors.textSecondary,
      onPress: () => navigation.navigate('SettingsScreen'),
    },
  ];

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Ferramentas</Text>
          <Text style={styles.headerSubtitle}>
            Importe, exporte e automatize seus lançamentos financeiros
          </Text>
        </View>

        {loadingCalendar && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="small" color={theme.colors.primary} />
            <Text style={styles.loadingText}>Criando lembretes...</Text>
          </View>
        )}

        <View style={styles.toolsGrid}>
          {tools.map((tool) => (
            <ToolCard
              key={tool.title}
              icon={tool.icon}
              title={tool.title}
              description={tool.description}
              color={tool.color}
              onPress={tool.onPress}
              disabled={loadingCalendar && tool.title === 'Vencimentos no Calendário'}
            />
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  scroll: {
    paddingBottom: theme.spacing.xl,
  },
  header: {
    backgroundColor: theme.colors.primary,
    paddingTop: theme.spacing.lg,
    paddingBottom: theme.spacing.xl,
    paddingHorizontal: theme.spacing.lg,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 22,
    fontWeight: 'bold',
  },
  headerSubtitle: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 14,
    marginTop: 4,
  },
  loadingOverlay: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  loadingText: {
    color: theme.colors.textSecondary,
    fontSize: 14,
  },
  toolsGrid: {
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    marginBottom: theme.spacing.xs,
  },
  cardDisabled: {
    opacity: 0.5,
  },
  iconContainer: {
    width: 52,
    height: 52,
    borderRadius: theme.borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardContent: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 2,
  },
  cardDescription: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    lineHeight: 17,
  },
});
