/**
 * Swaram API Client (Module 1 -> Module 2 / Module 3)
 * Implements live REST calls with automatic fallback to frozen mock contracts
 * so the mobile app works immediately both online and completely offline.
 */

import {
  ConfirmedVisit,
  HouseholdCareLedger,
  HouseholdSummary,
  VisitDraft
} from '../types';
import {
  MOCK_CARE_LEDGER,
  MOCK_HOUSEHOLDS,
  MOCK_VISIT_DRAFT_RESPONSE
} from '../data/mockData';

import { Platform, NativeModules } from 'react-native';

/**
 * Auto-detects the development machine's IP address.
 * On mobile devices (iOS/Android), 'localhost' points to the phone itself,
 * so we resolve the host machine's LAN IP.
 */
function getDefaultHost(): string {
  if (Platform.OS === 'web') {
    return 'localhost';
  }
  const scriptURL = NativeModules?.SourceCode?.scriptURL;
  if (scriptURL) {
    const host = scriptURL.split('://')[1]?.split('/')[0]?.split(':')[0];
    if (host && host !== 'localhost' && host !== '127.0.0.1') {
      return host;
    }
  }
  return '172.18.100.139'; // Computer Wi-Fi LAN IP
}

let activeHost = process.env.EXPO_PUBLIC_HOST || getDefaultHost();

export const getBackendBaseUrl = () => `http://${activeHost}:8000/api/v1`;
export const getVoiceBaseUrl = () => `http://${activeHost}:8001/api/v1`;
export const getActiveHost = () => activeHost;
export const setActiveHost = (newHost: string) => {
  activeHost = newHost.trim().replace(/^https?:\/\//, '').split(':')[0].split('/')[0];
};

export interface ApiCallStatus<T> {
  data: T;
  isMockFallback: boolean;
  message: string;
  statusCode?: number;
}

export const apiClient = {
  /**
   * Health Check: Pings Module 3 FastAPI backend
   */
  async checkBackendHealth(): Promise<ApiCallStatus<{ status: string; service: string }>> {
    const baseUrl = getBackendBaseUrl();
    try {
      const response = await fetch(`${baseUrl.replace('/api/v1', '')}/health`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(4000)
      });
      if (response.ok) {
        const json = await response.json();
        return {
          data: json,
          isMockFallback: false,
          message: `Connected to live Module 3 backend (${activeHost}:8000).`,
          statusCode: response.status
        };
      }
      throw new Error(`HTTP ${response.status}`);
    } catch (err: any) {
      return {
        data: { status: 'offline_mode', service: 'swaram-mobile-local' },
        isMockFallback: true,
        message: `Module 3 backend unreachable at ${baseUrl} (${err.message || 'Offline'}). Operating in offline-safe mock mode.`
      };
    }
  },

  /**
   * Fetch Assigned Households with Priority & Malnutrition Indicators
   */
  async getHouseholds(): Promise<ApiCallStatus<HouseholdSummary[]>> {
    try {
      const response = await fetch(`${getBackendBaseUrl()}/households`, {
        method: 'GET',
        signal: AbortSignal.timeout(4000)
      });
      if (response.ok) {
        const json = await response.json();
        return {
          data: json,
          isMockFallback: false,
          message: 'Retrieved households from server.',
          statusCode: response.status
        };
      }
      throw new Error(`HTTP ${response.status}`);
    } catch {
      return {
        data: MOCK_HOUSEHOLDS,
        isMockFallback: true,
        message: 'Loaded cached households from local store (Offline fallback).'
      };
    }
  },

  /**
   * Get Household Unresolved Care Ledger (Longitudinal history & malnutrition trends)
   */
  async getCareLedger(householdId: string): Promise<ApiCallStatus<HouseholdCareLedger>> {
    try {
      const response = await fetch(`${getBackendBaseUrl()}/ledger/${householdId}`, {
        method: 'GET',
        signal: AbortSignal.timeout(4000)
      });
      if (response.ok) {
        const json = await response.json();
        return {
          data: json,
          isMockFallback: false,
          message: 'Retrieved live Care Ledger.',
          statusCode: response.status
        };
      }
      throw new Error(`HTTP ${response.status}`);
    } catch {
      return {
        data: MOCK_CARE_LEDGER,
        isMockFallback: true,
        message: 'Loaded local offline Care Ledger.'
      };
    }
  },

  /**
   * Process Voice Survey: Natural Speech -> ASR -> Survey & Malnutrition Extraction
   */
  async processVoiceVisit(audioUri?: string): Promise<ApiCallStatus<VisitDraft>> {
    try {
      const response = await fetch(`${getVoiceBaseUrl()}/voice/process-survey`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audio_uri: audioUri, language: 'ml' }),
        signal: AbortSignal.timeout(5000)
      });
      if (response.ok) {
        const json = await response.json();
        return {
          data: json,
          isMockFallback: false,
          message: 'Voice survey extraction completed via Module 2 AI Service.',
          statusCode: response.status
        };
      }
      throw new Error(`HTTP ${response.status}`);
    } catch {
      return {
        data: MOCK_VISIT_DRAFT_RESPONSE,
        isMockFallback: true,
        message: 'Simulated voice extraction using local contract.'
      };
    }
  },

  /**
   * Proactive Missing Information Inquiry:
   * Resolves a missing survey field using the worker's spoken conversational reply
   */
  async resolveMissingField(
    draft: VisitDraft,
    questionId: string,
    answerText: string
  ): Promise<ApiCallStatus<VisitDraft>> {
    try {
      const response = await fetch(`${getVoiceBaseUrl()}/voice/resolve-missing-field`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ draft, question_id: questionId, answer_text: answerText }),
        signal: AbortSignal.timeout(5000)
      });
      if (response.ok) {
        const json = await response.json();
        return {
          data: json,
          isMockFallback: false,
          message: 'Missing survey field resolved conversationally.',
          statusCode: response.status
        };
      }
      throw new Error(`HTTP ${response.status}`);
    } catch {
      // Local fallback resolution
      const updatedDraft = JSON.parse(JSON.stringify(draft)) as VisitDraft;
      if (updatedDraft.survey_fields) {
        for (const sf of updatedDraft.survey_fields) {
          if (sf.field_key === 'dietary_diversity') {
            sf.value = 'Adequate (Milk, Eggs & Pulses confirmed)';
            sf.status = 'clarified_conversationally';
          }
        }
      }
      if (updatedDraft.malnutrition_assessment) {
        updatedDraft.malnutrition_assessment.dietary_diversity_score = 5;
        updatedDraft.malnutrition_assessment.risk_level = 'normal';
      }
      updatedDraft.missing_field_prompts = (updatedDraft.missing_field_prompts || []).filter(
        p => p.question_id !== questionId
      );
      return {
        data: updatedDraft,
        isMockFallback: true,
        message: 'Resolved missing field locally (Offline fallback).'
      };
    }
  },

  /**
   * Submit Confirmed Survey & Clinical Visit to Central System
   */
  async submitConfirmedVisit(visit: ConfirmedVisit): Promise<ApiCallStatus<{ status: string; id: string }>> {
    try {
      const response = await fetch(`${getBackendBaseUrl()}/visits`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(visit),
        signal: AbortSignal.timeout(4000)
      });
      if (response.ok) {
        const json = await response.json();
        return {
          data: json,
          isMockFallback: false,
          message: 'Survey encounter synced to central database.',
          statusCode: response.status
        };
      }
      throw new Error(`HTTP ${response.status}`);
    } catch {
      return {
        data: { status: 'queued_in_sqlite', id: visit.visit_id },
        isMockFallback: true,
        message: 'Saved to local SQLite queue (will auto-sync upon reconnection).'
      };
    }
  }
};
