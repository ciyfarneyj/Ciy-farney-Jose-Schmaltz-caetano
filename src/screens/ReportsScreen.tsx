import React, { useCallback, useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Dimensions,
  TouchableOpacity,
} from 'react-native';
import { Text, ActivityIndicator, SegmentedButtons } from 'react-native-paper';
import { useFocusEffect } from '@react-navigation/native';
import { LineChart, BarChart } from 'react-native-chart-kit';
import { format, addMonths, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { useAuth } from '../context/AuthContext';
import {
  getTransactionsByUser,
  getLast6MonthsSummaries,
  groupByCategoryExpenses,
  computeMonthlySummary,
} from '../services/transactions';
import { Transaction, TransactionContext } from '../types';
import { theme } from '../theme';

const SCREEN_WIDTH = Dimensions.get('window').width;
const CHART_WIDTH = SCREEN_WIDTH - theme.spacing.lg * 2;

export default function ReportsScreen() {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [contextFilter, setContextFilter] = useState<'todos' | TransactionContext>('todos');
  const [selectedDate, setSelectedDate] = useState(new Date());

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [user])
  );

  async function loadData() {
    if (!user) return;
    setLoading(true);
    try {
      const data = await getTransactionsByUser(user.uid);
      setTransactions(data);
    } finally {
      setLoading(false);
    }
  }

  const contextFiltered = transactions.filter(
    (t) => contextFilter === 'todos' || t.context === contextFilter
  );

  const summaries = getLast6MonthsSummaries(contextFiltered);

  const lineLabels = summaries.map((s) => s.month.slice(0, 2) + '/' + s.month.slice(-2));
  const receitasData = summaries.map((s) => s.totalReceitas);
  const despesasData = summaries.map((s) => s.totalDespesas);

  const currentYear = selectedDate.getFullYear();
  const currentMonth = selectedDate.getMonth() + 1;
  const monthTransactions = contextFiltered.filter((t) => {
    const d = new Date(t.date);
    return d.getFullYear() === currentYear && d.getMonth() + 1 === currentMonth;
  });

  const summary = computeMonthlySummary(monthTransactions, currentYear, currentMonth);
  const catData = groupByCategoryExpenses(monthTransactions);
  const sortedCats = Object.entries(catData).sort(([, a], [, b]) => b - a).slice(0, 5);
  const barLabels = sortedCats.map(([k]) => k.length > 8 ? k.slice(0, 8) + '…' : k);
  const barValues = sortedCats.map(([, v]) => v);

  const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const monthName = format(selectedDate, 'MMMM yyyy', { locale: ptBR });

  const chartConfig = {
    backgroundColor: theme.colors.surface,
    backgroundGradientFrom: theme.colors.surface,
    backgroundGradientTo: theme.colors.surface,
    decimalPlaces: 0,
    color: (opacity = 1) => `rgba(26, 115, 232, ${opacity})`,
    labelColor: () => theme.colors.textSecondary,
    propsForDots: { r: '4', strokeWidth: '2', stroke: theme.colors.primary },
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scroll}>
      {/* Context filter */}
      <View style={styles.filterRow}>
        <SegmentedButtons
          value={contextFilter}
          onValueChange={(v) => setContextFilter(v as any)}
          buttons={[
            { value: 'todos', label: 'Todos' },
            { value: 'pessoal', label: 'Pessoal' },
            { value: 'escritorio', label: 'Escritório' },
          ]}
          style={styles.seg}
        />
      </View>

      {/* Month selector */}
      <View style={styles.monthSelector}>
        <TouchableOpacity onPress={() => setSelectedDate(subMonths(selectedDate, 1))}>
          <MaterialCommunityIcons name="chevron-left" size={28} color={theme.colors.primary} />
        </TouchableOpacity>
        <Text style={styles.monthLabel}>
          {monthName.charAt(0).toUpperCase() + monthName.slice(1)}
        </Text>
        <TouchableOpacity onPress={() => setSelectedDate(addMonths(selectedDate, 1))}>
          <MaterialCommunityIcons name="chevron-right" size={28} color={theme.colors.primary} />
        </TouchableOpacity>
      </View>

      {/* Monthly summary table */}
      <View style={styles.summaryTable}>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryKey}>Total Receitas</Text>
          <Text style={[styles.summaryVal, { color: theme.colors.receita }]}>{fmt(summary.totalReceitas)}</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryKey}>Total Despesas</Text>
          <Text style={[styles.summaryVal, { color: theme.colors.despesa }]}>{fmt(summary.totalDespesas)}</Text>
        </View>
        <View style={[styles.summaryRow, styles.summaryRowBalance]}>
          <Text style={styles.summaryKeyBold}>Saldo</Text>
          <Text style={[styles.summaryValBold, { color: summary.balance >= 0 ? theme.colors.receita : theme.colors.despesa }]}>
            {fmt(summary.balance)}
          </Text>
        </View>
        {contextFilter === 'todos' && (
          <>
            <View style={styles.divider} />
            <View style={styles.summaryRow}>
              <Text style={styles.summaryKey}>Pessoal — Receitas</Text>
              <Text style={styles.summaryVal}>{fmt(summary.pessoalReceitas)}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryKey}>Pessoal — Despesas</Text>
              <Text style={styles.summaryVal}>{fmt(summary.pessoalDespesas)}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryKey}>Escritório — Receitas</Text>
              <Text style={styles.summaryVal}>{fmt(summary.escritorioReceitas)}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryKey}>Escritório — Despesas</Text>
              <Text style={styles.summaryVal}>{fmt(summary.escritorioDespesas)}</Text>
            </View>
          </>
        )}
      </View>

      {/* Line chart: last 6 months */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Receitas vs Despesas — Últimos 6 meses</Text>
        {receitasData.some((v) => v > 0) || despesasData.some((v) => v > 0) ? (
          <LineChart
            data={{
              labels: lineLabels,
              datasets: [
                { data: receitasData.map((v) => v || 0), color: () => theme.colors.receita, strokeWidth: 2 },
                { data: despesasData.map((v) => v || 0), color: () => theme.colors.despesa, strokeWidth: 2 },
              ],
              legend: ['Receitas', 'Despesas'],
            }}
            width={CHART_WIDTH}
            height={200}
            chartConfig={chartConfig}
            bezier
            style={styles.chart}
          />
        ) : (
          <Text style={styles.empty}>Sem dados suficientes.</Text>
        )}
      </View>

      {/* Bar chart: top categories */}
      {barValues.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Top Categorias de Despesas</Text>
          <BarChart
            data={{ labels: barLabels, datasets: [{ data: barValues }] }}
            width={CHART_WIDTH}
            height={200}
            chartConfig={{ ...chartConfig, color: () => theme.colors.despesa }}
            style={styles.chart}
            yAxisLabel="R$ "
            yAxisSuffix=""
            showValuesOnTopOfBars
          />
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  scroll: { padding: theme.spacing.md, paddingBottom: theme.spacing.xl },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  filterRow: { marginBottom: theme.spacing.md },
  seg: {},
  monthSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.sm,
  },
  monthLabel: { fontSize: 16, fontWeight: 'bold', color: theme.colors.text },
  summaryTable: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  summaryRowBalance: { borderTopWidth: 1, borderTopColor: theme.colors.border, marginTop: 4, paddingTop: 10 },
  summaryKey: { color: theme.colors.textSecondary, fontSize: 14 },
  summaryVal: { fontSize: 14, color: theme.colors.text, fontWeight: '500' },
  summaryKeyBold: { fontSize: 15, fontWeight: 'bold', color: theme.colors.text },
  summaryValBold: { fontSize: 15, fontWeight: 'bold' },
  divider: { height: 1, backgroundColor: theme.colors.border, marginVertical: theme.spacing.sm },
  section: { marginBottom: theme.spacing.lg },
  sectionTitle: { fontSize: 15, fontWeight: 'bold', color: theme.colors.text, marginBottom: theme.spacing.sm },
  chart: { borderRadius: theme.borderRadius.md },
  empty: { color: theme.colors.textSecondary, textAlign: 'center', paddingVertical: theme.spacing.lg },
});
