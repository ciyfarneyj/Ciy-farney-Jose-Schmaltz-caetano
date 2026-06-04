export type TransactionType = 'receita' | 'despesa';
export type TransactionContext = 'pessoal' | 'escritorio';

export interface Transaction {
  id: string;
  type: TransactionType;
  context: TransactionContext;
  amount: number;
  description: string;
  category: string;
  date: string; // ISO string
  dueDate?: string;
  isPaid: boolean;
  userId: string;
  createdAt: string;
}

export interface User {
  uid: string;
  email: string;
  displayName?: string;
}

export interface Insight {
  id: string;
  type: 'duplicate' | 'excessive' | 'savings_tip' | 'economy_plan';
  title: string;
  description: string;
  severity: 'info' | 'warning' | 'danger';
  relatedTransactions?: string[];
}

export interface MonthlySummary {
  month: string;
  totalReceitas: number;
  totalDespesas: number;
  balance: number;
  pessoalReceitas: number;
  pessoalDespesas: number;
  escritorioReceitas: number;
  escritorioDespesas: number;
}
