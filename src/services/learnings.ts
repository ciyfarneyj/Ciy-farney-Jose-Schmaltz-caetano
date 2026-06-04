import {
  collection,
  addDoc,
  getDocs,
  query,
  orderBy,
  limit,
} from 'firebase/firestore';
import { db } from '../config/firebase';

export type LearningType = 'audio_parse' | 'pdf_parse' | 'excel_import';

export interface Learning {
  id?: string;
  type: LearningType;
  original: Record<string, unknown>;
  corrected: Record<string, unknown>;
  userId: string;
  timestamp: string;
}

export async function saveLearning(
  type: LearningType,
  original: Record<string, unknown>,
  corrected: Record<string, unknown>,
  userId: string
): Promise<void> {
  try {
    await addDoc(collection(db, `learnings/${userId}/items`), {
      type,
      original,
      corrected,
      userId,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Erro ao salvar aprendizado:', error);
  }
}

export async function getLearnings(userId: string): Promise<Learning[]> {
  try {
    const q = query(
      collection(db, `learnings/${userId}/items`),
      orderBy('timestamp', 'desc'),
      limit(20)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => ({
      id: d.id,
      ...(d.data() as Omit<Learning, 'id'>),
    }));
  } catch {
    return [];
  }
}

export async function buildLearningContext(
  userId: string,
  _apiKey: string
): Promise<string> {
  const learnings = await getLearnings(userId);
  if (learnings.length === 0) return '';

  const corrections = learnings
    .slice(0, 10)
    .map((l) => {
      const origDesc = (l.original as Record<string, unknown>).description ?? '';
      const corrDesc = (l.corrected as Record<string, unknown>).description ?? '';
      const origCat = (l.original as Record<string, unknown>).category ?? '';
      const corrCat = (l.corrected as Record<string, unknown>).category ?? '';

      if (origDesc !== corrDesc || origCat !== corrCat) {
        return `- "${origDesc}" → "${corrDesc}" (categoria: "${origCat}" → "${corrCat}")`;
      }
      return null;
    })
    .filter(Boolean)
    .join('\n');

  if (!corrections) return '';

  return `Baseado em correções anteriores do usuário:\n${corrections}\n\nConsidere essas correções ao classificar transações similares.`;
}
