import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Insight } from '../types';
import { theme } from '../theme';

interface Props {
  insight: Insight;
}

const SEVERITY_CONFIG = {
  info: { bg: '#e8f4fd', border: '#1a73e8', icon: 'information', color: '#1a73e8' },
  warning: { bg: '#fff8e1', border: '#fbbc04', icon: 'alert', color: '#f57c00' },
  danger: { bg: '#fde8e8', border: '#ea4335', icon: 'alert-circle', color: '#ea4335' },
};

const TYPE_ICONS: Record<string, string> = {
  duplicate: 'content-duplicate',
  excessive: 'trending-up',
  savings_tip: 'piggy-bank',
  economy_plan: 'lightbulb-on',
};

export default function InsightCard({ insight }: Props) {
  const config = SEVERITY_CONFIG[insight.severity];
  const typeIcon = TYPE_ICONS[insight.type] ?? 'information';

  return (
    <View style={[styles.card, { backgroundColor: config.bg, borderLeftColor: config.border }]}>
      <View style={styles.header}>
        <MaterialCommunityIcons name={typeIcon as any} size={20} color={config.color} />
        <Text style={[styles.title, { color: config.color }]}>{insight.title}</Text>
        <MaterialCommunityIcons name={config.icon as any} size={16} color={config.color} style={styles.severityIcon} />
      </View>
      <Text style={styles.description}>{insight.description}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
    gap: theme.spacing.sm,
  },
  title: {
    fontSize: 15,
    fontWeight: 'bold',
    flex: 1,
  },
  severityIcon: { marginLeft: 'auto' },
  description: {
    fontSize: 13,
    color: theme.colors.text,
    lineHeight: 20,
  },
});
