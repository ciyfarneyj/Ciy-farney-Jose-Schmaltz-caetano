import React, { useCallback, useState } from 'react';
import { View, StyleSheet, FlatList, Alert } from 'react-native';
import { Text, FAB, SegmentedButtons, ActivityIndicator, Searchbar } from 'react-native-paper';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

import { useAuth } from '../context/AuthContext';
import {
  getTransactionsByUser,
  deleteTransaction,
  updateTransaction,
} from '../services/transactions';
import { Transaction, TransactionType, TransactionContext } from '../types';
import { theme } from '../theme';
import TransactionCard from '../components/TransactionCard';
import { RootStackParamList } from '../navigation';

type NavProp = NativeStackNavigationProp<RootStackParamList>;

export default function TransactionsScreen() {
  const { user } = useAuth();
  const navigation = useNavigation<NavProp>();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<'todos' | TransactionType>('todos');
  const [contextFilter, setContextFilter] = useState<'todos' | TransactionContext>('todos');
  const [search, setSearch] = useState('');

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

  async function handleDelete(id: string) {
    Alert.alert(
      'Excluir lançamento',
      'Deseja excluir este lançamento?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: async () => {
            await deleteTransaction(id);
            setTransactions((prev) => prev.filter((t) => t.id !== id));
          },
        },
      ]
    );
  }

  async function handleTogglePaid(id: string, isPaid: boolean) {
    await updateTransaction(id, { isPaid });
    setTransactions((prev) => prev.map((t) => (t.id === id ? { ...t, isPaid } : t)));
  }

  const filtered = transactions.filter((t) => {
    const matchType = typeFilter === 'todos' || t.type === typeFilter;
    const matchContext = contextFilter === 'todos' || t.context === contextFilter;
    const matchSearch =
      search === '' ||
      t.description.toLowerCase().includes(search.toLowerCase()) ||
      t.category.toLowerCase().includes(search.toLowerCase());
    return matchType && matchContext && matchSearch;
  });

  const grouped = filtered.reduce<Record<string, Transaction[]>>((acc, t) => {
    const month = format(new Date(t.date), 'MMMM yyyy', { locale: ptBR });
    const key = month.charAt(0).toUpperCase() + month.slice(1);
    if (!acc[key]) acc[key] = [];
    acc[key].push(t);
    return acc;
  }, {});

  const sections = Object.entries(grouped);

  return (
    <View style={styles.container}>
      <View style={styles.filters}>
        <Searchbar
          placeholder="Buscar transação..."
          value={search}
          onChangeText={setSearch}
          style={styles.searchbar}
          inputStyle={{ fontSize: 14 }}
        />
        <SegmentedButtons
          value={typeFilter}
          onValueChange={(v) => setTypeFilter(v as any)}
          buttons={[
            { value: 'todos', label: 'Todos' },
            { value: 'receita', label: 'Receitas' },
            { value: 'despesa', label: 'Despesas' },
          ]}
          style={styles.seg}
        />
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

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      ) : sections.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.empty}>Nenhum lançamento encontrado.</Text>
        </View>
      ) : (
        <FlatList
          data={sections}
          keyExtractor={([key]) => key}
          contentContainerStyle={styles.list}
          renderItem={({ item: [month, items] }) => (
            <View>
              <Text style={styles.monthHeader}>{month}</Text>
              {items.map((t) => (
                <TransactionCard
                  key={t.id}
                  transaction={t}
                  onDelete={handleDelete}
                  onTogglePaid={handleTogglePaid}
                />
              ))}
            </View>
          )}
        />
      )}

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
  filters: {
    backgroundColor: theme.colors.surface,
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  searchbar: {
    marginBottom: theme.spacing.sm,
    backgroundColor: theme.colors.background,
    elevation: 0,
    borderWidth: 1,
    borderColor: theme.colors.border,
    height: 44,
  },
  seg: { marginBottom: theme.spacing.sm },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  list: { padding: theme.spacing.md, paddingBottom: 100 },
  monthHeader: {
    fontSize: 15,
    fontWeight: 'bold',
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.sm,
    marginTop: theme.spacing.md,
  },
  empty: { color: theme.colors.textSecondary, fontSize: 15 },
  fab: {
    position: 'absolute',
    bottom: theme.spacing.lg,
    right: theme.spacing.lg,
    backgroundColor: theme.colors.primary,
  },
});
