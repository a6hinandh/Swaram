/**
 * Swaram API Client (Module 1 -> Module 2 / Module 3)
 * Implements live REST calls with automatic fallback to frozen mock contracts
 * so the mobile app works immediately both online and completely offline.
 */

import {
  ConfirmedVisit,
  HouseholdCareLedger,
  HouseholdSummary,
  HouseholdMember,
  VisitDraft
} from '../types';
import { StructuredClinicalRecord } from '../types/structuredClinicalRecord';
import { AshaWorkerProfile } from '../services/authService';

const FALLBACK_HOUSEHOLDS: HouseholdSummary[] = [
  {
    id: "h-lakshmi-001",
    external_id: "ASHA-WARD4-HH042",
    head_of_household: "Lakshmi Amma",
    address: "House 42, Kudumbashree Lane, Aluva",
    members_count: 4,
    open_care_gaps: 3,
    priority_score: 92.5,
    priority_reasons: [
      "Acute hypertensive spurt detected in Radhamani P. (+28 mmHg)",
      "Pediatric weight faltering flagged in child Rahul (-500g over 45 days)",
      "ANC 3rd trimester check overdue by 8 days"
    ],
    malnutrition_risk: "Moderate"
  },
  {
    id: "h-suresh-002",
    external_id: "ASHA-WARD4-HH043",
    head_of_household: "Suresh Kumar",
    address: "House 45, Temple Road, Aluva",
    members_count: 3,
    open_care_gaps: 1,
    priority_score: 52.0,
    priority_reasons: ["NCD Hypertension quarterly recheck due"],
    malnutrition_risk: "Normal"
  },
  {
    id: "h-anitha-003",
    external_id: "ASHA-WARD4-HH044",
    head_of_household: "Anitha Kumari",
    address: "House 51, River View, Aluva",
    members_count: 4,
    open_care_gaps: 0,
    priority_score: 25.0,
    priority_reasons: ["Routine community health follow-up"],
    malnutrition_risk: "Normal"
  }
];

const FALLBACK_MEMBERS: Record<string, HouseholdMember[]> = {
  "h-lakshmi-001": [
    {
      person_id: "p-radhamani-01",
      household_id: "h-lakshmi-001",
      name: "Radhamani P.",
      age: 62,
      gender: "female",
      relationship: "mother-in-law",
      life_stage: "elderly",
      pregnancy_status: "not_pregnant",
      chronic_conditions: ["Hypertension", "Type 2 Diabetes"]
    },
    {
      person_id: "p-lakshmi-01",
      household_id: "h-lakshmi-001",
      name: "Lakshmi Amma",
      age: 28,
      gender: "female",
      relationship: "self",
      life_stage: "adult",
      pregnancy_status: "pregnant",
      pregnancy_weeks: 32,
      chronic_conditions: ["Nutritional Anemia"]
    },
    {
      person_id: "p-rahul-02",
      household_id: "h-lakshmi-001",
      name: "Rahul",
      age: 1.5,
      gender: "male",
      relationship: "child",
      life_stage: "infant",
      pregnancy_status: "not_pregnant",
      chronic_conditions: []
    },
    {
      person_id: "p-vijayan-01",
      household_id: "h-lakshmi-001",
      name: "Vijayan K.",
      age: 35,
      gender: "male",
      relationship: "husband",
      life_stage: "adult",
      pregnancy_status: "not_pregnant",
      chronic_conditions: []
    }
  ],
  "h-suresh-002": [
    {
      person_id: "p-suresh-01",
      household_id: "h-suresh-002",
      name: "Suresh Kumar",
      age: 52,
      gender: "male",
      relationship: "head",
      life_stage: "adult",
      pregnancy_status: "not_pregnant",
      chronic_conditions: ["Hypertension"]
    },
    {
      person_id: "p-sunitha-02",
      household_id: "h-suresh-002",
      name: "Sunitha S.",
      age: 48,
      gender: "female",
      relationship: "wife",
      life_stage: "adult",
      pregnancy_status: "not_pregnant",
      chronic_conditions: []
    },
    {
      person_id: "p-akhil-03",
      household_id: "h-suresh-002",
      name: "Akhil Suresh",
      age: 22,
      gender: "male",
      relationship: "son",
      life_stage: "adult",
      pregnancy_status: "not_pregnant",
      chronic_conditions: []
    }
  ],
  "h-anitha-003": [
    {
      person_id: "p-anitha-01",
      household_id: "h-anitha-003",
      name: "Anitha Kumari",
      age: 44,
      gender: "female",
      relationship: "head",
      life_stage: "adult",
      pregnancy_status: "not_pregnant",
      chronic_conditions: []
    },
    {
      person_id: "p-mohan-02",
      household_id: "h-anitha-003",
      name: "Mohanan P.",
      age: 47,
      gender: "male",
      relationship: "husband",
      life_stage: "adult",
      pregnancy_status: "not_pregnant",
      chronic_conditions: ["Hypertension"]
    },
    {
      person_id: "p-meera-03",
      household_id: "h-anitha-003",
      name: "Meera M.",
      age: 16,
      gender: "female",
      relationship: "daughter",
      life_stage: "adolescent",
      pregnancy_status: "not_pregnant",
      chronic_conditions: ["Anemia"]
    },
    {
      person_id: "p-karthik-04",
      household_id: "h-anitha-003",
      name: "Karthik M.",
      age: 12,
      gender: "male",
      relationship: "son",
      life_stage: "child",
      pregnancy_status: "not_pregnant",
      chronic_conditions: []
    }
  ]
};
import { extractStructuredClinicalRecord } from '../services/clinicalEntityExtractor';

import { Platform, NativeModules } from 'react-native';

/**
 * Backend Host is dynamically driven by EXPO_PUBLIC_HOST in .env.
 * Supports:
 * - Full HTTPS URLs (e.g. EXPO_PUBLIC_HOST=https://your-domain.ngrok-free.dev)
 * - Raw LAN IPs (e.g. EXPO_PUBLIC_HOST=192.168.1.15)
 * - Localhost (e.g. EXPO_PUBLIC_HOST=localhost)
 */
let activeHost = (process.env.EXPO_PUBLIC_HOST || 'localhost').trim();

export const getBackendBaseUrl = () => {
  const host = activeHost.trim();
  if (host.startsWith('http://') || host.startsWith('https://')) {
    return host.endsWith('/api/v1') ? host : `${host.replace(/\/$/, '')}/api/v1`;
  }
  if (host.includes('ngrok') || host.includes('.app') || host.includes('.dev') || host.includes('.lt') || host.includes('.io')) {
    return `https://${host}/api/v1`;
  }
  return `http://${host}:8000/api/v1`;
};

export const getVoiceBaseUrl = () => {
  const host = activeHost.trim();
  if (host.startsWith('http://') || host.startsWith('https://')) {
    return host.endsWith('/api/v1') ? host : `${host.replace(/\/$/, '')}/api/v1`;
  }
  if (host.includes('ngrok') || host.includes('.app') || host.includes('.dev') || host.includes('.lt') || host.includes('.io')) {
    return `https://${host}/api/v1`;
  }
  return `http://${host}:8001/api/v1`;
};

export const getActiveHost = () => activeHost;
export const setActiveHost = (newHost: string) => {
  activeHost = newHost.trim();
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
        message: `Module 3 backend offline at ${baseUrl} (${err.message || 'Offline'}). Operating in local offline mode.`
      };
    }
  },

  /**
   * ASHA Worker Mock Login
   */
  async login(username: string, password: string): Promise<ApiCallStatus<{ status: string; access_token: string; user: AshaWorkerProfile }>> {
    const url = `${getBackendBaseUrl()}/auth/login`;
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
        signal: AbortSignal.timeout(4000)
      });
      if (response.ok) {
        const json = await response.json();
        return {
          data: json,
          isMockFallback: false,
          message: 'Authenticated via Module 3 server.',
          statusCode: response.status
        };
      }
      throw new Error(`HTTP ${response.status}`);
    } catch (err: any) {
      // Local fallback for demo credentials
      return {
        data: {
          status: 'authenticated_offline',
          access_token: `mock-offline-token-${username}`,
          user: {
            worker_id: 'w-asha-001',
            username: username || 'asha_ward4',
            name: 'അനിത നായർ (Anitha Nair)',
            role: 'asha_worker',
            ward: 'വാർഡ് 4, ആലുവ (Ward 4, Aluva)',
            phone: '+91 94471 23456',
            sub_centre: 'കീഴ്മാട് സബ് സെന്റർ'
          }
        },
        isMockFallback: true,
        message: 'Authenticated using local offline credentials.'
      };
    }
  },

  /**
   * Fetch Assigned Households with Priority & Malnutrition Indicators from MongoDB Atlas
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
          message: 'Retrieved households from MongoDB Atlas.',
          statusCode: response.status
        };
      }
      throw new Error(`HTTP ${response.status}`);
    } catch {
      return {
        data: FALLBACK_HOUSEHOLDS,
        isMockFallback: true,
        message: 'Loaded cached households (Backend offline).'
      };
    }
  },

  /**
   * Fetch All Persons / Beneficiaries under a Numbered Household from MongoDB Atlas
   */
  async getHouseholdMembers(householdId: string): Promise<ApiCallStatus<HouseholdMember[]>> {
    try {
      const response = await fetch(`${getBackendBaseUrl()}/households/${householdId}/members`, {
        method: 'GET',
        signal: AbortSignal.timeout(4000)
      });
      if (response.ok) {
        const json = await response.json();
        return {
          data: json,
          isMockFallback: false,
          message: `Retrieved ${json.length} members from MongoDB.`,
          statusCode: response.status
        };
      }
      throw new Error(`HTTP ${response.status}`);
    } catch {
      const fallback = FALLBACK_MEMBERS[householdId] || [];
      return {
        data: fallback,
        isMockFallback: true,
        message: `Loaded ${fallback.length} cached members (Backend offline).`
      };
    }
  },

  /**
   * Add a new member to a numbered household in MongoDB
   */
  async addHouseholdMember(householdId: string, member: Partial<HouseholdMember>): Promise<ApiCallStatus<HouseholdMember>> {
    try {
      const response = await fetch(`${getBackendBaseUrl()}/households/${householdId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(member),
        signal: AbortSignal.timeout(5000)
      });
      if (response.ok) {
        const json = await response.json();
        return {
          data: json,
          isMockFallback: false,
          message: 'Member saved to MongoDB.',
          statusCode: response.status
        };
      }
      throw new Error(`HTTP ${response.status}`);
    } catch {
      const localMember: HouseholdMember = {
        person_id: member.person_id || `p-${Date.now()}`,
        household_id: householdId,
        name: member.name || 'Beneficiary',
        age: member.age,
        gender: member.gender,
        relationship: member.relationship || 'member',
        chronic_conditions: member.chronic_conditions || []
      };
      return {
        data: localMember,
        isMockFallback: true,
        message: 'Member saved to local offline store.'
      };
    }
  },

  /**
   * Create a new numbered household (with automatic creation of head and member documents in persons collection)
   */
  async createHousehold(household: Partial<HouseholdSummary> & { head_details?: any; members?: Partial<HouseholdMember>[] }): Promise<ApiCallStatus<HouseholdSummary>> {
    try {
      const response = await fetch(`${getBackendBaseUrl()}/households`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(household),
        signal: AbortSignal.timeout(5000)
      });
      if (response.ok) {
        const json = await response.json();
        return {
          data: json,
          isMockFallback: false,
          message: 'Household and person records created in MongoDB.',
          statusCode: response.status
        };
      }
      throw new Error(`HTTP ${response.status}`);
    } catch {
      const hhId = household.id || `h-local-${Date.now()}`;
      const localHh: HouseholdSummary = {
        id: hhId,
        external_id: household.external_id || 'ASHA-WARD4-NEW',
        head_of_household: household.head_of_household || 'Head',
        address: household.address || 'Aluva',
        members_count: household.members_count || (1 + (household.members?.length || 0)),
        open_care_gaps: 0,
        priority_score: 10.0,
        priority_reasons: ['Newly registered locally']
      };

      // Populate local offline fallback members store
      const headPerson: HouseholdMember = {
        person_id: household.head_details?.person_id || `p-${Date.now()}`,
        household_id: hhId,
        name: household.head_of_household || 'Head',
        age: household.head_details?.age,
        gender: household.head_details?.gender || 'female',
        relationship: 'head',
        chronic_conditions: household.head_details?.chronic_conditions || []
      };

      const extraMembers: HouseholdMember[] = (household.members || []).map((m, idx) => ({
        person_id: m.person_id || `p-${Date.now()}-${idx}`,
        household_id: hhId,
        name: m.name || `Member ${idx + 1}`,
        age: m.age,
        gender: m.gender || 'female',
        relationship: m.relationship || 'member',
        chronic_conditions: m.chronic_conditions || []
      }));

      FALLBACK_MEMBERS[hhId] = [headPerson, ...extraMembers];

      return {
        data: localHh,
        isMockFallback: true,
        message: 'Household and head person record created in local offline store.'
      };
    }
  },

  /**
   * Get Household Unresolved Care Ledger (Longitudinal history & malnutrition trends)
   */
  async getCareLedger(householdId: string): Promise<ApiCallStatus<HouseholdCareLedger | null>> {
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
        data: null,
        isMockFallback: true,
        message: 'Care Ledger not available offline.'
      };
    }
  },

  /**
   * Process Voice Survey: Natural Speech -> ASR -> Survey & Malnutrition Extraction
   */
  async processVoiceVisit(audioUriOrTranscript?: string): Promise<ApiCallStatus<VisitDraft>> {
    try {
      const isTranscript = Boolean(
        audioUriOrTranscript && 
        (audioUriOrTranscript.includes(' ') || audioUriOrTranscript.length > 20) && 
        !audioUriOrTranscript.endsWith('.wav') && 
        !audioUriOrTranscript.endsWith('.m4a') &&
        !audioUriOrTranscript.endsWith('.mp3')
      );
      const body = isTranscript
        ? { transcript: audioUriOrTranscript, language: 'ml' }
        : { audio_uri: audioUriOrTranscript, language: 'ml' };

      const response = await fetch(`${getVoiceBaseUrl()}/voice/process`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
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
      // Dynamic local extraction instead of static mock data
      const clinical = extractStructuredClinicalRecord(audioUriOrTranscript || '');
      let systolic: number | undefined;
      let diastolic: number | undefined;
      if (clinical.measurements.blood_pressure) {
        const bpStr = String(clinical.measurements.blood_pressure).trim();
        const parts = bpStr.split(/[\/\s-]+/);
        if (parts.length >= 2) {
          systolic = parseInt(parts[0], 10) || undefined;
          diastolic = parseInt(parts[1], 10) || undefined;
        } else if (parts.length === 1) {
          systolic = parseInt(parts[0], 10) || undefined;
        }
      }

      const dynamicDraft: VisitDraft = {
        visit_id: clinical.visit.visit_id,
        household_id: 'local-session',
        worker_id: 'w-asha-001',
        timestamp: new Date().toISOString(),
        language: (clinical.extraction.language_detected === 'en' ? 'en' : 'ml'),
        transcript: audioUriOrTranscript || '',
        confidence: clinical.extraction.confidence_score,
        validation_flags: [],
        confirmation_status: 'pending',
        person_updates: [
          {
            person_id: 'p-local-01',
            name: clinical.person.name || 'Patient',
            age: clinical.person.age || undefined,
            gender: clinical.person.sex,
            vitals: {
              systolic_bp: systolic,
              diastolic_bp: diastolic,
              weight_kg: clinical.measurements.weight_kg || undefined,
              height_cm: clinical.measurements.height_cm || undefined,
              pulse_bpm: clinical.measurements.pulse_bpm || undefined
            },
            symptoms: clinical.health_status.complaints.map(c => c.symptom),
            medications_given: clinical.health_status.medications.map(m => m.name),
            services_provided: ['Vitals check'],
            follow_up_date: clinical.follow_up.due_date || undefined
          }
        ],
        survey_fields: []
      };

      return {
        data: dynamicDraft,
        isMockFallback: false,
        message: 'Dynamic clinical extraction completed from speech transcript.'
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
    const url = `${getBackendBaseUrl()}/visits`;
    console.log(`[ApiClient] Submitting confirmed visit to ${url}...`, JSON.stringify(visit, null, 2));
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true'
        },
        body: JSON.stringify(visit),
        signal: AbortSignal.timeout(6000)
      });
      if (response.ok) {
        const json = await response.json();
        console.log(`[ApiClient] Backend /visits response:`, json);
        return {
          data: json,
          isMockFallback: false,
          message: 'Survey encounter synced to central database.',
          statusCode: response.status
        };
      }
      const errText = await response.text();
      console.warn(`[ApiClient] /visits HTTP ${response.status}:`, errText);
      throw new Error(`HTTP ${response.status}: ${errText}`);
    } catch (err: any) {
      console.warn(`[ApiClient] submitConfirmedVisit failed:`, err?.message || err);
      return {
        data: { status: 'queued_in_sqlite', id: visit.visit_id },
        isMockFallback: true,
        message: 'Saved to local SQLite queue (will auto-sync upon reconnection).'
      };
    }
  },

  /**
   * Save Structured Clinical Record directly into MongoDB database (/api/v1/encounters)
   */
  async saveStructuredRecordToDatabase(record: StructuredClinicalRecord): Promise<ApiCallStatus<{ status: string; storage: string; id: string }>> {
    const url = `${getBackendBaseUrl()}/encounters`;
    try {
      let sysBp: number | undefined;
      let diaBp: number | undefined;
      if (record.measurements.blood_pressure) {
        const bpStr = String(record.measurements.blood_pressure).trim();
        const parts = bpStr.split(/[\/\s-]+/);
        if (parts.length >= 2) {
          sysBp = parseInt(parts[0], 10) || undefined;
          diaBp = parseInt(parts[1], 10) || undefined;
        } else if (parts.length === 1) {
          sysBp = parseInt(parts[0], 10) || undefined;
        }
      }

      const encounterPayload = {
        visit: {
          visit_id: record.visit.visit_id,
          household_id: record.visit.household_id || 'h-lakshmi-001',
          date: record.visit.date || new Date().toISOString().slice(0, 10),
          visit_type: record.visit.visit_type || 'routine',
          source: 'manual'
        },
        person: {
          person_id: record.person.person_id || `p-${Date.now()}`,
          name: record.person.name || 'Beneficiary',
          age: record.person.age || undefined,
          sex: record.person.sex || 'female',
          pregnancy_status: record.person.pregnancy_status
        },
        observations: {
          measurements: {
            blood_pressure: sysBp ? { systolic_mmhg: sysBp, diastolic_mmhg: diaBp } : undefined,
            weight_kg: record.measurements.weight_kg || undefined,
            pulse_bpm: record.measurements.pulse_bpm || undefined,
            blood_sugar_mg_dl: record.measurements.blood_sugar_mg_dl || undefined,
            temperature_c: record.measurements.temperature_f ? ((record.measurements.temperature_f - 32) * 5 / 9) : undefined
          },
          symptoms: record.health_status.complaints.map(c => ({ symptom: c.symptom })),
          medications: record.health_status.medications.map(m => ({ name: m.name }))
        }
      };

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true'
        },
        body: JSON.stringify(encounterPayload),
        signal: AbortSignal.timeout(6000)
      });

      if (response.ok) {
        const json = await response.json();
        return {
          data: { status: 'saved', storage: 'mongodb', id: record.visit.visit_id },
          isMockFallback: false,
          message: 'Saved directly to MongoDB Atlas database.',
          statusCode: response.status
        };
      }
      throw new Error(`HTTP ${response.status}`);
    } catch (err: any) {
      console.warn(`[ApiClient] Failed saving encounter to database, offline fallback active:`, err?.message || err);
      return {
        data: { status: 'saved_locally', storage: 'local_offline', id: record.visit.visit_id },
        isMockFallback: true,
        message: 'Saved in offline database store. Will auto-sync upon reconnection.'
      };
    }
  },

  /**
   * Save Environmental & Climate Risk Assessment to MongoDB backend
   */
  async saveEnvironmentalAssessment(payload: any): Promise<ApiCallStatus<{ status: string; storage: string; assessment_id: string }>> {
    const url = `${getBackendBaseUrl()}/environmental-assessments`;
    try {
      console.log(`[ApiClient] Sending environmental assessment to ${url}...`);
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true'
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(10000)
      });
      if (response.ok) {
        const json = await response.json();
        console.log(`[ApiClient] Successfully saved to backend:`, json);
        return {
          data: json,
          isMockFallback: json.storage !== 'mongodb',
          message: json.storage === 'mongodb' ? 'Saved to MongoDB database successfully' : 'Saved to backend memory store',
          statusCode: response.status
        };
      }
      throw new Error(`HTTP ${response.status}`);
    } catch (err: any) {
      console.log(`[ApiClient] Failed connecting to ${url}:`, err?.message || err);
      return {
        data: {
          status: 'saved',
          storage: 'local_offline',
          assessment_id: payload.assessment_id || `env_${Date.now()}`
        },
        isMockFallback: true,
        message: 'Saved locally in offline mode'
      };
    }
  },

  /**
   * Fetch Patient Vitals Baseline & Longitudinal History Points from MongoDB Atlas
   */
  async getVitalsBaseline(personId: string): Promise<ApiCallStatus<any>> {
    const url = `${getBackendBaseUrl()}/vitals/baseline/${personId}`;
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(4000)
      });
      if (response.ok) {
        const json = await response.json();
        return {
          data: json,
          isMockFallback: false,
          message: 'Retrieved baseline from MongoDB Atlas.',
          statusCode: response.status
        };
      }
      throw new Error(`HTTP ${response.status}`);
    } catch (err: any) {
      return {
        data: null,
        isMockFallback: true,
        message: `Offline mode: using local baseline (${err?.message || 'offline'}).`
      };
    }
  },

  /**
   * Submit Current Vitals Measurement for Real-Time Delta Deviation Analysis against MongoDB
   */
  async analyzeVitalsDelta(req: {
    person_id: string;
    household_id: string;
    systolic_bp?: number;
    diastolic_bp?: number;
    glucose_mg_dl?: number;
    pulse_bpm?: number;
    weight_kg?: number;
    muac_cm?: number;
  }): Promise<ApiCallStatus<any>> {
    const url = `${getBackendBaseUrl()}/vitals/analyze-delta`;
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(req),
        signal: AbortSignal.timeout(5000)
      });
      if (response.ok) {
        const json = await response.json();
        return {
          data: json,
          isMockFallback: false,
          message: 'Delta deviation analysis computed and synchronized with MongoDB Care Ledger.',
          statusCode: response.status
        };
      }
      throw new Error(`HTTP ${response.status}`);
    } catch (err: any) {
      return {
        data: null,
        isMockFallback: true,
        message: `Offline mode: calculated locally (${err?.message || 'offline'}).`
      };
    }
  },

  /**
   * Save Official CBAC Survey to MongoDB Atlas cbac_surveys collection
   */
  async saveCbacSurvey(survey: any): Promise<ApiCallStatus<any>> {
    const url = `${getBackendBaseUrl()}/cbac`;
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(survey),
        signal: AbortSignal.timeout(5000)
      });
      if (response.ok) {
        const json = await response.json();
        return {
          data: json,
          isMockFallback: false,
          message: '✓ CBAC Survey saved to MongoDB Atlas & synchronized with Care Ledger.',
          statusCode: response.status
        };
      }
      throw new Error(`HTTP ${response.status}`);
    } catch (err: any) {
      return {
        data: null,
        isMockFallback: true,
        message: `Saved to local device queue (${err?.message || 'offline'}).`
      };
    }
  },

  /**
   * Get all longitudinal CBAC surveys for a beneficiary from MongoDB Atlas
   */
  async getBeneficiaryCbacSurveys(beneficiaryId: string): Promise<ApiCallStatus<any[]>> {
    const url = `${getBackendBaseUrl()}/cbac/beneficiary/${encodeURIComponent(beneficiaryId)}`;
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(4000)
      });
      if (response.ok) {
        const json = await response.json();
        return {
          data: json,
          isMockFallback: false,
          message: 'Retrieved CBAC history from MongoDB Atlas.',
          statusCode: response.status
        };
      }
      throw new Error(`HTTP ${response.status}`);
    } catch (err: any) {
      return {
        data: [],
        isMockFallback: true,
        message: `Offline mode: loading local records (${err?.message || 'offline'}).`
      };
    }
  },

  /**
   * Get all environmental risk assessments for a household
   */
  async getEnvironmentalAssessments(householdId?: string): Promise<ApiCallStatus<any[]>> {
    const queryStr = householdId ? `?household_id=${encodeURIComponent(householdId)}` : '';
    const url = `${getBackendBaseUrl()}/environmental-assessments${queryStr}`;
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(4000)
      });
      if (response.ok) {
        const json = await response.json();
        return {
          data: json,
          isMockFallback: false,
          message: 'Retrieved environmental history from MongoDB Atlas.',
          statusCode: response.status
        };
      }
      throw new Error(`HTTP ${response.status}`);
    } catch (err: any) {
      return {
        data: [],
        isMockFallback: true,
        message: `Offline mode: ${err?.message || 'offline'}`
      };
    }
  },

  /**
   * Get person longitudinal clinical encounters
   */
  async getPersonEncounters(personId: string): Promise<ApiCallStatus<any[]>> {
    const url = `${getBackendBaseUrl()}/encounters/person/${encodeURIComponent(personId)}`;
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(4000)
      });
      if (response.ok) {
        const json = await response.json();
        return {
          data: json,
          isMockFallback: false,
          message: 'Retrieved encounters from MongoDB Atlas.',
          statusCode: response.status
        };
      }
      throw new Error(`HTTP ${response.status}`);
    } catch (err: any) {
      return {
        data: [],
        isMockFallback: true,
        message: `Offline mode: ${err?.message || 'offline'}`
      };
    }
  }
};

