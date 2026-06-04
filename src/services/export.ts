import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as Print from 'expo-print';
import { utils, write } from 'xlsx';
import { Transaction, MonthlySummary } from '../types';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

function formatCurrency(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatDate(isoString: string): string {
  try {
    return format(parseISO(isoString), 'dd/MM/yyyy', { locale: ptBR });
  } catch {
    return isoString;
  }
}

export async function exportToExcel(
  transactions: Transaction[],
  fileName: string
): Promise<void> {
  const receitas = transactions.filter((t) => t.type === 'receita');
  const despesas = transactions.filter((t) => t.type === 'despesa');

  const toRows = (list: Transaction[]) =>
    list.map((t) => ({
      Data: formatDate(t.date),
      Descrição: t.description,
      Categoria: t.category,
      Contexto: t.context === 'pessoal' ? 'Pessoal' : 'Escritório',
      Valor: t.amount,
      Status: t.isPaid ? 'Pago' : 'Pendente',
    }));

  const wb = utils.book_new();
  const wsReceitas = utils.json_to_sheet(toRows(receitas));
  const wsDespesas = utils.json_to_sheet(toRows(despesas));

  utils.book_append_sheet(wb, wsReceitas, 'Receitas');
  utils.book_append_sheet(wb, wsDespesas, 'Despesas');

  const base64 = write(wb, { type: 'base64', bookType: 'xlsx' });
  const uri = FileSystem.documentDirectory + fileName + '.xlsx';
  await FileSystem.writeAsStringAsync(uri, base64, {
    encoding: FileSystem.EncodingType.Base64,
  });

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, {
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      dialogTitle: 'Exportar Excel',
    });
  }
}

export async function exportToPDF(
  transactions: Transaction[],
  summary: MonthlySummary,
  month: string
): Promise<void> {
  const rows = transactions
    .map(
      (t) => `
      <tr>
        <td>${formatDate(t.date)}</td>
        <td>${t.description}</td>
        <td>${t.category}</td>
        <td>${t.context === 'pessoal' ? 'Pessoal' : 'Escritório'}</td>
        <td style="color:${t.type === 'receita' ? '#34a853' : '#ea4335'}">${formatCurrency(t.amount)}</td>
        <td>${t.isPaid ? 'Pago' : 'Pendente'}</td>
      </tr>`
    )
    .join('');

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8" />
      <style>
        body { font-family: Arial, sans-serif; padding: 24px; color: #202124; }
        h1 { color: #1a73e8; }
        .summary { display: flex; gap: 16px; margin-bottom: 24px; flex-wrap: wrap; }
        .card { background: #f8f9fa; border-radius: 8px; padding: 16px; min-width: 140px; }
        .card h3 { margin: 0 0 4px; font-size: 13px; color: #5f6368; }
        .card p { margin: 0; font-size: 18px; font-weight: bold; }
        .green { color: #34a853; }
        .red { color: #ea4335; }
        .blue { color: #1a73e8; }
        table { width: 100%; border-collapse: collapse; margin-top: 8px; }
        th { background: #1a73e8; color: #fff; padding: 8px; text-align: left; font-size: 13px; }
        td { padding: 8px; border-bottom: 1px solid #e8eaed; font-size: 13px; }
        tr:nth-child(even) { background: #f8f9fa; }
      </style>
    </head>
    <body>
      <h1>FinanceControl — Relatório ${month}</h1>
      <div class="summary">
        <div class="card">
          <h3>Receitas</h3>
          <p class="green">${formatCurrency(summary.totalReceitas)}</p>
        </div>
        <div class="card">
          <h3>Despesas</h3>
          <p class="red">${formatCurrency(summary.totalDespesas)}</p>
        </div>
        <div class="card">
          <h3>Saldo</h3>
          <p class="${summary.balance >= 0 ? 'green' : 'red'}">${formatCurrency(summary.balance)}</p>
        </div>
        <div class="card">
          <h3>Pessoal Despesas</h3>
          <p class="red">${formatCurrency(summary.pessoalDespesas)}</p>
        </div>
        <div class="card">
          <h3>Escritório Despesas</h3>
          <p class="blue">${formatCurrency(summary.escritorioDespesas)}</p>
        </div>
      </div>
      <h2>Transações</h2>
      <table>
        <thead>
          <tr>
            <th>Data</th>
            <th>Descrição</th>
            <th>Categoria</th>
            <th>Contexto</th>
            <th>Valor</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <p style="margin-top:24px;color:#5f6368;font-size:12px">Gerado em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</p>
    </body>
    </html>
  `;

  const { uri } = await Print.printToFileAsync({ html });
  const destUri = FileSystem.documentDirectory + 'relatorio_' + month.replace('/', '-') + '.pdf';
  await FileSystem.moveAsync({ from: uri, to: destUri });

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(destUri, {
      mimeType: 'application/pdf',
      dialogTitle: 'Exportar PDF',
    });
  }
}

export async function exportToWord(
  transactions: Transaction[],
  summary: MonthlySummary,
  month: string
): Promise<void> {
  const rows = transactions
    .map(
      (t) => `
      <tr>
        <td>${formatDate(t.date)}</td>
        <td>${t.description}</td>
        <td>${t.category}</td>
        <td>${t.context === 'pessoal' ? 'Pessoal' : 'Escritório'}</td>
        <td>${formatCurrency(t.amount)}</td>
        <td>${t.isPaid ? 'Pago' : 'Pendente'}</td>
      </tr>`
    )
    .join('');

  const html = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office"
          xmlns:w="urn:schemas-microsoft-com:office:word"
          xmlns="http://www.w3.org/TR/REC-html40">
    <head>
      <meta charset="utf-8" />
      <title>Relatório FinanceControl ${month}</title>
      <!--[if gte mso 9]>
      <xml><w:WordDocument><w:View>Print</w:View></w:WordDocument></xml>
      <![endif]-->
      <style>
        body { font-family: Calibri, Arial, sans-serif; padding: 24px; }
        h1 { color: #1a73e8; }
        table { border-collapse: collapse; width: 100%; }
        th { background-color: #1a73e8; color: white; padding: 8px; border: 1px solid #999; }
        td { padding: 8px; border: 1px solid #ccc; }
      </style>
    </head>
    <body>
      <h1>FinanceControl — Relatório ${month}</h1>
      <h2>Resumo</h2>
      <table>
        <tr><th>Receitas</th><th>Despesas</th><th>Saldo</th></tr>
        <tr>
          <td>${formatCurrency(summary.totalReceitas)}</td>
          <td>${formatCurrency(summary.totalDespesas)}</td>
          <td>${formatCurrency(summary.balance)}</td>
        </tr>
      </table>
      <h2>Transações</h2>
      <table>
        <thead>
          <tr>
            <th>Data</th>
            <th>Descrição</th>
            <th>Categoria</th>
            <th>Contexto</th>
            <th>Valor</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <p>Gerado em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</p>
    </body>
    </html>
  `;

  const uri = FileSystem.documentDirectory + 'relatorio_' + month.replace('/', '-') + '.doc';
  await FileSystem.writeAsStringAsync(uri, html, {
    encoding: FileSystem.EncodingType.UTF8,
  });

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, {
      mimeType: 'application/msword',
      dialogTitle: 'Exportar Word',
    });
  }
}
