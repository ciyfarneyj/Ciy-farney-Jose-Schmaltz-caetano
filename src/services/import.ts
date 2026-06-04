import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { read, utils } from 'xlsx';
import { Transaction } from '../types';
import { CLAUDE_MODEL } from '../config/claude';

export async function pickExcelFile(): Promise<Record<string, unknown>[] | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
    ],
    copyToCacheDirectory: true,
  });

  if (result.canceled || !result.assets?.[0]?.uri) return null;

  const uri = result.assets[0].uri;
  const base64 = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });

  const wb = read(base64, { type: 'base64' });
  const sheetName = wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];
  const rows = utils.sheet_to_json<Record<string, unknown>>(ws);
  return rows;
}

function tryParseDate(value: unknown): string {
  if (!value) return new Date().toISOString();
  if (typeof value === 'number') {
    // Excel date serial
    const excelEpoch = new Date(1899, 11, 30);
    const date = new Date(excelEpoch.getTime() + value * 86400000);
    return date.toISOString();
  }
  const str = String(value);
  // Try dd/MM/yyyy
  const br = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (br) {
    return new Date(Number(br[3]), Number(br[2]) - 1, Number(br[1])).toISOString();
  }
  const d = new Date(str);
  if (!isNaN(d.getTime())) return d.toISOString();
  return new Date().toISOString();
}

function tryParseAmount(value: unknown): number {
  if (typeof value === 'number') return Math.abs(value);
  const str = String(value ?? '0')
    .replace(/[R$\s]/g, '')
    .replace(/\./g, '')
    .replace(',', '.');
  const n = parseFloat(str);
  return isNaN(n) ? 0 : Math.abs(n);
}

function detectColumn(row: Record<string, unknown>, candidates: string[]): unknown {
  for (const key of Object.keys(row)) {
    if (candidates.some((c) => key.toLowerCase().includes(c.toLowerCase()))) {
      return row[key];
    }
  }
  return undefined;
}

export function mapRowsToTransactions(
  rows: Record<string, unknown>[],
  userId: string
): Omit<Transaction, 'id' | 'createdAt'>[] {
  return rows
    .map((row) => {
      const amountRaw = detectColumn(row, ['Valor', 'Value', 'Amount', 'Montante']);
      const descRaw = detectColumn(row, ['Descrição', 'Descricao', 'Description', 'Desc', 'Nome', 'Name']);
      const dateRaw = detectColumn(row, ['Data', 'Date', 'Dt']);
      const typeRaw = detectColumn(row, ['Tipo', 'Type', 'Natureza']);
      const catRaw = detectColumn(row, ['Categoria', 'Category', 'Cat']);
      const ctxRaw = detectColumn(row, ['Contexto', 'Context', 'Ambiente']);
      const paidRaw = detectColumn(row, ['Status', 'Pago', 'Paid', 'Situação']);

      const typeStr = String(typeRaw ?? '').toLowerCase();
      const type: Transaction['type'] =
        typeStr.includes('receita') || typeStr.includes('entrada') || typeStr.includes('income')
          ? 'receita'
          : 'despesa';

      const ctxStr = String(ctxRaw ?? '').toLowerCase();
      const context: Transaction['context'] =
        ctxStr.includes('escrit') || ctxStr.includes('office') || ctxStr.includes('work')
          ? 'escritorio'
          : 'pessoal';

      const paidStr = String(paidRaw ?? '').toLowerCase();
      const isPaid =
        paidStr.includes('pago') || paidStr.includes('paid') || paidStr.includes('sim') || paidStr === 'true';

      return {
        type,
        context,
        amount: tryParseAmount(amountRaw),
        description: String(descRaw ?? 'Importado do Excel'),
        category: String(catRaw ?? 'Outros'),
        date: tryParseDate(dateRaw),
        isPaid,
        userId,
      };
    })
    .filter((t) => t.amount > 0);
}

export async function parseTransactionsWithClaude(
  rawText: string,
  userId: string,
  apiKey: string
): Promise<Omit<Transaction, 'id' | 'createdAt'>[]> {
  if (!apiKey) throw new Error('Chave da API Anthropic não configurada.');

  const prompt = `Você é um assistente financeiro. Analise os dados abaixo e retorne um JSON array de transações.
Cada transação deve ter: type ("receita" ou "despesa"), context ("pessoal" ou "escritorio"), amount (número positivo), description (string), category (string em português), date (ISO string), isPaid (boolean).
userId para todas: "${userId}"

Dados:
${rawText}

Retorne APENAS o JSON array, sem texto adicional.`;

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
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!response.ok) {
    throw new Error(`Erro na API Claude: ${response.status}`);
  }

  const data = await response.json();
  const text: string = data?.content?.[0]?.text ?? '[]';

  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) throw new Error('Resposta inválida da API Claude.');

  const parsed = JSON.parse(jsonMatch[0]);
  return parsed.map((item: Record<string, unknown>) => ({
    ...item,
    userId,
    amount: Number(item.amount ?? 0),
    isPaid: Boolean(item.isPaid ?? false),
    date: String(item.date ?? new Date().toISOString()),
  })) as Omit<Transaction, 'id' | 'createdAt'>[];
}
