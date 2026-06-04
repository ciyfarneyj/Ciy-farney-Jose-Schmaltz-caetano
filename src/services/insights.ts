import { Transaction, Insight, MonthlySummary } from '../types';
import { parseISO, differenceInDays, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

let insightIdCounter = 0;
function nextId(): string {
  insightIdCounter += 1;
  return `insight_${insightIdCounter}_${Date.now()}`;
}

/**
 * Detect duplicate transactions: same amount and similar description within 7 days.
 */
export function detectDuplicates(transactions: Transaction[]): Insight[] {
  const insights: Insight[] = [];
  const despesas = transactions.filter((t) => t.type === 'despesa');

  for (let i = 0; i < despesas.length; i++) {
    for (let j = i + 1; j < despesas.length; j++) {
      const a = despesas[i];
      const b = despesas[j];

      const sameAmount = Math.abs(a.amount - b.amount) < 0.01;
      const similarDesc =
        a.description.trim().toLowerCase() === b.description.trim().toLowerCase();
      const daysDiff = Math.abs(
        differenceInDays(parseISO(a.date), parseISO(b.date))
      );

      if (sameAmount && similarDesc && daysDiff <= 7) {
        const alreadyAdded = insights.some(
          (ins) =>
            ins.relatedTransactions?.includes(a.id) &&
            ins.relatedTransactions?.includes(b.id)
        );
        if (!alreadyAdded) {
          insights.push({
            id: nextId(),
            type: 'duplicate',
            title: 'Possível Lançamento Duplicado',
            description: `A despesa "${a.description}" de R$ ${formatCurrency(
              a.amount
            )} foi lançada duas vezes em um intervalo de ${daysDiff} dias. Verifique se não é um lançamento duplicado.`,
            severity: 'warning',
            relatedTransactions: [a.id, b.id],
          });
        }
      }
    }
  }

  return insights;
}

/**
 * Detect excessive spending: current month category > previous month average + 20%.
 */
export function detectExcessiveSpending(
  currentTransactions: Transaction[],
  previousTransactions: Transaction[]
): Insight[] {
  const insights: Insight[] = [];

  const currentByCategory = groupExpensesByCategory(currentTransactions);
  const previousByCategory = groupExpensesByCategory(previousTransactions);

  for (const [category, currentAmount] of Object.entries(currentByCategory)) {
    const previousAmount = previousByCategory[category] ?? 0;
    if (previousAmount === 0) continue;

    const increaseRatio = (currentAmount - previousAmount) / previousAmount;

    if (increaseRatio > 0.2) {
      const percentIncrease = Math.round(increaseRatio * 100);
      insights.push({
        id: nextId(),
        type: 'excessive',
        title: `Gasto Elevado: ${category}`,
        description: `Seus gastos com "${category}" aumentaram ${percentIncrease}% em relação ao mês anterior. Mês atual: ${formatCurrency(
          currentAmount
        )} | Mês anterior: ${formatCurrency(previousAmount)}.`,
        severity: percentIncrease > 50 ? 'danger' : 'warning',
      });
    }
  }

  return insights;
}

/**
 * Generate a savings plan based on income vs expenses ratio.
 */
export function generateSavingsPlan(summary: MonthlySummary): Insight[] {
  const insights: Insight[] = [];

  if (summary.totalReceitas === 0) return insights;

  const expenseRatio = summary.totalDespesas / summary.totalReceitas;

  if (expenseRatio >= 1.0) {
    insights.push({
      id: nextId(),
      type: 'economy_plan',
      title: 'Atenção: Despesas Superam Receitas!',
      description: `Neste mês suas despesas (${formatCurrency(
        summary.totalDespesas
      )}) superaram suas receitas (${formatCurrency(
        summary.totalReceitas
      )}). Seu saldo está negativo em ${formatCurrency(
        Math.abs(summary.balance)
      )}. Revise seus gastos urgentemente.`,
      severity: 'danger',
    });
  } else if (expenseRatio >= 0.9) {
    const reductionTarget = summary.totalDespesas - summary.totalReceitas * 0.7;
    insights.push({
      id: nextId(),
      type: 'economy_plan',
      title: 'Plano de Economia Necessário',
      description: `Você está gastando ${Math.round(
        expenseRatio * 100
      )}% da sua renda. Recomenda-se reduzir despesas em ${formatCurrency(
        reductionTarget
      )} para atingir a meta de 70% da renda.`,
      severity: 'warning',
    });
  } else if (expenseRatio >= 0.7) {
    const savingsAmount = summary.totalReceitas - summary.totalDespesas;
    const targetSavings = summary.totalReceitas * 0.3;
    insights.push({
      id: nextId(),
      type: 'savings_tip',
      title: 'Plano de Poupança',
      description: `Você economizou ${formatCurrency(
        savingsAmount
      )} este mês (${Math.round(
        (1 - expenseRatio) * 100
      )}% da renda). A meta ideal é poupar 30% (${formatCurrency(
        targetSavings
      )}). Continue assim!`,
      severity: 'info',
    });
  } else {
    insights.push({
      id: nextId(),
      type: 'savings_tip',
      title: 'Excelente Controle Financeiro!',
      description: `Parabéns! Você economizou ${Math.round(
        (1 - expenseRatio) * 100
      )}% da sua renda este mês. Continue investindo o excedente para garantir sua segurança financeira.`,
      severity: 'info',
    });
  }

  return insights;
}

/**
 * Generate general economy tips based on top spending categories.
 */
export function generateTips(transactions: Transaction[]): Insight[] {
  const insights: Insight[] = [];
  const byCategory = groupExpensesByCategory(transactions);

  if (Object.keys(byCategory).length === 0) return insights;

  const sorted = Object.entries(byCategory).sort(([, a], [, b]) => b - a);
  const totalExpenses = sorted.reduce((sum, [, v]) => sum + v, 0);

  const tips: Record<string, string> = {
    Alimentação:
      'Considere preparar refeições em casa com mais frequência. Planejar o cardápio semanal pode reduzir desperdícios e custos.',
    Transporte:
      'Avalie alternativas como transporte público, bicicleta ou caronas compartilhadas para reduzir gastos com combustível.',
    Lazer:
      'Procure opções gratuitas ou de baixo custo para lazer, como parques, eventos culturais gratuitos e streamings compartilhados.',
    'Software/Assinaturas':
      'Revise suas assinaturas e cancele as que não utiliza regularmente. Pequenos valores mensais somam muito no ano.',
    Saúde:
      'Invista em prevenção: práticas de exercício regular e alimentação saudável reduzem gastos médicos no longo prazo.',
    Vestuário:
      'Crie uma lista de necessidades antes de comprar roupas. Aproveite liquidações e compras fora de temporada.',
    Marketing:
      'Explore estratégias de marketing digital de baixo custo como redes sociais orgânicas e e-mail marketing.',
    Serviços:
      'Avalie quais serviços terceirizados podem ser internalizados ou renegociados para obter melhores condições.',
    Outros:
      'Categorize melhor seus gastos em "Outros" para identificar oportunidades de economia mais específicas.',
  };

  const topCategories = sorted.slice(0, 3);

  for (const [category, amount] of topCategories) {
    const percentage = Math.round((amount / totalExpenses) * 100);
    const tip = tips[category];

    if (tip && percentage >= 15) {
      insights.push({
        id: nextId(),
        type: 'economy_plan',
        title: `Dica de Economia: ${category}`,
        description: `${category} representa ${percentage}% das suas despesas (${formatCurrency(
          amount
        )}). ${tip}`,
        severity: 'info',
      });
    }
  }

  return insights;
}

/**
 * Run all insights engines and return combined results.
 */
export function generateAllInsights(
  currentTransactions: Transaction[],
  previousTransactions: Transaction[],
  summary: MonthlySummary
): Insight[] {
  insightIdCounter = 0;

  const duplicates = detectDuplicates(currentTransactions);
  const excessive = detectExcessiveSpending(currentTransactions, previousTransactions);
  const savingsPlan = generateSavingsPlan(summary);
  const tips = generateTips(currentTransactions);

  return [...duplicates, ...excessive, ...savingsPlan, ...tips];
}

// --- Helpers ---

function groupExpensesByCategory(
  transactions: Transaction[]
): Record<string, number> {
  const result: Record<string, number> = {};
  for (const t of transactions) {
    if (t.type !== 'despesa') continue;
    result[t.category] = (result[t.category] ?? 0) + t.amount;
  }
  return result;
}

function formatCurrency(value: number): string {
  return value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}
