import * as Calendar from 'expo-calendar';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { Transaction } from '../types';
import { format, parseISO, addDays, subDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export async function requestNotificationPermission(): Promise<boolean> {
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

export async function scheduleDuePushNotification(
  transaction: Transaction,
  daysBefore: number = 3
): Promise<string | null> {
  if (!transaction.dueDate) return null;
  const granted = await requestNotificationPermission();
  if (!granted) return null;

  const dueDate = parseISO(transaction.dueDate);
  const triggerDate = subDays(dueDate, daysBefore);
  triggerDate.setHours(9, 0, 0, 0);

  if (triggerDate <= new Date()) return null;

  const amount = transaction.amount.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
  const dueFmt = format(dueDate, 'dd/MM/yyyy', { locale: ptBR });

  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title: `⚠️ Vencimento em ${daysBefore} dias`,
      body: `${transaction.description} — ${amount} vence em ${dueFmt}`,
      data: { transactionId: transaction.id },
      sound: true,
    },
    trigger: { date: triggerDate },
  });

  return id;
}

export async function scheduleAllPushReminders(
  transactions: Transaction[],
  daysBefore: number = 3
): Promise<number> {
  const now = new Date();
  const thirtyDaysLater = addDays(now, 30);

  const pending = transactions.filter((t) => {
    if (t.type !== 'despesa' || t.isPaid || !t.dueDate) return false;
    const due = parseISO(t.dueDate);
    return due >= now && due <= thirtyDaysLater;
  });

  let scheduled = 0;
  for (const t of pending) {
    const id = await scheduleDuePushNotification(t, daysBefore);
    if (id) scheduled++;
  }
  return scheduled;
}

export async function requestCalendarPermission(): Promise<boolean> {
  const { status } = await Calendar.requestCalendarPermissionsAsync();
  return status === 'granted';
}

export async function getOrCreateAppCalendar(): Promise<string> {
  const granted = await requestCalendarPermission();
  if (!granted) throw new Error('Permissão de calendário não concedida.');

  const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
  const existing = calendars.find((c) => c.title === 'FinanceControl');
  if (existing) return existing.id;

  // Create new calendar
  let defaultCalendarSource: Calendar.Source | undefined;

  if (Platform.OS === 'ios') {
    const defaultCalendar = await Calendar.getDefaultCalendarAsync();
    defaultCalendarSource = defaultCalendar.source;
  } else {
    defaultCalendarSource = calendars.find(
      (c) => c.source?.isLocalAccount === true
    )?.source ?? { isLocalAccount: true, name: 'Expo', type: 'local', id: '' };
  }

  const calendarId = await Calendar.createCalendarAsync({
    title: 'FinanceControl',
    color: '#1a73e8',
    entityType: Calendar.EntityTypes.EVENT,
    sourceId: defaultCalendarSource?.id,
    source: defaultCalendarSource as Calendar.Source,
    name: 'FinanceControl',
    ownerAccount: 'personal',
    accessLevel: Calendar.CalendarAccessLevel.OWNER,
  });

  return calendarId;
}

export async function createDueDateReminder(transaction: Transaction): Promise<string | null> {
  if (!transaction.dueDate) return null;

  try {
    const calendarId = await getOrCreateAppCalendar();
    const dueDate = parseISO(transaction.dueDate);
    const startDate = new Date(dueDate);
    startDate.setHours(9, 0, 0, 0);
    const endDate = new Date(startDate);
    endDate.setHours(9, 30, 0, 0);

    const amountFormatted = transaction.amount.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    });

    const eventId = await Calendar.createEventAsync(calendarId, {
      title: `⚠️ Vencimento: ${transaction.description}`,
      notes: `Valor: ${amountFormatted}\nCategoria: ${transaction.category}\nContexto: ${
        transaction.context === 'pessoal' ? 'Pessoal' : 'Escritório'
      }`,
      startDate,
      endDate,
      alarms: [{ relativeOffset: -1440 }], // 1 day before (in minutes)
      timeZone: 'America/Sao_Paulo',
    });

    return eventId;
  } catch (error) {
    console.error('Erro ao criar lembrete:', error);
    return null;
  }
}

export async function scheduleAllDueReminders(
  transactions: Transaction[]
): Promise<number> {
  const now = new Date();
  const thirtyDaysLater = addDays(now, 30);

  const pending = transactions.filter((t) => {
    if (t.type !== 'despesa' || t.isPaid || !t.dueDate) return false;
    const due = parseISO(t.dueDate);
    return due >= now && due <= thirtyDaysLater;
  });

  let created = 0;
  for (const t of pending) {
    const id = await createDueDateReminder(t);
    if (id) created++;
  }

  return created;
}

export function buildDueAlertMessage(transaction: Transaction): string {
  const amountFormatted = transaction.amount.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });

  const dueDateFormatted = transaction.dueDate
    ? format(parseISO(transaction.dueDate), 'dd/MM/yyyy', { locale: ptBR })
    : 'Não definido';

  return (
    `⚠️ Lembrete FinanceControl\n` +
    `Conta a vencer: ${transaction.description}\n` +
    `Valor: ${amountFormatted}\n` +
    `Vencimento: ${dueDateFormatted}\n` +
    `Categoria: ${transaction.category}`
  );
}

