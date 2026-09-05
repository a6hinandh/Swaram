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
 * Export all stored records as a single formatted JSON string
 */
export async function exportAllRecordsJson(): Promise<string> {
  const records = await getAllStructuredRecords();
  return JSON.stringify(records, null, 2);
}
