import React, { useState } from 'react';
import { View, StyleSheet, Image, ScrollView, TouchableOpacity } from 'react-native';
import { Text, Button, ActivityIndicator, Snackbar, SegmentedButtons } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { useNavigation } from '@react-navigation/native';

import { useAuth } from '../context/AuthContext';
import { addTransaction } from '../services/transactions';
import { saveLearning } from '../services/learnings';
import { TransactionContext } from '../types';
import { theme, PERSONAL_CATEGORIES, OFFICE_CATEGORIES } from '../theme';

interface ParsedBoleto {
  description: string;
  amount: number;
  dueDate: string;
  category: string;
  beneficiary?: string;
}

type Mode = 'idle' | 'parsing' | 'confirm' | 'saving' | 'done';

export default function BoletoScanScreen() {
  const { user } = useAuth();
  const navigation = useNavigation();
  const [mode, setMode] = useState<Mode>('idle');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [parsed, setParsed] = useState<ParsedBoleto | null>(null);
  const [context, setContext] = useState<TransactionContext>('pessoal');
  const [snack, setSnack] = useState('');

  async function pickImage(fromCamera: boolean) {
    const apiKey = await AsyncStorage.getItem('anthropic_api_key');
    if (!apiKey) {
      setSnack('Configure a chave API Anthropic (Claude) em Configurações para usar este recurso.');
      return;
    }

    let result;
    if (fromCamera) {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) { setSnack('Permissão de câmera negada.'); return; }
      result = await ImagePicker.launchCameraAsync({ base64: true, quality: 0.8 });
    } else {
      result = await ImagePicker.launchImageLibraryAsync({ base64: true, quality: 0.8 });
    }

    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    setImageUri(asset.uri);
    setMode('parsing');

    try {
      const base64 = asset.base64!;
      const mediaType = asset.mimeType ?? 'image/jpeg';
      const boletoData = await parseBoletoWithClaude(base64, mediaType as any, apiKey);
      setParsed(boletoData);
      setMode('confirm');
    } catch (e: any) {
      setSnack(e.message ?? 'Erro ao analisar imagem.');
      setMode('idle');
    }
  }

  async function parseBoletoWithClaude(
    base64: string,
    mediaType: 'image/jpeg' | 'image/png' | 'image/webp',
    apiKey: string
  ): Promise<ParsedBoleto> {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1024,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: mediaType, data: base64 },
            },
            {
              type: 'text',
              text: `Esta é uma imagem de um boleto ou carnê bancário brasileiro. Extraia as informações e retorne APENAS um JSON no formato:
{
  "description": "nome do beneficiário ou descrição da conta",
  "amount": 0.00,
  "dueDate": "YYYY-MM-DDT00:00:00.000Z",
  "category": "categoria mais adequada entre: Moradia, Saúde, Educação, Serviços, Impostos, Aluguel, Outros",
  "beneficiary": "nome do beneficiário"
}
Se não encontrar o valor ou data, use 0.00 e a data de hoje.`,
            },
          ],
        }],
      }),
    });

    if (!res.ok) throw new Error('Erro na API do Claude. Verifique sua chave.');
    const data = await res.json();
    const text = data.content?.[0]?.text ?? '';
    const match = text.match(/\{[\s\S]*?\}/);
    if (!match) throw new Error('Não foi possível extrair dados do boleto.');
    return JSON.parse(match[0]);
  }

  async function handleConfirm() {
    if (!user || !parsed) return;
    setMode('saving');
    try {
      const cats = context === 'escritorio' ? OFFICE_CATEGORIES : PERSONAL_CATEGORIES;
      const category = cats.includes(parsed.category) ? parsed.category : 'Outros';
      await addTransaction({
        type: 'despesa',
        context,
        amount: parsed.amount,
        description: parsed.description,
        category,
        date: new Date().toISOString(),
        dueDate: parsed.dueDate,
        isPaid: false,
        userId: user.uid,
      });
      await saveLearning('boleto_scan', JSON.stringify(parsed), JSON.stringify({ context }), user.uid);
      setMode('done');
    } catch (e: any) {
      setSnack(e.message ?? 'Erro ao salvar.');
      setMode('confirm');
    }
  }

  const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  if (mode === 'done') {
    return (
      <View style={styles.center}>
        <Text style={{ fontSize: 64, marginBottom: 16 }}>✅</Text>
        <Text style={styles.title}>Boleto lançado!</Text>
        <Text style={styles.desc}>A conta foi adicionada como despesa pendente.</Text>
        <Button mode="contained" onPress={() => { setMode('idle'); setParsed(null); setImageUri(null); }} style={styles.btn}>
          Escanear outro
        </Button>
        <Button mode="outlined" onPress={() => navigation.goBack()} style={[styles.btn, { marginTop: 8 }]}>Voltar</Button>
      </View>
    );
  }

  if (mode === 'parsing') {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={{ marginTop: 16, fontSize: 16 }}>Analisando boleto...</Text>
        <Text style={{ marginTop: 8, color: theme.colors.textSecondary, textAlign: 'center' }}>
          O Claude está extraindo as informações da imagem.
        </Text>
        {imageUri && <Image source={{ uri: imageUri }} style={styles.previewImg} />}
      </View>
    );
  }

  if ((mode === 'confirm' || mode === 'saving') && parsed) {
    return (
      <ScrollView contentContainerStyle={styles.confirmContainer}>
        {imageUri && <Image source={{ uri: imageUri }} style={styles.confirmImg} />}
        <Text style={styles.title}>Confirmar boleto</Text>

        <View style={styles.confirmCard}>
          <ConfirmRow label="Beneficiário" value={parsed.beneficiary ?? parsed.description} />
          <ConfirmRow label="Descrição" value={parsed.description} />
          <ConfirmRow label="Valor" value={fmt(parsed.amount)} color={theme.colors.despesa} />
          <ConfirmRow label="Vencimento" value={parsed.dueDate ? new Date(parsed.dueDate).toLocaleDateString('pt-BR') : '-'} />
          <ConfirmRow label="Categoria sugerida" value={parsed.category} />
        </View>

        <Text style={styles.fieldLabel}>Contexto</Text>
        <SegmentedButtons
          value={context}
          onValueChange={(v) => setContext(v as TransactionContext)}
          buttons={[
            { value: 'pessoal', label: 'Pessoal' },
            { value: 'escritorio', label: 'Escritório' },
          ]}
          style={{ marginBottom: theme.spacing.md }}
        />

        {mode === 'saving' ? (
          <ActivityIndicator size="large" color={theme.colors.primary} />
        ) : (
          <>
            <Button mode="contained" onPress={handleConfirm} style={styles.btn} buttonColor={theme.colors.primary}>
              Confirmar e Salvar
            </Button>
            <Button mode="outlined" onPress={() => { setMode('idle'); setImageUri(null); setParsed(null); }} style={[styles.btn, { marginTop: 8 }]}>
              Tentar novamente
            </Button>
          </>
        )}
        <Snackbar visible={snack !== ''} onDismiss={() => setSnack('')} duration={3000}>{snack}</Snackbar>
      </ScrollView>
    );
  }

  return (
    <View style={styles.center}>
      <MaterialCommunityIcons name="barcode-scan" size={80} color={theme.colors.primary} style={{ marginBottom: 16 }} />
      <Text style={styles.title}>Escanear Boleto ou Carnê</Text>
      <Text style={styles.desc}>
        Tire uma foto do boleto ou carnê. O Claude extrairá automaticamente o valor, vencimento e beneficiário.
      </Text>
      <Button mode="contained" icon="camera" onPress={() => pickImage(true)} style={styles.btn} buttonColor={theme.colors.primary}>
        Tirar Foto
      </Button>
      <Button mode="outlined" icon="image" onPress={() => pickImage(false)} style={[styles.btn, { marginTop: theme.spacing.sm }]}>
        Escolher da Galeria
      </Button>
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
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: theme.colors.border }}>
      <Text style={{ color: theme.colors.textSecondary, fontSize: 14 }}>{label}</Text>
      <Text style={{ fontWeight: '600', fontSize: 14, color: color ?? theme.colors.text, flex: 1, textAlign: 'right', marginLeft: 8 }} numberOfLines={2}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: theme.spacing.lg, backgroundColor: theme.colors.background },
  title: { fontSize: 22, fontWeight: 'bold', color: theme.colors.text, marginBottom: theme.spacing.sm, textAlign: 'center' },
  desc: { fontSize: 14, color: theme.colors.textSecondary, textAlign: 'center', marginBottom: theme.spacing.xl, lineHeight: 22 },
  btn: { borderRadius: theme.borderRadius.md, width: '100%' },
  previewImg: { width: 200, height: 150, borderRadius: 8, marginTop: 16, opacity: 0.7 },
  confirmContainer: { padding: theme.spacing.md, paddingBottom: 40, backgroundColor: theme.colors.background },
  confirmImg: { width: '100%', height: 180, borderRadius: theme.borderRadius.md, marginBottom: theme.spacing.md, resizeMode: 'contain', backgroundColor: '#f0f0f0' },
  confirmCard: { backgroundColor: theme.colors.surface, borderRadius: theme.borderRadius.md, padding: theme.spacing.md, marginBottom: theme.spacing.md, elevation: 2 },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: theme.colors.textSecondary, marginBottom: theme.spacing.sm, textTransform: 'uppercase', letterSpacing: 0.5 },
});
