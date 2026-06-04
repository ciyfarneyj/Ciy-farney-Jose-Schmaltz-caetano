import React, { useState } from 'react';
import {
  View, StyleSheet, ScrollView, FlatList, TouchableOpacity, Alert,
} from 'react-native';
import { Text, Button, ActivityIndicator, Snackbar, DataTable } from 'react-native-paper';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../context/AuthContext';
import { pickExcelFile, mapRowsToTransactions } from '../services/import';
import { addTransaction } from '../services/transactions';
import { saveLearning } from '../services/learnings';
import { Transaction } from '../types';
import { theme } from '../theme';

export default function ImportScreen() {
  const { user } = useAuth();
  const [step, setStep] = useState<'idle' | 'preview' | 'saving' | 'done'>('idle');
  const [rows, setRows] = useState<any[]>([]);
  const [mapped, setMapped] = useState<Omit<Transaction, 'id' | 'createdAt'>[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);
  const [snack, setSnack] = useState('');

  async function handlePickFile() {
    setLoading(true);
    try {
      const rawRows = await pickExcelFile();
      if (!rawRows.length) { setSnack('Arquivo vazio ou sem dados.'); return; }
      const apiKey = (await AsyncStorage.getItem('anthropic_api_key')) ?? '';
      const txs = mapRowsToTransactions(rawRows, user!.uid);
      setRows(rawRows.slice(0, 20));
      setMapped(txs);
      setSelected(new Set(txs.map((_, i) => i)));
      setStep('preview');
    } catch (e: any) {
      setSnack(e.message ?? 'Erro ao ler arquivo.');
    } finally {
      setLoading(false);
    }
  }

  async function handleImport() {
    if (!user) return;
    const toImport = mapped.filter((_, i) => selected.has(i));
    if (!toImport.length) { setSnack('Selecione pelo menos um item.'); return; }
    setStep('saving');
    let count = 0;
    for (const tx of toImport) {
      try { await addTransaction(tx); count++; } catch {}
    }
    await saveLearning('excel_import', JSON.stringify(rows.slice(0, 3)), JSON.stringify(mapped.slice(0, 3)), user.uid);
    setSnack(`${count} lançamento(s) importado(s) com sucesso!`);
    setStep('done');
  }

  function toggleSelect(i: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  }

  const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  if (step === 'idle') {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>Importar Excel</Text>
        <Text style={styles.desc}>
          Selecione uma planilha .xlsx com colunas: Descrição, Valor, Data, Tipo, Categoria, Contexto.
        </Text>
        <Button mode="contained" onPress={handlePickFile} loading={loading} disabled={loading} icon="file-excel" style={styles.btn}>
          Selecionar Arquivo
        </Button>
        <Snackbar visible={snack !== ''} onDismiss={() => setSnack('')} duration={3000}>{snack}</Snackbar>
      </View>
    );
  }

  if (step === 'saving') {
    return <View style={styles.center}><ActivityIndicator size="large" color={theme.colors.primary} /><Text style={{ marginTop: 16 }}>Importando...</Text></View>;
  }

  if (step === 'done') {
    return (
      <View style={styles.center}>
        <Text style={styles.doneIcon}>✅</Text>
        <Text style={styles.title}>Importação concluída!</Text>
        <Button mode="contained" onPress={() => setStep('idle')} style={styles.btn}>Importar outro arquivo</Button>
        <Snackbar visible={snack !== ''} onDismiss={() => setSnack('')} duration={4000}>{snack}</Snackbar>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.previewHeader}>
        <Text style={styles.previewTitle}>{mapped.length} lançamento(s) detectado(s)</Text>
        <Text style={styles.previewSub}>Selecione os que deseja importar:</Text>
      </View>
      <ScrollView contentContainerStyle={styles.list}>
        {mapped.map((tx, i) => (
          <TouchableOpacity key={i} onPress={() => toggleSelect(i)} style={[styles.row, selected.has(i) && styles.rowSelected]}>
            <View style={styles.rowCheck}>
              <Text style={{ fontSize: 18 }}>{selected.has(i) ? '☑️' : '☐'}</Text>
            </View>
            <View style={styles.rowBody}>
              <Text style={styles.rowDesc}>{tx.description}</Text>
              <Text style={styles.rowMeta}>{tx.category} · {tx.context === 'pessoal' ? 'Pessoal' : 'Escritório'}</Text>
            </View>
            <Text style={[styles.rowAmt, { color: tx.type === 'receita' ? theme.colors.receita : theme.colors.despesa }]}>
              {tx.type === 'receita' ? '+' : '-'}{fmt(tx.amount)}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
      <View style={styles.footer}>
        <Text style={styles.footerText}>{selected.size} selecionado(s)</Text>
        <Button mode="contained" onPress={handleImport} disabled={selected.size === 0} buttonColor={theme.colors.primary}>
          Confirmar Importação
        </Button>
      </View>
      <Snackbar visible={snack !== ''} onDismiss={() => setSnack('')} duration={3000}>{snack}</Snackbar>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: theme.spacing.lg, backgroundColor: theme.colors.background },
  title: { fontSize: 22, fontWeight: 'bold', color: theme.colors.text, marginBottom: theme.spacing.sm, textAlign: 'center' },
  desc: { fontSize: 14, color: theme.colors.textSecondary, textAlign: 'center', marginBottom: theme.spacing.xl, lineHeight: 20 },
  btn: { borderRadius: theme.borderRadius.md, marginTop: theme.spacing.md },
  doneIcon: { fontSize: 56, marginBottom: theme.spacing.md },
  previewHeader: { padding: theme.spacing.md, backgroundColor: theme.colors.surface, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  previewTitle: { fontSize: 16, fontWeight: 'bold', color: theme.colors.text },
  previewSub: { fontSize: 13, color: theme.colors.textSecondary, marginTop: 2 },
  list: { padding: theme.spacing.md, paddingBottom: 100 },
  row: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.colors.surface, borderRadius: theme.borderRadius.sm, padding: theme.spacing.md, marginBottom: theme.spacing.sm, borderWidth: 1.5, borderColor: 'transparent' },
  rowSelected: { borderColor: theme.colors.primary },
  rowCheck: { marginRight: theme.spacing.sm },
  rowBody: { flex: 1 },
  rowDesc: { fontSize: 14, fontWeight: '600', color: theme.colors.text },
  rowMeta: { fontSize: 12, color: theme.colors.textSecondary, marginTop: 2 },
  rowAmt: { fontSize: 14, fontWeight: 'bold' },
  footer: { padding: theme.spacing.md, backgroundColor: theme.colors.surface, borderTopWidth: 1, borderTopColor: theme.colors.border, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  footerText: { color: theme.colors.textSecondary, fontSize: 14 },
});
