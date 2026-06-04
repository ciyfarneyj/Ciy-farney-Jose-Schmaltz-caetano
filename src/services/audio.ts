import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import { Transaction } from '../types';
import { CLAUDE_MODEL } from '../config/claude';

export async function startRecording(): Promise<{ recording: Audio.Recording }> {
  await Audio.requestPermissionsAsync();
  await Audio.setAudioModeAsync({
    allowsRecordingIOS: true,
    playsInSilentModeIOS: true,
  });

  const { recording } = await Audio.Recording.createAsync(
    Audio.RecordingOptionsPresets.HIGH_QUALITY
  );

  return { recording };
}

export async function stopRecording(recording: Audio.Recording): Promise<string> {
  await recording.stopAndUnloadAsync();
  await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
  const uri = recording.getURI();
  if (!uri) throw new Error('Não foi possível obter o arquivo de áudio.');
  return uri;
}

export async function transcribeAudio(audioUri: string, openAIKey: string): Promise<string> {
  if (!openAIKey) throw new Error('Chave da API OpenAI não configurada. Configure nas Configurações.');

  const base64 = await FileSystem.readAsStringAsync(audioUri, {
    encoding: FileSystem.EncodingType.Base64,
  });

  // Build multipart form manually since React Native doesn't support FormData with blobs from base64
  const boundary = 'FinanceControlBoundary' + Date.now();
  const fileName = audioUri.split('/').pop() ?? 'audio.m4a';
  const mimeType = 'audio/m4a';

  const body =
    '--' + boundary + '\r\n' +
    'Content-Disposition: form-data; name="model"\r\n\r\nwhisper-1\r\n' +
    '--' + boundary + '\r\n' +
    'Content-Disposition: form-data; name="language"\r\n\r\npt\r\n' +
    '--' + boundary + '\r\n' +
    `Content-Disposition: form-data; name="file"; filename="${fileName}"\r\n` +
    `Content-Type: ${mimeType}\r\n` +
    'Content-Transfer-Encoding: base64\r\n\r\n' +
    base64 + '\r\n' +
    '--' + boundary + '--\r\n';

  const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openAIKey}`,
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
    },
    body,
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Erro na transcrição: ${err}`);
  }

  const result = await response.json();
  return result.text ?? '';
}

export async function parseTranscriptToTransaction(
  transcript: string,
  userId: string,
  anthropicKey: string
): Promise<Omit<Transaction, 'id' | 'createdAt'> | null> {
  if (!anthropicKey) throw new Error('Chave da API Anthropic não configurada. Configure nas Configurações.');

  const prompt = `Você é um assistente financeiro brasileiro. O usuário disse o seguinte para lançar uma transação financeira:

"${transcript}"

Extraia as informações da transação e retorne APENAS um JSON válido com os campos:
{
  "type": "despesa" ou "receita",
  "context": "pessoal" ou "escritorio",
  "amount": número (valor em reais, positivo),
  "description": "descrição da transação",
  "category": "categoria (ex: Alimentação, Transporte, Moradia, Saúde, Lazer, Educação, Serviços, Outros)",
  "date": "data em ISO string (se não mencionada, use hoje: ${new Date().toISOString()})",
  "isPaid": true ou false (se não mencionado, assuma true para despesas passadas)
}

Retorne APENAS o JSON, sem texto adicional.`;

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': anthropicKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: 512,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!response.ok) {
    throw new Error(`Erro na API Claude: ${response.status}`);
  }

  const data = await response.json();
  const text: string = data?.content?.[0]?.text ?? '{}';

  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;

  try {
    const parsed = JSON.parse(jsonMatch[0]);
    return {
      type: parsed.type === 'receita' ? 'receita' : 'despesa',
      context: parsed.context === 'escritorio' ? 'escritorio' : 'pessoal',
      amount: Math.abs(Number(parsed.amount ?? 0)),
      description: String(parsed.description ?? transcript),
      category: String(parsed.category ?? 'Outros'),
      date: String(parsed.date ?? new Date().toISOString()),
      isPaid: Boolean(parsed.isPaid ?? true),
      userId,
    };
  } catch {
    return null;
  }
}

export async function parseCommandToStatusUpdate(
  transcript: string,
  transactions: import('../types').Transaction[],
  apiKey: string
): Promise<{ id: string; description: string; newStatus: boolean } | null> {
  const lc = transcript.toLowerCase();
  const isPaidCommand =
    lc.includes('paguei') || lc.includes('pagar') || lc.includes('quitei') || lc.includes('liquidei');
  const isUnpaidCommand =
    lc.includes('não paguei') || lc.includes('cancelei') || lc.includes('estornei');

  if (!isPaidCommand && !isUnpaidCommand) return null;

  const pendingDespesas = transactions.filter((t) => t.type === 'despesa');
  if (!pendingDespesas.length) return null;

  const txList = pendingDespesas
    .slice(0, 20)
    .map((t) => `id:${t.id} desc:"${t.description}" valor:${t.amount} pago:${t.isPaid}`)
    .join('\n');

  const prompt = `O usuário disse: "${transcript}"

Estas são as despesas registradas:
${txList}

Identifique qual despesa o usuário está se referindo e retorne APENAS um JSON:
{"id": "id_da_transacao", "description": "descrição", "newStatus": true}

Se não conseguir identificar, retorne: null`;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 256,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!res.ok) return null;
  const data = await res.json();
  const text = data.content?.[0]?.text ?? '';
  const match = text.match(/\{[\s\S]*?\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]);
  } catch {
    return null;
  }
}
