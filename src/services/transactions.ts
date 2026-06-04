import {
  collection,
  addDoc,
  getDocs,
  getDoc,
  doc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  Timestamp,
  QuerySnapshot,
  DocumentData,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { Transaction, MonthlySummary } from '../types';
import { format, startOfMonth, endOfMonth, parseISO } from 'date-fns';

const COLLECTION = 'transactions';

function docToTransaction(id: string, data: DocumentData): Transaction {
  return {
    id,
    type: data.type,
    context: data.context,
    amount: data.amount,
    description: data.description,
    category: data.category,
    date: data.date,
    dueDate: data.dueDate ?? undefined,
    isPaid: data.isPaid ?? false,
    userId: data.userId,
    createdAt: data.createdAt,
  };
}

export async function addTransaction(
  transaction: Omit<Transaction, 'id' | 'createdAt'>
): Promise<Transaction> {
  const now = new Date().toISOString();
  const docRef = await addDoc(collection(db, COLLECTION), {
    ...transaction,
    createdAt: now,
  });
  return { ...transaction, id: docRef.id, createdAt: now };
}

export async function getTransactionsByUser(userId: string): Promise<Transaction[]> {
  const q = query(
    collection(db, COLLECTION),
    where('userId', '==', userId),
    orderBy('date', 'desc')
  );
  const snapshot: QuerySnapshot<DocumentData> = await getDocs(q);
  return snapshot.docs.map((d) => docToTransaction(d.id, d.data()));
}

export async function getTransactionsByMonth(
  userId: string,
  year: number,
  month: number
): Promise<Transaction[]> {
  const start = startOfMonth(new Date(year, month - 1)).toISOString();
  const end = endOfMonth(new Date(year, month - 1)).toISOString();

  const q = query(
    collection(db, COLLECTION),
    where('userId', '==', userId),
    where('date', '>=', start),
    where('date', '<=', end),
    orderBy('date', 'desc')
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => docToTransaction(d.id, d.data()));
}

export async function updateTransaction(
  id: string,
  updates: Partial<Omit<Transaction, 'id' | 'userId' | 'createdAt'>>
): Promise<void> {
  await updateDoc(doc(db, COLLECTION, id), updates);
}

export async function deleteTransaction(id: string): Promise<void> {
  await deleteDoc(doc(db, COLLECTION, id));
}

export async function getTransactionById(id: string): Promise<Transaction | null> {
  const snapshot = await getDoc(doc(db, COLLECTION, id));
  if (!snapshot.exists()) return null;
  return docToTransaction(snapshot.id, snapshot.data());
}

export function computeMonthlySummary(
  transactions: Transaction[],
  year: number,
  month: number
): MonthlySummary {
  const label = `${String(month).padStart(2, '0')}/${year}`;

  let totalReceitas = 0;
  let totalDespesas = 0;
  let pessoalReceitas = 0;
  let pessoalDespesas = 0;
  let escritorioReceitas = 0;
  let escritorioDespesas = 0;

  for (const t of transactions) {
    const d = parseISO(t.date);
    if (d.getFullYear() !== year || d.getMonth() + 1 !== month) continue;

    if (t.type === 'receita') {
      totalReceitas += t.amount;
      if (t.context === 'pessoal') pessoalReceitas += t.amount;
      else escritorioReceitas += t.amount;
    } else {
      totalDespesas += t.amount;
      if (t.context === 'pessoal') pessoalDespesas += t.amount;
      else escritorioDespesas += t.amount;
    }
  }

  return {
    month: label,
    totalReceitas,
    totalDespesas,
    balance: totalReceitas - totalDespesas,
    pessoalReceitas,
    pessoalDespesas,
    escritorioReceitas,
    escritorioDespesas,
  };
}

export function groupByCategoryExpenses(
  transactions: Transaction[]
): Record<string, number> {
  const result: Record<string, number> = {};
  for (const t of transactions) {
    if (t.type !== 'despesa') continue;
    result[t.category] = (result[t.category] ?? 0) + t.amount;
  }
  return result;
}

export function getLast6MonthsSummaries(
  allTransactions: Transaction[]
): MonthlySummary[] {
  const now = new Date();
  const summaries: MonthlySummary[] = [];

  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const year = d.getFullYear();
    const month = d.getMonth() + 1;

    const monthly = allTransactions.filter((t) => {
      const td = parseISO(t.date);
      return td.getFullYear() === year && td.getMonth() + 1 === month;
    });

    summaries.push(computeMonthlySummary(monthly, year, month));
  }

  return summaries;
}
