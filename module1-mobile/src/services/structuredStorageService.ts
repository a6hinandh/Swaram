/**
 * Swaram - Structured Storage Service
 * Persists structured clinical JSON records offline on the device using expo-file-system.
 * Provides offline-first querying, retrieval, and full JSON export.
 */

import { StructuredClinicalRecord } from '../types/structuredClinicalRecord';

// Dynamic safe load of expo-file-system for Expo Go / React Native
let FileSystem: any = null;
try {
  FileSystem = require('expo-file-system/legacy');
} catch (e1) {
  try {
    FileSystem = require('expo-file-system');
  } catch (e2) {
    // In-memory fallback
  }
}

// In-memory cache for fast querying and safe fallback in web/tests
const inMemoryRecords: Map<string, StructuredClinicalRecord> = new Map();

function getStorageDirectory(): string | null {
  if (FileSystem && FileSystem.documentDirectory) {
    return `${FileSystem.documentDirectory}clinical_records/`;
  }
  return null;
}

async function ensureStorageDirectory(): Promise<string | null> {
  const dir = getStorageDirectory();
  if (!dir) return null;

  try {
    const dirInfo = await FileSystem.getInfoAsync(dir);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
    }
    return dir;
  } catch (err) {
    console.warn('[StructuredStorage] Failed to create directory:', err);
    return null;
  }
}

/**
 * Save a structured clinical record offline
 */
export async function saveStructuredRecord(record: StructuredClinicalRecord): Promise<{ success: boolean; path?: string }> {
  try {
    // Always keep memory copy
    inMemoryRecords.set(record.visit.visit_id, record);

    const dir = await ensureStorageDirectory();
    if (!dir) {
      return { success: true, path: `memory://${record.visit.visit_id}` };
    }

    const filePath = `${dir}${record.visit.visit_id}.json`;
    const jsonStr = JSON.stringify(record, null, 2);
    await FileSystem.writeAsStringAsync(filePath, jsonStr);
    console.log(`[StructuredStorage] Successfully saved record to ${filePath}`);
    return { success: true, path: filePath };
  } catch (err) {
    console.error('[StructuredStorage] Error saving record:', err);
    // In-memory fallback remains intact
    inMemoryRecords.set(record.visit.visit_id, record);
    return { success: true, path: `memory://${record.visit.visit_id}` };
  }
}

/**
 * Retrieve all stored clinical records (sorted newest first)
 */
export async function getAllStructuredRecords(): Promise<StructuredClinicalRecord[]> {
  try {
    const dir = await ensureStorageDirectory();
    if (!dir) {
      return Array.from(inMemoryRecords.values()).reverse();
    }

    const files = await FileSystem.readDirectoryAsync(dir);
    const jsonFiles = files.filter((f: string) => f.endsWith('.json'));

    const records: StructuredClinicalRecord[] = [];
    for (const fileName of jsonFiles) {
      try {
        const fileUri = `${dir}${fileName}`;
        const content = await FileSystem.readAsStringAsync(fileUri);
        const parsed: StructuredClinicalRecord = JSON.parse(content);
        records.push(parsed);
        // Sync memory cache
        inMemoryRecords.set(parsed.visit.visit_id, parsed);
      } catch (e) {
        console.warn(`[StructuredStorage] Failed to read ${fileName}:`, e);
      }
    }

    // Merge any memory-only records
    for (const [id, rec] of inMemoryRecords.entries()) {
      if (!records.some((r) => r.visit.visit_id === id)) {
        records.push(rec);
      }
    }

    // Sort by timestamp descending
    records.sort((a, b) => {
      const timeA = new Date(a.extraction.extraction_timestamp || a.visit.date).getTime();
      const timeB = new Date(b.extraction.extraction_timestamp || b.visit.date).getTime();
      return timeB - timeA;
    });

    return records;
  } catch (err) {
    console.warn('[StructuredStorage] Failed to list records from FS, returning in-memory:', err);
    return Array.from(inMemoryRecords.values()).reverse();
  }
}

/**
 * Retrieve a single record by visit_id
 */
export async function getStructuredRecordById(visitId: string): Promise<StructuredClinicalRecord | null> {
  if (inMemoryRecords.has(visitId)) {
    return inMemoryRecords.get(visitId)!;
  }

  const dir = await ensureStorageDirectory();
  if (!dir) return null;

  try {
    const filePath = `${dir}${visitId}.json`;
    const info = await FileSystem.getInfoAsync(filePath);
    if (!info.exists) return null;

    const content = await FileSystem.readAsStringAsync(filePath);
    const parsed: StructuredClinicalRecord = JSON.parse(content);
    inMemoryRecords.set(visitId, parsed);
    return parsed;
  } catch (err) {
    console.warn(`[StructuredStorage] Error reading record ${visitId}:`, err);
    return null;
  }
}

/**
 * Delete a structured record by visit_id
 */
export async function deleteStructuredRecord(visitId: string): Promise<boolean> {
  inMemoryRecords.delete(visitId);

  const dir = await ensureStorageDirectory();
  if (!dir) return true;

  try {
    const filePath = `${dir}${visitId}.json`;
    const info = await FileSystem.getInfoAsync(filePath);
    if (info.exists) {
      await FileSystem.deleteAsync(filePath, { idempotent: true });
    }
    return true;
  } catch (err) {
    console.warn(`[StructuredStorage] Error deleting record ${visitId}:`, err);
    return false;
  }
}

/**
 * Format a single clinical record into a human-readable structured clinical report
 */
export function formatStructuredRecordToReport(record: StructuredClinicalRecord): string {
  const complaints = record.health_status.complaints.length > 0
    ? record.health_status.complaints.map(c => `  • ${c.symptom} (${c.duration}, ${c.severity})`).join('\n')
    : '  • പ്രത്യേക രോഗലക്ഷണങ്ങൾ ഇല്ല (No acute complaints)';

  const meds = record.health_status.medications.length > 0
    ? record.health_status.medications.map(m => `  • ${m.name} (Adherence: ${m.adherence}, Taking: ${m.taking})`).join('\n')
    : '  • മരുന്നുകൾ ഇല്ല (No current medications)';

  const gaps = record.care_gaps.length > 0
    ? record.care_gaps.map(g => `  • [${g.severity.toUpperCase()}] ${g.gap_type}: ${g.description}`).join('\n')
    : '  • പ്രത്യേക ശ്രദ്ധ ആവശ്യമുള്ള പ്രശ്നങ്ങൾ ഇല്ല';

  return `=======================================================
സ്വരം ക്ലിനിക്കൽ റിപ്പോർട്ട് (SWARAM CLINICAL REPORT)
വിസിറ്റ് തീയതി: ${record.visit.date} | ID: ${record.visit.visit_id}
=======================================================

1. വ്യക്തിഗത വിവരങ്ങൾ (PERSON & BENEFICIARY DETAILS)
  • പേര് (Name): ${record.person.name || 'രേഖപ്പെടുത്തിയിട്ടില്ല'}
  • പ്രായം (Age): ${record.person.age !== null ? `${record.person.age} വയസ്സ്` : 'N/A'}
  • ലിംഗം (Sex): ${record.person.sex.toUpperCase()}
  • ഘട്ടം (Life Stage): ${record.person.life_stage.toUpperCase()}
  • ഗർഭാവസ്ഥ (Pregnancy Status): ${record.person.pregnancy_status.toUpperCase()}

2. പരിശോധനാ ഫലങ്ങൾ (MEASUREMENTS & VITALS)
  • രക്തസമ്മർദ്ദം (Blood Pressure): ${record.measurements.blood_pressure || '--'} mmHg
  • ശരീരഭാരം (Weight): ${record.measurements.weight_kg !== null ? `${record.measurements.weight_kg} kg` : '--'}
  • ഉയരം (Height): ${record.measurements.height_cm !== null ? `${record.measurements.height_cm} cm` : '--'}
  • പൾസ് (Pulse): ${record.measurements.pulse_bpm !== null ? `${record.measurements.pulse_bpm} bpm` : '--'}
  • രക്തത്തിലെ പഞ്ചസാര (Sugar): ${record.measurements.blood_sugar_mg_dl !== null ? `${record.measurements.blood_sugar_mg_dl} mg/dL` : '--'}
  • പനി (Temperature): ${record.measurements.temperature_f !== null ? `${record.measurements.temperature_f} °F` : '--'}
  ${record.measurements.spo2_percent !== null ? `• ഓക്സിജൻ (SpO2): ${record.measurements.spo2_percent} %\n` : ''}
3. ലക്ഷണങ്ങൾ (HEALTH COMPLAINTS & SYMPTOMS)
${complaints}

4. നൽകിയ മരുന്നുകൾ (MEDICATIONS GIVEN)
${meds}

5. ശ്രദ്ധിക്കേണ്ട കാര്യങ്ങൾ (CARE GAPS)
${gaps}

6. തുടർപരിശോധന & നിർദ്ദേശങ്ങൾ (FOLLOW-UP & REFERRAL)
  • ആവശ്യകത: ${record.follow_up.required.toUpperCase()}
  • തീയതി (Due Date): ${record.follow_up.due_date || 'N/A'}
  • ചുമതലപ്പെടുത്തിയത്: ${record.follow_up.assigned_to.toUpperCase()}
  • കാരണം: ${record.follow_up.reason || 'Routine follow-up'}
=======================================================`;
}

/**
 * Export all stored records as human-readable structured reports (No raw JSON)
 */
export async function exportAllRecordsFormattedText(): Promise<string> {
  const records = await getAllStructuredRecords();
  if (records.length === 0) {
    return 'ഇതുവരെ രേഖകൾ ഒന്നും ലഭ്യമല്ല (No clinical records saved).';
  }

  const header = `=======================================================\n` +
    `സ്വരം ആശാ ഫീൽഡ് സർവേ - ക്ലിനിക്കൽ രേഖകളുടെ റിപ്പോർട്ട്\n` +
    `ആകെ രേഖകൾ (Total Records): ${records.length}\n` +
    `തയ്യാറാക്കിയ തീയതി: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}\n` +
    `=======================================================\n\n`;

  const body = records.map(r => formatStructuredRecordToReport(r)).join('\n\n\n');
  return header + body;
}

/**
 * Legacy JSON export for backwards compatibility
 */
export async function exportAllRecordsJson(): Promise<string> {
  const records = await getAllStructuredRecords();
  return JSON.stringify(records, null, 2);
}

