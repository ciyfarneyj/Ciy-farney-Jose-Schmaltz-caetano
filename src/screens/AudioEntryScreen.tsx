import React, { useState, useRef } from 'react';
import { View, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Text, Button, TextInput, ActivityIndicator, Snackbar, SegmentedButtons } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import { Audio } from 'expo-av';

import { useAuth } from '../context/AuthContext';
import { startRecording, stopRecording, transcribeAudio, parseTranscriptToTransaction, parseCommandToStatusUpdate } from '../services/audio';
import { addTransaction, getTransactionsByUser, updateTransaction } from '../services/transactions';
import { saveLearning } from '../services/learnings';
import { Transaction, TransactionType, TransactionContext } from '../types';
import { theme, PERSONAL_CATEGORIES, OFFICE_CATEGORIES } from '../theme';

type Mode = 'idle' | 'recording' | 'transcribing' | 'confirm' | 'update_confirm' | 'saving' | 'done' | 'error';

export default function AudioEntryScreen() {
  const { user } = useAuth();
  const navigation = useNavigation();
  const recordingRef = useRef<Audio.Recording | null>(null);
  const [mode, setMode] = useState<Mode>('idle');
  const [seconds, setSeconds] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [transcript, setTranscript] = useState('');
  const [parsed, setParsed] = useState<Partial<Transaction> | null>(null);
  const [statusUpdate, setStatusUpdate] = useState<{ id: string; description: string; newStatus: boolean } | null>(null);
  const [snack, setSnack] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  async function handleStartRecording() {
    const openaiKey = await AsyncStorage.getItem('openai_api_key');
    if (!openaiKey) {
      setSnack('Configure a chave API OpenAI em Configurações para usar transcrição de áudio.');
      return;
    }
    try {
      const { recording } = await startRecording();
      recordingRef.current = recording;
      setSeconds(0);
      setMode('recording');
      timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    } catch (e: any) {
      setSnack(e.message ?? 'Erro ao iniciar gravação.');
    }
  }

  async function handleStopRecording() {
    if (timerRef.current) clearInterval(timerRef.current);
    if (!recordingRef.current) return;
    setMode('transcribing');
    try {
      const uri = await stopRecording(recordingRef.current);
      recordingRef.current = null;
      const openaiKey = (await AsyncStorage.getItem('openai_api_key'))!;
      const anthropicKey = (await AsyncStorage.getItem('anthropic_api_key')) ?? '';
      const text = await transcribeAudio(uri, openaiKey);
      setTranscript(text);

      // First check if it's a status update command (e.g., "paguei o condomínio")
      if (anthropicKey && user) {
        const allTx = await getTransactionsByUser(user.uid);
        const upd = await parseCommandToStatusUpdate(text, allTx, anthropicKey);
        if (upd) {
          setStatusUpdate(upd);
          setMode('update_confirm');
          return;
        }
        // Otherwise parse as new transaction
        const result = await parseTranscriptToTransaction(text, user.uid, anthropicKey);
        if (result) {
          setParsed(result);
          setMode('confirm');
          return;
        }
      }
      setErrorMsg('Não foi possível interpretar o áudio. Tente novamente com mais clareza.');
      setMode('error');
    } catch (e: any) {
      setErrorMsg(e.message ?? 'Erro ao processar áudio.');
      setMode('error');
    }
  }

  async function handleConfirmNew() {
    if (!user || !parsed) return;
    setMode('saving');
    try {
      const tx = {
        type: (parsed.type ?? 'despesa') as TransactionType,
        context: (parsed.context ?? 'pessoal') as TransactionContext,
        amount: parsed.amount ?? 0,
        description: parsed.description ?? '',
        category: parsed.category ?? 'Outros',
        date: parsed.date ?? new Date().toISOString(),
        dueDate: parsed.dueDate,
        isPaid: parsed.isPaid ?? false,
        userId: user.uid,
      };
      await addTransaction(tx);
      await saveLearning('audio_parse', transcript, JSON.stringify(tx), user.uid);
      setMode('done');
    } catch (e: any) {
      setSnack(e.message ?? 'Erro ao salvar.');
      setMode('confirm');
    }
  }

  async function handleConfirmUpdate() {
    if (!statusUpdate) return;
    setMode('saving');
    try {
      await updateTransaction(statusUpdate.id, { isPaid: statusUpdate.newStatus });
      setMode('done');
    } catch (e: any) {
      setSnack(e.message ?? 'Erro ao atualizar.');
      setMode('update_confirm');
    }
  }

  function reset() {
    setMode('idle');
    setTranscript('');
    setParsed(null);
    setStatusUpdate(null);
    setSeconds(0);
  }

  const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  if (mode === 'done') {
    return (
      <View style={styles.center}>
        <Text style={styles.doneIcon}>✅</Text>
        <Text style={styles.doneTitle}>Pronto!</Text>
        <Text style={styles.doneSub}>Lançamento registrado com sucesso.</Text>
        <Button mode="contained" onPress={reset} style={styles.btn}>Gravar outro</Button>
        <Button mode="outlined" onPress={() => navigation.goBack()} style={[styles.btn, { marginTop: 8 }]}>Voltar</Button>
      </View>
    );
  }

  if (mode === 'error') {
    return (
      <View style={styles.center}>
        <Text style={styles.doneIcon}>❌</Text>
        <Text style={styles.doneTitle}>Não entendi</Text>
        <Text style={[styles.doneSub, { color: theme.colors.danger }]}>{errorMsg}</Text>
        <Text style={styles.transcriptBox}>{transcript}</Text>
        <Button mode="contained" onPress={reset} style={styles.btn}>Tentar novamente</Button>
      </View>
    );
  }

  if (mode === 'update_confirm' && statusUpdate) {
    return (
      <ScrollView contentContainerStyle={styles.confirmContainer}>
        <Text style={styles.sectionTitle}>Alteração detectada</Text>
        <Text style={styles.transcriptBox}>"{transcript}"</Text>
        <View style={styles.confirmCard}>
          <Text style={styles.confirmRow}>📝 Transação: <Text style={styles.bold}>{statusUpdate.description}</Text></Text>
          <Text style={styles.confirmRow}>
            Status: <Text style={[styles.bold, { color: statusUpdate.newStatus ? theme.colors.receita : theme.colors.despesa }]}>
              {statusUpdate.newStatus ? '✅ Pago' : '⏳ Pendente'}
            </Text>
          </Text>
        </View>
        <Button mode="contained" onPress={handleConfirmUpdate} style={styles.btn} buttonColor={theme.colors.secondary}>
          Confirmar Alteração
        </Button>
        <Button mode="outlined" onPress={reset} style={[styles.btn, { marginTop: 8 }]}>Cancelar</Button>
      </ScrollView>
    );
  }

  if ((mode === 'confirm' || mode === 'saving') && parsed) {
    const cats = parsed.context === 'escritorio' ? OFFICE_CATEGORIES : PERSONAL_CATEGORIES;
    return (
      <ScrollView contentContainerStyle={styles.confirmContainer}>
        <Text style={styles.sectionTitle}>Confirmar lançamento</Text>
        <Text style={styles.transcriptBox}>"{transcript}"</Text>
        <View style={styles.confirmCard}>
          <ConfirmRow label="Tipo" value={parsed.type === 'receita' ? '↓ Receita' : '↑ Despesa'} color={parsed.type === 'receita' ? theme.colors.receita : theme.colors.despesa} />
          <ConfirmRow label="Contexto" value={parsed.context === 'escritorio' ? 'Escritório' : 'Pessoal'} />
          <ConfirmRow label="Valor" value={fmt(parsed.amount ?? 0)} />
          <ConfirmRow label="Descrição" value={parsed.description ?? ''} />
          <ConfirmRow label="Categoria" value={parsed.category ?? ''} />
          <ConfirmRow label="Status" value={parsed.isPaid ? 'Pago' : 'Pendente'} />
        </View>
        {mode === 'saving' ? (
          <ActivityIndicator size="large" color={theme.colors.primary} style={{ marginTop: 24 }} />
        ) : (
          <>
            <Button mode="contained" onPress={handleConfirmNew} style={styles.btn} buttonColor={theme.colors.secondary}>
              Confirmar e Salvar
            </Button>
            <Button mode="outlined" onPress={reset} style={[styles.btn, { marginTop: 8 }]}>Tentar novamente</Button>
          </>
        )}
      </ScrollView>
    );
  }

  if (mode === 'transcribing') {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={{ marginTop: 16, color: theme.colors.textSecondary }}>Transcrevendo e interpretando áudio...</Text>
      </View>
    );
  }

  return (
    <View style={styles.center}>
      <Text style={styles.title}>Lançamento por Voz</Text>
      <Text style={styles.desc}>
        Fale seu lançamento ou comando, ex:{'\n'}
        "Gastei 50 reais no almoço"{'\n'}
        "Recebi 3000 de salário"{'\n'}
        "Paguei o condomínio"
      </Text>

      <TouchableOpacity
        onPress={mode === 'recording' ? handleStopRecording : handleStartRecording}
        style={[styles.micBtn, mode === 'recording' && styles.micBtnActive]}
      >
        <MaterialCommunityIcons
          name={mode === 'recording' ? 'stop' : 'microphone'}
          size={48}
          color="#fff"
        />
      </TouchableOpacity>

      {mode === 'recording' && (
        <Text style={styles.timer}>
          {Math.floor(seconds / 60).toString().padStart(2, '0')}:{(seconds % 60).toString().padStart(2, '0')}
        </Text>
      )}

      <Text style={styles.hint}>
        {mode === 'recording' ? 'Toque para parar' : 'Toque para gravar'}
      </Text>

      <Snackbar visible={snack !== ''} onDismiss={() => setSnack('')} duration={4000}
        style={{ backgroundColor: theme.colors.warning }}
        action={{ label: 'OK', onPress: () => setSnack('') }}>
        {snack}
      </Snackbar>
    </View>
  );
}

function ConfirmRow({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: theme.colors.border }}>
      <Text style={{ color: theme.colors.textSecondary, fontSize: 14 }}>{label}</Text>
      <Text style={{ fontWeight: '600', fontSize: 14, color: color ?? theme.colors.text }}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: theme.spacing.lg, backgroundColor: theme.colors.background },
  title: { fontSize: 22, fontWeight: 'bold', color: theme.colors.text, marginBottom: theme.spacing.sm, textAlign: 'center' },
  desc: { fontSize: 14, color: theme.colors.textSecondary, textAlign: 'center', marginBottom: theme.spacing.xl, lineHeight: 22 },
  micBtn: { width: 120, height: 120, borderRadius: 60, backgroundColor: theme.colors.primary, justifyContent: 'center', alignItems: 'center', shadowColor: theme.colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 12, elevation: 8 },
  micBtnActive: { backgroundColor: theme.colors.danger, shadowColor: theme.colors.danger },
  timer: { fontSize: 28, fontWeight: 'bold', color: theme.colors.danger, marginTop: theme.spacing.md },
  hint: { marginTop: theme.spacing.md, color: theme.colors.textSecondary, fontSize: 14 },
  confirmContainer: { padding: theme.spacing.md, paddingBottom: 40, backgroundColor: theme.colors.background },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: theme.colors.text, marginBottom: theme.spacing.sm },
  transcriptBox: { backgroundColor: theme.colors.surface, borderRadius: theme.borderRadius.sm, padding: theme.spacing.md, marginBottom: theme.spacing.md, fontSize: 14, color: theme.colors.textSecondary, fontStyle: 'italic', borderLeftWidth: 3, borderLeftColor: theme.colors.primary },
  confirmCard: { backgroundColor: theme.colors.surface, borderRadius: theme.borderRadius.md, padding: theme.spacing.md, marginBottom: theme.spacing.md, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
  confirmRow: { fontSize: 14, color: theme.colors.text, paddingVertical: 4 },
  bold: { fontWeight: 'bold' },
  btn: { borderRadius: theme.borderRadius.md, marginTop: theme.spacing.md, width: '100%' },
  doneIcon: { fontSize: 64, marginBottom: theme.spacing.md },
  doneTitle: { fontSize: 22, fontWeight: 'bold', color: theme.colors.text, marginBottom: theme.spacing.sm },
  doneSub: { fontSize: 14, color: theme.colors.textSecondary, textAlign: 'center', marginBottom: theme.spacing.lg },
});
