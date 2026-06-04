import React, { useCallback, useState } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { Text, ActivityIndicator, Chip } from 'react-native-paper';
import { useFocusEffect } from '@react-navigation/native';

import { useAuth } from '../context/AuthContext';
import { getTransactionsByUser, computeMonthlySummary } from '../services/transactions';
import { generateAllInsights } from '../services/insights';
import { Transaction, Insight } from '../types';
import { theme } from '../theme';
import InsightCard from '../components/InsightCard';

type FilterType = 'todos' | Insight['type'];

export default function AlertsScreen() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [insights, setInsights] = useState<Insight[]>([]);
  const [filter, setFilter] = useState<FilterType>('todos');

  useFocusEffect(
    useCallback(() => {
      computeInsights();
    }, [user])
  );

  async function computeInsights() {
    if (!user) return;
    try {
      const all = await getTransactionsByUser(user.uid);

      const now = new Date();
      const curYear = now.getFullYear();
      const curMonth = now.getMonth() + 1;

      const currentMonthTx = all.filter((t) => {
        const d = new Date(t.date);
        return d.getFullYear() === curYear && d.getMonth() + 1 === curMonth;
      });

      const prevDate = curMonth === 1 ? new Date(curYear - 1, 11, 1) : new Date(curYear, curMonth - 2, 1);
      const prevMonth = prevDate.getMonth() + 1;
      const prevYear = prevDate.getFullYear();
      const prevMonthTx = all.filter((t) => {
        const d = new Date(t.date);
        return d.getFullYear() === prevYear && d.getMonth() + 1 === prevMonth;
      });

      const summary = computeMonthlySummary(currentMonthTx, curYear, curMonth);
      const generated = generateAllInsights(currentMonthTx, prevMonthTx, summary);
      setInsights(generated);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  const filtered = filter === 'todos' ? insights : insights.filter((i) => i.type === filter);

  const dangerCount = insights.filter((i) => i.severity === 'danger').length;
  const warningCount = insights.filter((i) => i.severity === 'warning').length;

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scroll}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); computeInsights(); }} />
      }
    >
      {/* Summary chips */}
      <View style={styles.statsRow}>
        <View style={[styles.statChip, { backgroundColor: theme.colors.despesa + '20' }]}>
          <Text style={[styles.statNumber, { color: theme.colors.despesa }]}>{dangerCount}</Text>
          <Text style={styles.statLabel}>Críticos</Text>
        </View>
        <View style={[styles.statChip, { backgroundColor: theme.colors.warning + '20' }]}>
          <Text style={[styles.statNumber, { color: '#f57c00' }]}>{warningCount}</Text>
          <Text style={styles.statLabel}>Alertas</Text>
        </View>
        <View style={[styles.statChip, { backgroundColor: theme.colors.primary + '20' }]}>
          <Text style={[styles.statNumber, { color: theme.colors.primary }]}>{insights.length}</Text>
          <Text style={styles.statLabel}>Total</Text>
        </View>
      </View>

      {/* Filter chips */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
        {[
          { value: 'todos', label: 'Todos' },
          { value: 'duplicate', label: 'Duplicatas' },
          { value: 'excessive', label: 'Excessivos' },
          { value: 'economy_plan', label: 'Plano' },
          { value: 'savings_tip', label: 'Dicas' },
        ].map(({ value, label }) => (
          <Chip
            key={value}
            selected={filter === value}
            onPress={() => setFilter(value as FilterType)}
            style={styles.chip}
            selectedColor={theme.colors.primary}
          >
            {label}
          </Chip>
        ))}
      </ScrollView>

      {/* Insights list */}
      {filtered.length === 0 ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyIcon}>✅</Text>
          <Text style={styles.emptyTitle}>Tudo em ordem!</Text>
          <Text style={styles.emptyText}>
            Nenhum alerta para esta categoria. Continue adicionando lançamentos para que o sistema possa analisar seus padrões financeiros.
          </Text>
        </View>
      ) : (
        filtered.map((insight) => (
          <InsightCard key={insight.id} insight={insight} />
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  scroll: { padding: theme.spacing.md, paddingBottom: theme.spacing.xl },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  statsRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.md,
  },
  statChip: {
    flex: 1,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    alignItems: 'center',
  },
  statNumber: { fontSize: 22, fontWeight: 'bold' },
  statLabel: { fontSize: 12, color: theme.colors.textSecondary, marginTop: 2 },
  filterScroll: { marginBottom: theme.spacing.md },
  chip: { marginRight: theme.spacing.sm },
  emptyBox: {
    alignItems: 'center',
    padding: theme.spacing.xl,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
  },
  emptyIcon: { fontSize: 48, marginBottom: theme.spacing.md },
  emptyTitle: { fontSize: 18, fontWeight: 'bold', color: theme.colors.text, marginBottom: theme.spacing.sm },
  emptyText: { fontSize: 14, color: theme.colors.textSecondary, textAlign: 'center', lineHeight: 22 },
});
