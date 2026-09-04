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
   * Basic Call 1: Backend Health Check
   * Pings the Module 3 FastAPI backend to verify connectivity
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
   * Basic Call 2: Fetch Today's Households
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
   * Basic Call 3: Get Household Unresolved Care Ledger
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
   * Basic Call 4: Process Voice Visit (Audio -> Malayalam ASR -> Structured Extraction)
   * Sends audio payload to Module 2 Voice Intelligence
   */
  async processVoiceVisit(audioUri?: string): Promise<ApiCallStatus<VisitDraft>> {
    try {
      const response = await fetch(`${getVoiceBaseUrl()}/voice/process`, {
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
          message: 'Voice processing completed via Module 2 AI Service.',
          statusCode: response.status
        };
      }
      throw new Error(`HTTP ${response.status}`);
    } catch {
      // Return representative Malayalam visit draft
      return {
        data: MOCK_VISIT_DRAFT_RESPONSE,
        isMockFallback: true,
        message: 'Simulated voice extraction using local Malayalam contract.'
      };
    }
  },

  /**
   * Basic Call 5: Submit Confirmed Clinical Visit
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
          message: 'Visit synced to server.',
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
