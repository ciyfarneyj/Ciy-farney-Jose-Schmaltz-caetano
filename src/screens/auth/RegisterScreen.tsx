import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { Text, TextInput, Button, Snackbar } from 'react-native-paper';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { theme } from '../../theme';
import { AuthStackParamList } from '../../navigation';

type RegisterNavProp = NativeStackNavigationProp<AuthStackParamList, 'Register'>;

export default function RegisterScreen() {
  const navigation = useNavigation<RegisterNavProp>();
  const { signUp } = useAuth();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [snackVisible, setSnackVisible] = useState(false);

  function validate(): boolean {
    if (!name.trim()) {
      setError('Informe seu nome.');
      setSnackVisible(true);
      return false;
    }
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Informe um e-mail válido.');
      setSnackVisible(true);
      return false;
    }
    if (password.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres.');
      setSnackVisible(true);
      return false;
    }
    if (password !== confirmPassword) {
      setError('As senhas não coincidem.');
      setSnackVisible(true);
      return false;
    }
    return true;
  }

  async function handleRegister() {
    if (!validate()) return;
    setLoading(true);
    try {
      await signUp(email.trim(), password, name.trim());
    } catch (err: any) {
      setError(err.message ?? 'Erro ao cadastrar.');
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
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <View style={styles.logoContainer}>
            <MaterialCommunityIcons name="account-plus" size={48} color="#fff" />
          </View>
          <Text style={styles.appName}>Criar Conta</Text>
          <Text style={styles.tagline}>Cadastre-se para começar a controlar suas finanças</Text>
        </View>

        <View style={styles.card}>
          <TextInput
            label="Nome completo"
            value={name}
            onChangeText={setName}
            mode="outlined"
            autoCapitalize="words"
            style={styles.input}
            left={<TextInput.Icon icon="account-outline" />}
            outlineColor={theme.colors.border}
            activeOutlineColor={theme.colors.primary}
          />
          <TextInput
            label="E-mail"
            value={email}
            onChangeText={setEmail}
            mode="outlined"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            style={styles.input}
            left={<TextInput.Icon icon="email-outline" />}
            outlineColor={theme.colors.border}
            activeOutlineColor={theme.colors.primary}
          />
          <TextInput
            label="Senha"
            value={password}
            onChangeText={setPassword}
            mode="outlined"
            secureTextEntry={!showPassword}
            style={styles.input}
            left={<TextInput.Icon icon="lock-outline" />}
            right={
              <TextInput.Icon
                icon={showPassword ? 'eye-off' : 'eye'}
                onPress={() => setShowPassword((v) => !v)}
              />
            }
            outlineColor={theme.colors.border}
            activeOutlineColor={theme.colors.primary}
          />
          <TextInput
            label="Confirmar senha"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            mode="outlined"
            secureTextEntry={!showPassword}
            style={styles.input}
            left={<TextInput.Icon icon="lock-check-outline" />}
            outlineColor={theme.colors.border}
            activeOutlineColor={theme.colors.primary}
          />
          <Button
            mode="contained"
            onPress={handleRegister}
            loading={loading}
            disabled={loading}
            style={styles.button}
            contentStyle={styles.buttonContent}
            buttonColor={theme.colors.secondary}
          >
            Criar Conta
          </Button>
          <View style={styles.loginRow}>
            <Text style={styles.loginText}>Já tem conta? </Text>
            <TouchableOpacity onPress={() => navigation.navigate('Login')}>
              <Text style={styles.loginLink}>Entrar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      <Snackbar
        visible={snackVisible}
        onDismiss={() => setSnackVisible(false)}
        duration={3500}
        style={styles.snackbar}
        action={{ label: 'OK', onPress: () => setSnackVisible(false) }}
      >
        {error}
      </Snackbar>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: theme.colors.secondary },
  container: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xl,
  },
  header: { alignItems: 'center', marginBottom: theme.spacing.xl },
  logoContainer: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  appName: { fontSize: 28, fontWeight: 'bold', color: '#fff' },
  tagline: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.85)',
    marginTop: theme.spacing.xs,
    textAlign: 'center',
  },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  input: { marginBottom: theme.spacing.md, backgroundColor: theme.colors.surface },
  button: { marginTop: theme.spacing.sm, borderRadius: theme.borderRadius.md },
  buttonContent: { height: 48 },
  loginRow: { flexDirection: 'row', justifyContent: 'center', marginTop: theme.spacing.lg },
  loginText: { color: theme.colors.textSecondary, fontSize: 14 },
  loginLink: { color: theme.colors.primary, fontWeight: 'bold', fontSize: 14 },
  snackbar: { backgroundColor: theme.colors.danger },
});
