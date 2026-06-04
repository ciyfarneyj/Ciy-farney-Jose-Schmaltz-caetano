import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Dimensions,
} from 'react-native';
import { Text, FAB, ActivityIndicator, SegmentedButtons } from 'react-native-paper';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { PieChart } from 'react-native-chart-kit';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

import { useAuth } from '../context/AuthContext';
import { getTransactionsByUser, groupByCategoryExpenses, computeMonthlySummary } from '../services/transactions';
import { Transaction, TransactionContext } from '../types';
import { theme } from '../theme';
import SummaryCard from '../components/SummaryCard';
import TransactionCard from '../components/TransactionCard';
import { deleteTransaction, updateTransaction } from '../services/transactions';
import { RootStackParamList } from '../navigation';

const SCREEN_WIDTH = Dimensions.get('window').width;

const PIE_COLORS = [
  '#1a73e8', '#34a853', '#ea4335', '#fbbc04', '#9334e6',
  '#00bcd4', '#ff7043', '#8bc34a', '#e91e63', '#607d8b',
];

type NavProp = NativeStackNavigationProp<RootStackParamList>;

export default function DashboardScreen() {
  const { user } = useAuth();
  const navigation = useNavigation<NavProp>();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [contextFilter, setContextFilter] = useState<'todos' | TransactionContext>('todos');

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  const monthLabel = format(now, 'MMMM yyyy', { locale: ptBR });

  async function loadData() {
    if (!user) return;
    try {
      const data = await getTransactionsByUser(user.uid);
      setTransactions(data);
    } catch {
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [user])
  );

  const filtered = transactions.filter((t) => {
    const d = new Date(t.date);
    const sameMonth = d.getFullYear() === currentYear && d.getMonth() + 1 === currentMonth;
    const sameContext = contextFilter === 'todos' || t.context === contextFilter;
    return sameMonth && sameContext;
  });

  const summary = computeMonthlySummary(filtered, currentYear, currentMonth);

  const categoryData = groupByCategoryExpenses(filtered);
  const pieData = Object.entries(categoryData)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 6)
    .map(([name, value], i) => ({
      name: name.length > 12 ? name.slice(0, 12) + '…' : name,
      population: value,
      color: PIE_COLORS[i % PIE_COLORS.length],
      legendFontColor: theme.colors.text,
      legendFontSize: 11,
    }));

  const recent = [...transactions]
    .filter((t) => contextFilter === 'todos' || t.context === contextFilter)
    .slice(0, 5);

  const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  async function handleDelete(id: string) {
    await deleteTransaction(id);
    setTransactions((prev) => prev.filter((t) => t.id !== id));
  }

  async function handleTogglePaid(id: string, isPaid: boolean) {
    await updateTransaction(id, { isPaid });
    setTransactions((prev) => prev.map((t) => (t.id === id ? { ...t, isPaid } : t)));
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} />}
      >
        {/* Header */}
        <View style={styles.headerBg}>
          <Text style={styles.greeting}>Olá, {user?.displayName?.split(' ')[0] ?? 'bem-vindo'}! 👋</Text>
          <Text style={styles.monthLabel}>{monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1)}</Text>
          <View style={styles.balanceBox}>
            <Text style={styles.balanceLabel}>Saldo do mês</Text>
            <Text style={[styles.balanceValue, { color: summary.balance >= 0 ? '#a8f0b8' : '#ffb3b3' }]}>
              {fmt(summary.balance)}
            </Text>
          </View>
        </View>

        <View style={styles.body}>
          {/* Context filter */}
          <SegmentedButtons
            value={contextFilter}
            onValueChange={(v) => setContextFilter(v as any)}
            buttons={[
              { value: 'todos', label: 'Todos' },
              { value: 'pessoal', label: 'Pessoal' },
              { value: 'escritorio', label: 'Escritório' },
            ]}
            style={styles.segmented}
          />

          {/* Summary cards */}
          <View style={styles.cardsRow}>
            <SummaryCard
              label="Receitas"
              value={fmt(summary.totalReceitas)}
              icon="arrow-down-circle"
              color={theme.colors.receita}
            />
            <View style={{ width: theme.spacing.sm }} />
            <SummaryCard
              label="Despesas"
              value={fmt(summary.totalDespesas)}
              icon="arrow-up-circle"
              color={theme.colors.despesa}
            />
          </View>

          {/* Pie chart */}
          {pieData.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Despesas por Categoria</Text>
              <PieChart
                data={pieData}
                width={SCREEN_WIDTH - theme.spacing.lg * 2}
                height={180}
                chartConfig={{
                  color: (opacity = 1) => `rgba(26, 115, 232, ${opacity})`,
                  labelColor: () => theme.colors.text,
                  backgroundGradientFrom: theme.colors.surface,
                  backgroundGradientTo: theme.colors.surface,
                }}
                accessor="population"
                backgroundColor="transparent"
                paddingLeft="8"
                absolute
              />
            </View>
          )}

          {/* Recent transactions */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Lançamentos Recentes</Text>
            {recent.length === 0 ? (
              <Text style={styles.empty}>Nenhum lançamento encontrado.</Text>
            ) : (
              recent.map((t) => (
                <TransactionCard
                  key={t.id}
                  transaction={t}
                  onDelete={handleDelete}
                  onTogglePaid={handleTogglePaid}
                />
              ))
            )}
          </View>
        </View>
      </ScrollView>

      <FAB
        icon="plus"
        style={styles.fab}
        onPress={() => navigation.navigate('AddTransaction', {})}
        color="#fff"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { paddingBottom: 100 },
  headerBg: {
    backgroundColor: theme.colors.primary,
    paddingTop: theme.spacing.lg,
    paddingBottom: theme.spacing.xl + theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
  },
  greeting: { color: 'rgba(255,255,255,0.9)', fontSize: 14 },
  monthLabel: { color: '#fff', fontSize: 20, fontWeight: 'bold', marginTop: 2, marginBottom: theme.spacing.md },
  balanceBox: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
  },
  balanceLabel: { color: 'rgba(255,255,255,0.8)', fontSize: 13 },
  balanceValue: { fontSize: 28, fontWeight: 'bold', marginTop: 4 },
  body: {
    paddingHorizontal: theme.spacing.md,
    marginTop: -theme.spacing.md,
  },
  segmented: { marginBottom: theme.spacing.md },
  cardsRow: { flexDirection: 'row', marginBottom: theme.spacing.md },
  section: { marginBottom: theme.spacing.lg },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
  },
  empty: { color: theme.colors.textSecondary, textAlign: 'center', paddingVertical: theme.spacing.lg },
  fab: {
    position: 'absolute',
    bottom: theme.spacing.lg,
    right: theme.spacing.lg,
    backgroundColor: theme.colors.primary,
  },
});
