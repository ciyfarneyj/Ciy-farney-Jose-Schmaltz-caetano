import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
} from 'react-native';
import { Text, TextInput, Button, SegmentedButtons, Switch, Snackbar } from 'react-native-paper';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { format } from 'date-fns';

import { useAuth } from '../context/AuthContext';
import { addTransaction } from '../services/transactions';
import { TransactionType, TransactionContext } from '../types';
import { theme, PERSONAL_CATEGORIES, OFFICE_CATEGORIES } from '../theme';
import { RootStackParamList } from '../navigation';

type NavProp = NativeStackNavigationProp<RootStackParamList, 'AddTransaction'>;
type RoutePropType = RouteProp<RootStackParamList, 'AddTransaction'>;

export default function AddTransactionScreen() {
  const { user } = useAuth();
  const navigation = useNavigation<NavProp>();
  const route = useRoute<RoutePropType>();

  const [type, setType] = useState<TransactionType>(route.params?.type ?? 'despesa');
  const [context, setContext] = useState<TransactionContext>('pessoal');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [date, setDate] = useState(format(new Date(), 'dd/MM/yyyy'));
  const [dueDate, setDueDate] = useState('');
  const [isPaid, setIsPaid] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [snackVisible, setSnackVisible] = useState(false);

  const categories = context === 'pessoal' ? PERSONAL_CATEGORIES : OFFICE_CATEGORIES;

  function parseAmount(raw: string): number {
    const cleaned = raw.replace(/[^\d,]/g, '').replace(',', '.');
    return parseFloat(cleaned) || 0;
  }

  function formatAmountInput(raw: string): string {
    const digits = raw.replace(/\D/g, '');
    if (!digits) return '';
    const number = parseInt(digits, 10) / 100;
    return number.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function parseDateInput(raw: string): string | null {
    const parts = raw.split('/');
    if (parts.length !== 3) return null;
    const [day, month, year] = parts.map(Number);
    if (!day || !month || !year || year < 2000) return null;
    const d = new Date(year, month - 1, day);
    if (isNaN(d.getTime())) return null;
    return d.toISOString();
  }

  function validate(): boolean {
    const amt = parseAmount(amount);
    if (amt <= 0) {
      setError('Informe um valor válido.');
      setSnackVisible(true);
      return false;
    }
    if (!description.trim()) {
      setError('Informe a descrição.');
      setSnackVisible(true);
      return false;
    }
    if (!category) {
      setError('Selecione uma categoria.');
      setSnackVisible(true);
      return false;
    }
    if (!parseDateInput(date)) {
      setError('Data inválida. Use dd/MM/aaaa.');
      setSnackVisible(true);
      return false;
    }
    return true;
  }

  async function handleSave() {
    if (!user || !validate()) return;
    setLoading(true);
    try {
      const isoDate = parseDateInput(date)!;
      const isoDue = dueDate ? parseDateInput(dueDate) ?? undefined : undefined;
      await addTransaction({
        type,
        context,
        amount: parseAmount(amount),
        description: description.trim(),
        category,
        date: isoDate,
        dueDate: isoDue,
        isPaid: type === 'receita' ? true : isPaid,
        userId: user.uid,
      });
      navigation.goBack();
    } catch {
      setError('Erro ao salvar. Tente novamente.');
      setSnackVisible(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        {/* Type */}
        <Text style={styles.label}>Tipo</Text>
        <SegmentedButtons
          value={type}
          onValueChange={(v) => setType(v as TransactionType)}
          buttons={[
            { value: 'receita', label: 'Receita', icon: 'arrow-down-circle' },
            { value: 'despesa', label: 'Despesa', icon: 'arrow-up-circle' },
          ]}
          style={styles.seg}
        />

        {/* Context */}
        <Text style={styles.label}>Contexto</Text>
        <SegmentedButtons
          value={context}
          onValueChange={(v) => { setContext(v as TransactionContext); setCategory(''); }}
          buttons={[
            { value: 'pessoal', label: 'Pessoal' },
            { value: 'escritorio', label: 'Escritório' },
          ]}
          style={styles.seg}
        />

        {/* Amount */}
        <TextInput
          label="Valor (R$)"
          value={amount}
          onChangeText={(v) => setAmount(formatAmountInput(v))}
          mode="outlined"
          keyboardType="numeric"
          style={styles.input}
          left={<TextInput.Affix text="R$ " />}
          outlineColor={theme.colors.border}
          activeOutlineColor={type === 'receita' ? theme.colors.receita : theme.colors.despesa}
        />

        {/* Description */}
        <TextInput
          label="Descrição"
          value={description}
          onChangeText={setDescription}
          mode="outlined"
          style={styles.input}
          outlineColor={theme.colors.border}
          activeOutlineColor={theme.colors.primary}
        />

        {/* Category */}
        <Text style={styles.label}>Categoria</Text>
        <View style={styles.categoryGrid}>
          {categories.map((cat) => (
            <TouchableOpacity
              key={cat}
              onPress={() => setCategory(cat)}
              style={[
                styles.categoryChip,
                category === cat && {
                  backgroundColor: theme.colors.primary,
                  borderColor: theme.colors.primary,
                },
              ]}
            >
              <Text
                style={[
                  styles.categoryText,
                  category === cat && { color: '#fff' },
                ]}
              >
                {cat}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Date */}
        <TextInput
          label="Data (dd/MM/aaaa)"
          value={date}
          onChangeText={setDate}
          mode="outlined"
          keyboardType="numeric"
          style={styles.input}
          left={<TextInput.Icon icon="calendar" />}
          outlineColor={theme.colors.border}
          activeOutlineColor={theme.colors.primary}
        />

        {/* Due date & paid (only for despesas) */}
        {type === 'despesa' && (
          <>
            <TextInput
              label="Vencimento (dd/MM/aaaa) — opcional"
              value={dueDate}
              onChangeText={setDueDate}
              mode="outlined"
              keyboardType="numeric"
              style={styles.input}
              left={<TextInput.Icon icon="calendar-clock" />}
              outlineColor={theme.colors.border}
              activeOutlineColor={theme.colors.primary}
            />
            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>Já pago?</Text>
              <Switch
                value={isPaid}
                onValueChange={setIsPaid}
                color={theme.colors.secondary}
              />
            </View>
          </>
        )}

        <Button
          mode="contained"
          onPress={handleSave}
          loading={loading}
          disabled={loading}
          style={[
            styles.button,
            { backgroundColor: type === 'receita' ? theme.colors.receita : theme.colors.despesa },
          ]}
          contentStyle={styles.buttonContent}
        >
          Salvar Lançamento
        </Button>
      </ScrollView>

      <Snackbar
        visible={snackVisible}
        onDismiss={() => setSnackVisible(false)}
        duration={3000}
        style={{ backgroundColor: theme.colors.danger }}
        action={{ label: 'OK', onPress: () => setSnackVisible(false) }}
      >
        {error}
      </Snackbar>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: theme.colors.background },
  container: { padding: theme.spacing.md, paddingBottom: theme.spacing.xl },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.sm,
    marginTop: theme.spacing.md,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  seg: { marginBottom: theme.spacing.sm },
  input: { marginBottom: theme.spacing.md, backgroundColor: theme.colors.surface },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm, marginBottom: theme.spacing.md },
  categoryChip: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  categoryText: { fontSize: 13, color: theme.colors.text },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    marginBottom: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  switchLabel: { fontSize: 16, color: theme.colors.text },
  button: { borderRadius: theme.borderRadius.md, marginTop: theme.spacing.md },
  buttonContent: { height: 50 },
});
