import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { Text, Button, ActivityIndicator, Snackbar } from 'react-native-paper';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';

import { useAuth } from '../context/AuthContext';
import { parseCardStatementWithClaude } from '../services/pdf-parser';
import { addTransaction } from '../services/transactions';
import { saveLearning } from '../services/learnings';
import { TransactionContext } from '../types';
import { theme, OFFICE_CATEGORIES, PERSONAL_CATEGORIES } from '../theme';

interface ParsedItem {
  description: string;
  amount: number;
  date: string;
  category: string;
  selected: boolean;
  context: TransactionContext;
}

type Mode = 'idle' | 'parsing' | 'confirm' | 'saving' | 'done';

export default function PdfImportScreen() {
  const { user } = useAuth();
  const [mode, setMode] = useState<Mode>('idle');
  const [items, setItems] = useState<ParsedItem[]>([]);
  const [snack, setSnack] = useState('');
  const [fileName, setFileName] = useState('');

  async function handlePickPDF() {
    const apiKey = await AsyncStorage.getItem('anthropic_api_key');
    if (!apiKey) {
      setSnack('Configure a chave API Anthropic (Claude) em Configurações para usar este recurso.');
      return;
    }
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;
      const asset = result.assets[0];
      setFileName(asset.name);
      setMode('parsing');
      const base64 = await FileSystem.readAsStringAsync(asset.uri, { encoding: FileSystem.EncodingType.Base64 });
      const parsed = await parseCardStatementWithClaude(base64, apiKey);
      if (!parsed.length) {
        setSnack('Nenhuma transação encontrada no PDF.');
        setMode('idle');
        return;
      }
      setItems(parsed.map((p) => ({ ...p, selected: true, context: 'pessoal' as TransactionContext })));
      setMode('confirm');
    } catch (e: any) {
      setSnack(e.message ?? 'Erro ao processar PDF.');
      setMode('idle');
    }
  }

  async function handleImport() {
    if (!user) return;
    const toImport = items.filter((i) => i.selected);
    if (!toImport.length) { setSnack('Selecione pelo menos um item.'); return; }
    setMode('saving');
    let count = 0;
    for (const item of toImport) {
      try {
        await addTransaction({
          type: 'despesa',
          context: item.context,
          amount: item.amount,
          description: item.description,
          category: item.category,
          date: item.date,
          isPaid: true,
          userId: user.uid,
        });
        count++;
      } catch {}
    }
    await saveLearning('pdf_parse', fileName, JSON.stringify(toImport.slice(0, 5)), user.uid);
    setSnack(`${count} lançamento(s) importado(s)!`);
    setMode('done');
  }

  function toggleItem(i: number) {
    setItems((prev) => prev.map((item, idx) => idx === i ? { ...item, selected: !item.selected } : item));
  }

  function setItemContext(i: number, ctx: TransactionContext) {
    setItems((prev) => prev.map((item, idx) => idx === i ? { ...item, context: ctx } : item));
  }

  function setItemCategory(i: number, cat: string) {
    setItems((prev) => prev.map((item, idx) => idx === i ? { ...item, category: cat } : item));
  }

  const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  if (mode === 'idle') {
    return (
      <View style={styles.center}>
        <MaterialCommunityIcons name="credit-card-scan" size={72} color={theme.colors.primary} style={{ marginBottom: 16 }} />
        <Text style={styles.title}>Importar Fatura PDF</Text>
        <Text style={styles.desc}>
          Selecione o PDF da fatura do cartão de crédito. O Claude analisará o documento e extrairá automaticamente todas as transações.
        </Text>
        <Button mode="contained" onPress={handlePickPDF} icon="file-pdf-box" style={styles.btn} buttonColor={theme.colors.primary}>
          Selecionar Fatura PDF
        </Button>
        <Snackbar visible={snack !== ''} onDismiss={() => setSnack('')} duration={4000}
          style={{ backgroundColor: theme.colors.warning }}
          action={{ label: 'OK', onPress: () => setSnack('') }}>
          {snack}
        </Snackbar>
      </View>
    );
  }

  if (mode === 'parsing') {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={{ marginTop: 16, fontSize: 16, color: theme.colors.text }}>Analisando fatura...</Text>
        <Text style={{ marginTop: 8, color: theme.colors.textSecondary, textAlign: 'center' }}>
          O Claude está extraindo as transações do PDF. Aguarde alguns segundos.
        </Text>
      </View>
    );
  }

  if (mode === 'saving') {
    return <View style={styles.center}><ActivityIndicator size="large" color={theme.colors.primary} /><Text style={{ marginTop: 16 }}>Salvando lançamentos...</Text></View>;
  }

  if (mode === 'done') {
    return (
      <View style={styles.center}>
        <Text style={{ fontSize: 64, marginBottom: 16 }}>✅</Text>
        <Text style={styles.title}>Fatura importada!</Text>
        <Button mode="contained" onPress={() => { setMode('idle'); setItems([]); }} style={styles.btn}>Importar outra</Button>
      </View>
    );
  }

  const selectedCount = items.filter((i) => i.selected).length;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{items.length} transação(ões) encontrada(s)</Text>
        <Text style={styles.headerSub}>{fileName} · Revise e confirme:</Text>
      </View>
      <ScrollView contentContainerStyle={styles.list}>
        {items.map((item, i) => (
          <View key={i} style={[styles.itemCard, item.selected && styles.itemCardSelected]}>
            <View style={styles.itemHeader}>
              <TouchableOpacity onPress={() => toggleItem(i)} style={styles.itemCheck}>
                <Text style={{ fontSize: 20 }}>{item.selected ? '☑️' : '☐'}</Text>
              </TouchableOpacity>
              <View style={styles.itemInfo}>
                <Text style={styles.itemDesc} numberOfLines={2}>{item.description}</Text>
                <Text style={[styles.itemAmt, { color: theme.colors.despesa }]}>-{fmt(item.amount)}</Text>
              </View>
            </View>
            {item.selected && (
              <View style={styles.itemActions}>
                <View style={styles.ctxRow}>
                  {(['pessoal', 'escritorio'] as TransactionContext[]).map((ctx) => (
                    <TouchableOpacity key={ctx} onPress={() => setItemContext(i, ctx)}
                      style={[styles.ctxChip, item.context === ctx && styles.ctxChipActive]}>
                      <Text style={[styles.ctxText, item.context === ctx && styles.ctxTextActive]}>
                        {ctx === 'pessoal' ? 'Pessoal' : 'Escritório'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}
          </View>
        ))}
      </ScrollView>
      <View style={styles.footer}>
        <Text style={styles.footerText}>{selectedCount} selecionado(s)</Text>
        <Button mode="contained" onPress={handleImport} disabled={selectedCount === 0} buttonColor={theme.colors.primary}>
          Importar Selecionados
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
  desc: { fontSize: 14, color: theme.colors.textSecondary, textAlign: 'center', marginBottom: theme.spacing.xl, lineHeight: 22 },
  btn: { borderRadius: theme.borderRadius.md, marginTop: theme.spacing.md },
  header: { padding: theme.spacing.md, backgroundColor: theme.colors.surface, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  headerTitle: { fontSize: 16, fontWeight: 'bold', color: theme.colors.text },
  headerSub: { fontSize: 12, color: theme.colors.textSecondary, marginTop: 2 },
  list: { padding: theme.spacing.md, paddingBottom: 100 },
  itemCard: { backgroundColor: theme.colors.surface, borderRadius: theme.borderRadius.md, padding: theme.spacing.md, marginBottom: theme.spacing.sm, borderWidth: 1.5, borderColor: 'transparent' },
  itemCardSelected: { borderColor: theme.colors.primary },
  itemHeader: { flexDirection: 'row', alignItems: 'flex-start' },
  itemCheck: { marginRight: theme.spacing.sm, paddingTop: 2 },
  itemInfo: { flex: 1 },
  itemDesc: { fontSize: 14, fontWeight: '600', color: theme.colors.text, marginBottom: 4 },
  itemAmt: { fontSize: 15, fontWeight: 'bold' },
  itemActions: { marginTop: theme.spacing.sm },
  ctxRow: { flexDirection: 'row', gap: theme.spacing.sm },
  ctxChip: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12, borderWidth: 1, borderColor: theme.colors.border },
  ctxChipActive: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  ctxText: { fontSize: 12, color: theme.colors.textSecondary },
  ctxTextActive: { color: '#fff', fontWeight: '600' },
  footer: { padding: theme.spacing.md, backgroundColor: theme.colors.surface, borderTopWidth: 1, borderTopColor: theme.colors.border, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  footerText: { color: theme.colors.textSecondary, fontSize: 14 },
});
