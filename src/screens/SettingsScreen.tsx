import React, { useState, useEffect } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
  TextInput as RNTextInput,
  Switch,
} from 'react-native';
import { Text, ActivityIndicator, Snackbar } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { theme } from '../theme';
import { useAuth } from '../context/AuthContext';
import { getLearnings } from '../services/learnings';
import { collection, getDocs, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../config/firebase';

const APP_VERSION = '1.0.0';

export default function SettingsScreen() {
  const { user } = useAuth();

  // API Keys
  const [anthropicKey, setAnthropicKey] = useState('');
  const [openAIKey, setOpenAIKey] = useState('');
  const [showAnthropicKey, setShowAnthropicKey] = useState(false);
  const [showOpenAIKey, setShowOpenAIKey] = useState(false);
  const [testingAnthropic, setTestingAnthropic] = useState(false);
  const [testingOpenAI, setTestingOpenAI] = useState(false);

  // WhatsApp
  const [whatsapp1, setWhatsapp1] = useState('5563992132924');
  const [whatsapp2, setWhatsapp2] = useState('5563992752338');

  // Calendar
  const [autoReminders, setAutoReminders] = useState(false);
  const [reminderDays, setReminderDays] = useState('3');

  // Misc
  const [saving, setSaving] = useState(false);
  const [snackVisible, setSnackVisible] = useState(false);
  const [snackMessage, setSnackMessage] = useState('');
  const [learningsCount, setLearningsCount] = useState(0);

  useEffect(() => {
    loadSettings();
    loadLearningsCount();
  }, []);

  async function loadSettings() {
    const ak = await AsyncStorage.getItem('anthropic_api_key') ?? '';
    const ok = await AsyncStorage.getItem('openai_api_key') ?? '';
    const raw = await AsyncStorage.getItem('whatsapp_numbers');
    const autoR = await AsyncStorage.getItem('auto_reminders');
    const rDays = await AsyncStorage.getItem('reminder_days');

    setAnthropicKey(ak);
    setOpenAIKey(ok);
    if (raw) {
      try {
        const nums = JSON.parse(raw);
        if (nums[0]) setWhatsapp1(nums[0]);
        if (nums[1]) setWhatsapp2(nums[1]);
      } catch {}
    }
    setAutoReminders(autoR === 'true');
    if (rDays) setReminderDays(rDays);
  }

  async function loadLearningsCount() {
    if (!user) return;
    const items = await getLearnings(user.uid);
    setLearningsCount(items.length);
  }

  function showSnack(msg: string) {
    setSnackMessage(msg);
    setSnackVisible(true);
  }

  async function handleSaveAll() {
    setSaving(true);
    try {
      await AsyncStorage.setItem('anthropic_api_key', anthropicKey.trim());
      await AsyncStorage.setItem('openai_api_key', openAIKey.trim());
      await AsyncStorage.setItem(
        'whatsapp_numbers',
        JSON.stringify([whatsapp1.trim(), whatsapp2.trim()])
      );
      await AsyncStorage.setItem('auto_reminders', String(autoReminders));
      await AsyncStorage.setItem('reminder_days', reminderDays);
      showSnack('Configurações salvas com sucesso!');
    } catch {
      Alert.alert('Erro', 'Não foi possível salvar as configurações.');
    } finally {
      setSaving(false);
    }
  }

  async function handleTestAnthropic() {
    if (!anthropicKey.trim()) {
      Alert.alert('Aviso', 'Digite a chave da API Anthropic primeiro.');
      return;
    }
    setTestingAnthropic(true);
    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': anthropicKey.trim(),
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 10,
          messages: [{ role: 'user', content: 'Olá' }],
        }),
      });
      if (response.ok) {
        showSnack('Chave Anthropic válida! Conexão bem-sucedida.');
      } else {
        const err = await response.json();
        Alert.alert('Erro', `Chave inválida: ${err?.error?.message ?? response.status}`);
      }
    } catch {
      Alert.alert('Erro', 'Não foi possível conectar à API Anthropic.');
    } finally {
      setTestingAnthropic(false);
    }
  }

  async function handleTestOpenAI() {
    if (!openAIKey.trim()) {
      Alert.alert('Aviso', 'Digite a chave da API OpenAI primeiro.');
      return;
    }
    setTestingOpenAI(true);
    try {
      const response = await fetch('https://api.openai.com/v1/models', {
        headers: { Authorization: `Bearer ${openAIKey.trim()}` },
      });
      if (response.ok) {
        showSnack('Chave OpenAI válida! Conexão bem-sucedida.');
      } else {
        Alert.alert('Erro', `Chave inválida: ${response.status}`);
      }
    } catch {
      Alert.alert('Erro', 'Não foi possível conectar à API OpenAI.');
    } finally {
      setTestingOpenAI(false);
    }
  }

  async function handleClearLearnings() {
    if (!user) return;
    Alert.alert(
      'Limpar Aprendizados',
      'Isso removerá todas as correções e aprendizados salvos. Esta ação não pode ser desfeita.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Limpar',
          style: 'destructive',
          onPress: async () => {
            try {
              const q = await getDocs(collection(db, `learnings/${user.uid}/items`));
              for (const document of q.docs) {
                await deleteDoc(doc(db, `learnings/${user.uid}/items`, document.id));
              }
              setLearningsCount(0);
              showSnack('Dados de aprendizado limpos com sucesso.');
            } catch {
              Alert.alert('Erro', 'Não foi possível limpar os dados de aprendizado.');
            }
          },
        },
      ]
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>

        {/* Integrations */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>Integrações</Text>

          <View style={styles.card}>
            <Text style={styles.fieldLabel}>Chave API Anthropic (Claude)</Text>
            <View style={styles.inputRow}>
              <RNTextInput
                style={styles.input}
                value={anthropicKey}
                onChangeText={setAnthropicKey}
                placeholder="sk-ant-..."
                secureTextEntry={!showAnthropicKey}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TouchableOpacity
                onPress={() => setShowAnthropicKey(!showAnthropicKey)}
                style={styles.eyeBtn}
              >
                <MaterialCommunityIcons
                  name={showAnthropicKey ? 'eye-off' : 'eye'}
                  size={20}
                  color={theme.colors.textSecondary}
                />
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              style={[styles.testBtn, testingAnthropic && styles.btnDisabled]}
              onPress={handleTestAnthropic}
              disabled={testingAnthropic}
            >
              {testingAnthropic ? (
                <ActivityIndicator size="small" color={theme.colors.primary} />
              ) : (
                <MaterialCommunityIcons name="connection" size={16} color={theme.colors.primary} />
              )}
              <Text style={styles.testBtnText}>
                {testingAnthropic ? 'Testando...' : 'Testar Conexão'}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.card}>
            <Text style={styles.fieldLabel}>Chave API OpenAI (Whisper)</Text>
            <View style={styles.inputRow}>
              <RNTextInput
                style={styles.input}
                value={openAIKey}
                onChangeText={setOpenAIKey}
                placeholder="sk-..."
                secureTextEntry={!showOpenAIKey}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TouchableOpacity
                onPress={() => setShowOpenAIKey(!showOpenAIKey)}
                style={styles.eyeBtn}
              >
                <MaterialCommunityIcons
                  name={showOpenAIKey ? 'eye-off' : 'eye'}
                  size={20}
                  color={theme.colors.textSecondary}
                />
              </TouchableOpacity>
            </View>
            <Text style={styles.fieldHint}>
              Necessária para transcrição de áudio (Lançamento por Voz)
            </Text>
            <TouchableOpacity
              style={[styles.testBtn, testingOpenAI && styles.btnDisabled]}
              onPress={handleTestOpenAI}
              disabled={testingOpenAI}
            >
              {testingOpenAI ? (
                <ActivityIndicator size="small" color={theme.colors.primary} />
              ) : (
                <MaterialCommunityIcons name="connection" size={16} color={theme.colors.primary} />
              )}
              <Text style={styles.testBtnText}>
                {testingOpenAI ? 'Testando...' : 'Testar Conexão'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* WhatsApp */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>Notificações WhatsApp</Text>

          <View style={styles.card}>
            <Text style={styles.fieldHint}>
              Formato: código do país + DDD + número (sem + ou espaços){'\n'}
              Exemplo: 5563992132924
            </Text>

            <Text style={styles.fieldLabel}>Número 1</Text>
            <RNTextInput
              style={styles.inputFull}
              value={whatsapp1}
              onChangeText={setWhatsapp1}
              placeholder="5563992132924"
              keyboardType="number-pad"
            />

            <Text style={styles.fieldLabel}>Número 2</Text>
            <RNTextInput
              style={styles.inputFull}
              value={whatsapp2}
              onChangeText={setWhatsapp2}
              placeholder="5563992752338"
              keyboardType="number-pad"
            />
          </View>
        </View>

        {/* Calendar */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>Calendário</Text>

          <View style={styles.card}>
            <View style={styles.toggleRow}>
              <View style={styles.toggleContent}>
                <Text style={styles.toggleLabel}>Criar lembretes automaticamente</Text>
                <Text style={styles.fieldHint}>
                  Ao abrir o app, cria lembretes no calendário para despesas próximas do vencimento
                </Text>
              </View>
              <Switch
                value={autoReminders}
                onValueChange={setAutoReminders}
                trackColor={{ false: theme.colors.border, true: theme.colors.primary + '80' }}
                thumbColor={autoReminders ? theme.colors.primary : theme.colors.textSecondary}
              />
            </View>

            <Text style={styles.fieldLabel}>Dias de antecedência</Text>
            <RNTextInput
              style={styles.inputSmall}
              value={reminderDays}
              onChangeText={setReminderDays}
              placeholder="3"
              keyboardType="number-pad"
            />
            <Text style={styles.fieldHint}>
              Criar lembrete quantos dias antes do vencimento
            </Text>
          </View>
        </View>

        {/* About */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>Sobre</Text>

          <View style={styles.card}>
            <View style={styles.aboutRow}>
              <Text style={styles.aboutLabel}>Versão do App</Text>
              <Text style={styles.aboutValue}>{APP_VERSION}</Text>
            </View>

            <View style={[styles.aboutRow, { borderBottomWidth: 0 }]}>
              <Text style={styles.aboutLabel}>Aprendizados salvos</Text>
              <Text style={styles.aboutValue}>{learningsCount}</Text>
            </View>

            <TouchableOpacity
              style={styles.dangerBtn}
              onPress={handleClearLearnings}
            >
              <MaterialCommunityIcons name="delete-outline" size={16} color={theme.colors.danger} />
              <Text style={styles.dangerBtnText}>Limpar dados de aprendizado</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Save button */}
        <TouchableOpacity
          style={[styles.saveBtn, saving && styles.btnDisabled]}
          onPress={handleSaveAll}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <MaterialCommunityIcons name="content-save" size={20} color="#fff" />
          )}
          <Text style={styles.saveBtnText}>
            {saving ? 'Salvando...' : 'Salvar Configurações'}
          </Text>
        </TouchableOpacity>
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
  sectionHeader: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: theme.spacing.sm,
    paddingHorizontal: theme.spacing.xs,
  },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 2,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 6,
    marginTop: theme.spacing.sm,
  },
  fieldHint: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    lineHeight: 17,
    marginBottom: 4,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.sm,
    backgroundColor: theme.colors.background,
    marginBottom: theme.spacing.sm,
  },
  input: {
    flex: 1,
    padding: 10,
    fontSize: 14,
    color: theme.colors.text,
  },
  inputFull: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.sm,
    backgroundColor: theme.colors.background,
    padding: 10,
    fontSize: 14,
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
  },
  inputSmall: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.sm,
    backgroundColor: theme.colors.background,
    padding: 10,
    fontSize: 14,
    color: theme.colors.text,
    width: 80,
    marginBottom: 4,
  },
  eyeBtn: {
    padding: 10,
  },
  testBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: theme.colors.primary,
    borderRadius: theme.borderRadius.sm,
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  btnDisabled: { opacity: 0.5 },
  testBtnText: {
    fontSize: 13,
    color: theme.colors.primary,
    fontWeight: '600',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    marginBottom: theme.spacing.sm,
  },
  toggleContent: { flex: 1 },
  toggleLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: theme.colors.text,
    marginBottom: 2,
  },
  aboutRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  aboutLabel: {
    fontSize: 14,
    color: theme.colors.text,
  },
  aboutValue: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    fontWeight: '500',
  },
  dangerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: theme.spacing.md,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: theme.colors.danger,
    borderRadius: theme.borderRadius.sm,
    alignSelf: 'flex-start',
  },
  dangerBtnText: {
    fontSize: 13,
    color: theme.colors.danger,
    fontWeight: '600',
  },
  saveBtn: {
    backgroundColor: theme.colors.primary,
    borderRadius: theme.borderRadius.md,
    paddingVertical: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
    marginTop: theme.spacing.sm,
  },
  saveBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
