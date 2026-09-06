import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator
} from 'react-native';
import { AppIcon } from '../modules/shared/navigation/AppIcon';

interface AiReportSummaryCardProps {
  title: string;
  subtitle?: string;
  summaryText: string;
  isLoading: boolean;
  isAiGenerated?: boolean;
  recordCount?: number;
  badgeColor?: string;
  onRefresh?: () => void;
}

export const AiReportSummaryCard: React.FC<AiReportSummaryCardProps> = ({
  title,
  subtitle,
  summaryText,
  isLoading,
  isAiGenerated = false,
  recordCount,
  badgeColor,
  onRefresh
}) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(true);

  return (
    <View style={styles.cardContainer}>
      {/* Header Banner */}
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <View style={[styles.aiBadge, badgeColor ? { backgroundColor: badgeColor } : undefined]}>
            <AppIcon name="bot" size={16} color="#FFFFFF" />
            <Text style={styles.aiBadgeText}>GEMINI AI</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.titleText}>{title}</Text>
            {subtitle ? <Text style={styles.subtitleText}>{subtitle}</Text> : null}
          </View>
        </View>

        <View style={styles.headerActions}>
          {onRefresh && (
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={onRefresh}
              disabled={isLoading}
              activeOpacity={0.7}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color="#047857" />
              ) : (
                <Text style={styles.actionBtnText}>🔄</Text>
              )}
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={styles.expandToggle}
            onPress={() => setIsExpanded(!isExpanded)}
            activeOpacity={0.7}
          >
            <Text style={styles.expandToggleText}>{isExpanded ? '▲' : '▼'}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Summary Content Body */}
      {isExpanded && (
        <View style={styles.bodyContent}>
          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color="#059669" />
              <Text style={styles.loadingText}>
                മുൻകാല വിവരങ്ങൾ വിശകലനം ചെയ്യുന്നു (Generating AI summary with Gemini)...
              </Text>
            </View>
          ) : (
            <View style={styles.textContainer}>
              <Text style={styles.summaryText}>{summaryText}</Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  cardContainer: {
    backgroundColor: '#F0FDF4',
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#6EE7B7',
    marginBottom: 14,
    overflow: 'hidden',
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2
  },
  headerRow: {
    backgroundColor: '#DCFCE7',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#A7F3D0'
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1
  },
  aiBadge: {
    backgroundColor: '#047857',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12
  },
  aiBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5
  },
  titleText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#064E3B'
  },
  subtitleText: {
    fontSize: 11,
    color: '#047857',
    marginTop: 1
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  actionBtn: {
    padding: 6,
    borderRadius: 6,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#A7F3D0'
  },
  actionBtnText: {
    fontSize: 12
  },
  expandToggle: {
    paddingHorizontal: 6,
    paddingVertical: 4
  },
  expandToggleText: {
    fontSize: 12,
    color: '#047857',
    fontWeight: '700'
  },
  bodyContent: {
    padding: 12,
    backgroundColor: '#FFFFFF'
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10
  },
  loadingText: {
    fontSize: 12,
    color: '#047857',
    fontStyle: 'italic',
    flex: 1
  },
  textContainer: {
    backgroundColor: '#F9FAFB',
    borderRadius: 6,
    padding: 10,
    borderLeftWidth: 3,
    borderLeftColor: '#059669'
  },
  summaryText: {
    fontSize: 12,
    color: '#1F2937',
    lineHeight: 18
  }
});
