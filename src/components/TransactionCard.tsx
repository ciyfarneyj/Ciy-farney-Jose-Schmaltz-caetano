import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Transaction } from '../types';
import { theme } from '../theme';

interface Props {
  transaction: Transaction;
  onDelete?: (id: string) => void;
  onTogglePaid?: (id: string, isPaid: boolean) => void;
}

const CATEGORY_ICONS: Record<string, string> = {
  'Alimentação': 'food',
  'Moradia': 'home',
  'Transporte': 'car',
  'Saúde': 'medical-bag',
  'Lazer': 'gamepad-variant',
  'Educação': 'school',
  'Vestuário': 'tshirt-crew',
  'Serviços': 'wrench',
  'Aluguel': 'office-building',
  'Software/Assinaturas': 'laptop',
  'Material de Escritório': 'pencil',
  'Marketing': 'bullhorn',
  'Impostos': 'file-document',
  'Funcionários': 'account-group',
  'Equipamentos': 'monitor',
  'Outros': 'dots-horizontal',
};

export default function TransactionCard({ transaction, onDelete, onTogglePaid }: Props) {
  const isReceita = transaction.type === 'receita';
  const amountColor = isReceita ? theme.colors.receita : theme.colors.despesa;
  const contextColor = transaction.context === 'pessoal' ? theme.colors.pessoal : theme.colors.escritorio;
  const iconName = CATEGORY_ICONS[transaction.category] ?? 'cash';

  const formattedAmount = transaction.amount.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });

  const formattedDate = format(parseISO(transaction.date), "dd/MM/yyyy", { locale: ptBR });

  return (
    <View style={styles.card}>
      <View style={[styles.iconBox, { backgroundColor: amountColor + '18' }]}>
        <MaterialCommunityIcons name={iconName as any} size={22} color={amountColor} />
      </View>

      <View style={styles.body}>
        <Text style={styles.description} numberOfLines={1}>{transaction.description}</Text>
        <View style={styles.meta}>
          <View style={[styles.badge, { backgroundColor: contextColor + '20' }]}>
            <Text style={[styles.badgeText, { color: contextColor }]}>
              {transaction.context === 'pessoal' ? 'Pessoal' : 'Escritório'}
            </Text>
          </View>
          <Text style={styles.category}>{transaction.category}</Text>
          <Text style={styles.date}>{formattedDate}</Text>
        </View>
        {transaction.type === 'despesa' && (
          <TouchableOpacity
            onPress={() => onTogglePaid?.(transaction.id, !transaction.isPaid)}
            style={styles.paidRow}
          >
            <MaterialCommunityIcons
              name={transaction.isPaid ? 'check-circle' : 'clock-outline'}
              size={14}
              color={transaction.isPaid ? theme.colors.secondary : theme.colors.warning}
            />
            <Text style={[styles.paidText, { color: transaction.isPaid ? theme.colors.secondary : theme.colors.warning }]}>
              {transaction.isPaid ? 'Pago' : 'Pendente'}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.right}>
        <Text style={[styles.amount, { color: amountColor }]}>
          {isReceita ? '+' : '-'}{formattedAmount}
        </Text>
        {onDelete && (
          <TouchableOpacity onPress={() => onDelete(transaction.id)} style={styles.deleteBtn}>
            <MaterialCommunityIcons name="trash-can-outline" size={18} color={theme.colors.danger} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  iconBox: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: theme.spacing.md,
  },
  body: { flex: 1 },
  description: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 4,
  },
  meta: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 4 },
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeText: { fontSize: 10, fontWeight: '600' },
  category: { fontSize: 11, color: theme.colors.textSecondary },
  date: { fontSize: 11, color: theme.colors.textSecondary },
  paidRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 3 },
  paidText: { fontSize: 11, fontWeight: '600' },
  right: { alignItems: 'flex-end', gap: 6 },
  amount: { fontSize: 15, fontWeight: 'bold' },
  deleteBtn: { padding: 4 },
});
