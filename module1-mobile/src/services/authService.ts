/**
 * Swaram - ASHA Worker Authentication Service
 * Manages active frontline session, demo credentials, and offline persistence.
 */

export interface AshaWorkerProfile {
  worker_id: string;
  username: string;
  name: string;
  role: string;
  ward: string;
  phone?: string;
  sub_centre?: string;
}

export interface AuthSession {
  isLoggedIn: boolean;
  token?: string;
  user?: AshaWorkerProfile;
}

export const DEMO_CREDENTIALS = {
  username: 'asha_ward4',
  password: 'swaram2026',
  displayName: 'അനിത നായർ (Anitha Nair)',
  role: 'ആശാ പ്രവർത്തക (ASHA Worker)',
  ward: 'വാർഡ് 4, ആലുവ (Ward 4, Aluva)',
  subCentre: 'കീഴ്മാട് സബ് സെന്റർ (Keezhmad SC)'
};

const DEFAULT_ASHA_PROFILE: AshaWorkerProfile = {
  worker_id: 'w-asha-001',
  username: 'asha_ward4',
  name: 'അനിത നായർ (Anitha Nair)',
  role: 'asha_worker',
  ward: 'വാർഡ് 4, ആലുവ (Ward 4, Aluva)',
  phone: '+91 94471 23456',
  sub_centre: 'കീഴ്മാട് സബ് സെന്റർ'
};

let FileSystem: any = null;
try {
  FileSystem = require('expo-file-system/legacy');
} catch {
  try {
    FileSystem = require('expo-file-system');
  } catch {
    // In-memory fallback
  }
}

// In-memory session state
let currentSession: AuthSession = {
  isLoggedIn: false,
  user: undefined
};

function getSessionFilePath(): string | null {
  if (FileSystem && FileSystem.documentDirectory) {
    return `${FileSystem.documentDirectory}swaram_auth_session.json`;
  }
  return null;
}

export async function loadSavedSession(): Promise<AuthSession> {
  const path = getSessionFilePath();
  if (path) {
    try {
      const info = await FileSystem.getInfoAsync(path);
      if (info.exists) {
        const content = await FileSystem.readAsStringAsync(path);
        const parsed = JSON.parse(content);
        if (parsed && parsed.isLoggedIn) {
          currentSession = parsed;
          return currentSession;
        }
      }
    } catch (err) {
      console.warn('[AuthService] Could not read stored session:', err);
    }
  }
  return currentSession;
}

export async function saveSession(session: AuthSession): Promise<void> {
  currentSession = session;
  const path = getSessionFilePath();
  if (path) {
    try {
      await FileSystem.writeAsStringAsync(path, JSON.stringify(session, null, 2));
    } catch (err) {
      console.warn('[AuthService] Could not persist session:', err);
    }
  }
}

export async function clearSession(): Promise<void> {
  currentSession = { isLoggedIn: false, user: undefined };
  const path = getSessionFilePath();
  if (path) {
    try {
      const info = await FileSystem.getInfoAsync(path);
      if (info.exists) {
        await FileSystem.deleteAsync(path, { idempotent: true });
      }
    } catch (err) {
      console.warn('[AuthService] Could not clear stored session:', err);
    }
  }
}

export function getCurrentSession(): AuthSession {
  return currentSession;
}

export function createDemoSession(): AuthSession {
  return {
    isLoggedIn: true,
    token: 'swaram-demo-token-ward4-2026',
    user: DEFAULT_ASHA_PROFILE
  };
}
