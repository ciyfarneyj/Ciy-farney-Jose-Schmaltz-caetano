import React, { useState } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { Text, ActivityIndicator, SegmentedButtons, Snackbar } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

import { theme } from '../theme';
import { useAuth } from '../context/AuthContext';
import { getTransactionsByMonth, computeMonthlySummary } from '../services/transactions';
import { exportToExcel, exportToPDF, exportToWord } from '../services/export';
import { Transaction, TransactionContext } from '../types';

type ContextFilter = 'todos' | TransactionContext;

export default function ExportScreen() {
  const navigation = useNavigation();
  const { user } = useAuth();

  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [contextFilter, setContextFilter] = useState<ContextFilter>('todos');
  const [exporting, setExporting] = useState(false);
  const [snackVisible, setSnackVisible] = useState(false);
  const [snackMessage, setSnackMessage] = useState('');

  const monthLabel = format(new Date(year, month - 1, 1), 'MMMM yyyy', { locale: ptBR });
  const displayMonth = monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1);

  function prevMonth() {
    if (month === 1) { setMonth(12); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  }

  function nextMonth() {
    if (month === 12) { setMonth(1); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  }

  function showSnack(msg: string) {
    setSnackMessage(msg);
    setSnackVisible(true);
  }

  async function getFilteredTransactions(): Promise<Transaction[]> {
    if (!user) return [];
    const transactions = await getTransactionsByMonth(user.uid, year, month);
    if (contextFilter === 'todos') return transactions;
    return transactions.filter((t) => t.context === contextFilter);
  }

  async function handleExportExcel() {
    setExporting(true);
    try {
      const transactions = await getFilteredTransactions();
      if (transactions.length === 0) {
        Alert.alert('Aviso', 'Nenhuma transação encontrada para o período selecionado.');
        return;
      }
      const fileName = `financecontrol_${String(month).padStart(2, '0')}_${year}`;
      await exportToExcel(transactions, fileName);
      showSnack('Excel exportado com sucesso!');
    } catch (error) {
      Alert.alert('Erro', 'Não foi possível exportar o arquivo Excel. Tente novamente.');
    } finally {
      setExporting(false);
    }
  }

  async function handleExportPDF() {
    setExporting(true);
    try {
      const transactions = await getFilteredTransactions();
      if (transactions.length === 0) {
        Alert.alert('Aviso', 'Nenhuma transação encontrada para o período selecionado.');
        return;
      }
      const summary = computeMonthlySummary(transactions, year, month);
      const monthStr = `${String(month).padStart(2, '0')}/${year}`;
      await exportToPDF(transactions, summary, monthStr);
      showSnack('PDF exportado com sucesso!');
    } catch (error) {
      Alert.alert('Erro', 'Não foi possível exportar o arquivo PDF. Tente novamente.');
    } finally {
      setExporting(false);
    }
  }

  async function handleExportWord() {
    setExporting(true);
    try {
      const transactions = await getFilteredTransactions();
      if (transactions.length === 0) {
        Alert.alert('Aviso', 'Nenhuma transação encontrada para o período selecionado.');
        return;
      }
      const summary = computeMonthlySummary(transactions, year, month);
      const monthStr = `${String(month).padStart(2, '0')}/${year}`;
      await exportToWord(transactions, summary, monthStr);
      showSnack('Word exportado com sucesso!');
    } catch (error) {
      Alert.alert('Erro', 'Não foi possível exportar o arquivo Word. Tente novamente.');
    } finally {
      setExporting(false);
    }
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Month Picker */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Período</Text>
          <View style={styles.monthPicker}>
            <TouchableOpacity onPress={prevMonth} style={styles.arrowBtn}>
              <MaterialCommunityIcons name="chevron-left" size={24} color={theme.colors.primary} />
            </TouchableOpacity>
            <Text style={styles.monthLabel}>{displayMonth}</Text>
            <TouchableOpacity onPress={nextMonth} style={styles.arrowBtn}>
              <MaterialCommunityIcons name="chevron-right" size={24} color={theme.colors.primary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Context Filter */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Contexto</Text>
          <SegmentedButtons
            value={contextFilter}
            onValueChange={(v) => setContextFilter(v as ContextFilter)}
            buttons={[
              { value: 'todos', label: 'Todos' },
              { value: 'pessoal', label: 'Pessoal' },
              { value: 'escritorio', label: 'Escritório' },
            ]}
          />
        </View>

        {/* Export Buttons */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Formato de Exportação</Text>

          {exporting && (
            <View style={styles.loadingRow}>
              <ActivityIndicator size="small" color={theme.colors.primary} />
              <Text style={styles.loadingText}>Exportando...</Text>
            </View>
          )}

          <TouchableOpacity
            style={[styles.exportBtn, { backgroundColor: '#217346' }, exporting && styles.btnDisabled]}
            onPress={handleExportExcel}
            disabled={exporting}
          >
            <MaterialCommunityIcons name="microsoft-excel" size={24} color="#fff" />
            <View style={styles.btnContent}>
              <Text style={styles.btnTitle}>Exportar Excel</Text>
              <Text style={styles.btnSubtitle}>Planilha .xlsx com duas abas (Receitas e Despesas)</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.exportBtn, { backgroundColor: '#c0392b' }, exporting && styles.btnDisabled]}
            onPress={handleExportPDF}
            disabled={exporting}
          >
            <MaterialCommunityIcons name="file-pdf-box" size={24} color="#fff" />
            <View style={styles.btnContent}>
              <Text style={styles.btnTitle}>Exportar PDF</Text>
              <Text style={styles.btnSubtitle}>Relatório formatado com resumo e tabela de transações</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.exportBtn, { backgroundColor: '#2b579a' }, exporting && styles.btnDisabled]}
            onPress={handleExportWord}
            disabled={exporting}
          >
            <MaterialCommunityIcons name="microsoft-word" size={24} color="#fff" />
            <View style={styles.btnContent}>
              <Text style={styles.btnTitle}>Exportar Word</Text>
              <Text style={styles.btnSubtitle}>Documento .doc compatível com Microsoft Word</Text>
            </View>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <Snackbar
        visible={snackVisible}
        onDismiss={() => setSnackVisible(false)}
        duration={3000}
        action={{ label: 'OK', onPress: () => setSnackVisible(false) }}
      >
        {snackMessage}
      </Snackbar>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  scroll: { padding: theme.spacing.md, paddingBottom: theme.spacing.xl },
  section: { marginBottom: theme.spacing.lg },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  monthPicker: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.sm,
  },
  arrowBtn: {
    padding: theme.spacing.sm,
  },
  monthLabel: {
    fontSize: 17,
    fontWeight: 'bold',
    color: theme.colors.text,
    flex: 1,
    textAlign: 'center',
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.md,
    justifyContent: 'center',
  },
  loadingText: {
    color: theme.colors.textSecondary,
    fontSize: 14,
  },
  exportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    gap: theme.spacing.md,
  },
  btnDisabled: { opacity: 0.5 },
  btnContent: { flex: 1 },
  btnTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  btnSubtitle: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 12,
    marginTop: 2,
  },
});
