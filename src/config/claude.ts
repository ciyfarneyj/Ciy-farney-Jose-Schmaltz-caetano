import AsyncStorage from '@react-native-async-storage/async-storage';

export const CLAUDE_MODEL = 'claude-sonnet-4-6';

export async function getAnthropicKey(): Promise<string> {
  return (await AsyncStorage.getItem('anthropic_api_key')) ?? '';
}

export async function getOpenAIKey(): Promise<string> {
  return (await AsyncStorage.getItem('openai_api_key')) ?? '';
}

export async function getWhatsAppNumbers(): Promise<string[]> {
  const raw = await AsyncStorage.getItem('whatsapp_numbers');
  if (!raw) return ['5563992132924', '5563992752338'];
  try { return JSON.parse(raw); } catch { return ['5563992132924', '5563992752338']; }
}
