import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { CLAUDE_MODEL } from '../config/claude';

export interface ParsedCardItem {
  description: string;
  amount: number;
  date: string;
  category: string;
}

export async function pickPDFFile(): Promise<{ uri: string; name: string } | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: 'application/pdf',
    copyToCacheDirectory: true,
  });

  if (result.canceled || !result.assets?.[0]?.uri) return null;

  return {
    uri: result.assets[0].uri,
    name: result.assets[0].name ?? 'fatura.pdf',
  };
}

export async function readPDFAsBase64(uri: string): Promise<string> {
  const base64 = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  return base64;
}

export async function parseCardStatementWithClaude(
  pdfBase64: string,
  apiKey: string
): Promise<ParsedCardItem[]> {
  if (!apiKey) throw new Error('Chave da API Anthropic não configurada. Configure nas Configurações.');

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'document',
              source: {
                type: 'base64',
                media_type: 'application/pdf',
                data: pdfBase64,
              },
            },
            {
              type: 'text',
              text: 'Este é um extrato de cartão de crédito. Extraia todas as transações e retorne um JSON array com: [{"description": "...", "amount": 0.00, "date": "ISO string", "category": "..."}]. Identifique a categoria baseado na descrição (ex: Alimentação, Transporte, Saúde, Lazer, Serviços, Outros). Os valores devem ser números positivos. Datas em formato ISO 8601. Retorne APENAS o JSON array, sem texto adicional.',
            },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Erro na API Claude: ${response.status} - ${errText}`);
  }

  const data = await response.json();
  const text: string = data?.content?.[0]?.text ?? '[]';

  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) throw new Error('Resposta inválida da API Claude. Não foi possível extrair transações.');

  try {
    const parsed = JSON.parse(jsonMatch[0]);
    return parsed.map((item: Record<string, unknown>) => ({
      description: String(item.description ?? 'Transação'),
      amount: Math.abs(Number(item.amount ?? 0)),
      date: String(item.date ?? new Date().toISOString()),
      category: String(item.category ?? 'Outros'),
    })) as ParsedCardItem[];
  } catch {
    throw new Error('Erro ao processar resposta da API Claude.');
  }
}
