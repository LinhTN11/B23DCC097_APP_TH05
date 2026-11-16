import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApps, initializeApp } from 'firebase/app';
import {
  connectAuthEmulator,
  getAuth,
  getReactNativePersistence,
  initializeAuth,
} from 'firebase/auth';
import { connectDatabaseEmulator, getDatabase } from 'firebase/database';
import { cloudConfig, emulatorHost } from './firebaseConfig';

const localProjectId = 'demo-tanso';
const existingApp = getApps().find(candidate => candidate.name === '[DEFAULT]');
const app =
  existingApp ??
  initializeApp(
    cloudConfig ?? {
      apiKey: 'local-demo-key',
      appId: '1:123456789:web:tanso',
      projectId: localProjectId,
      databaseURL: `https://${localProjectId}-default-rtdb.firebaseio.com`,
    },
  );

export const auth = existingApp
  ? getAuth(app)
  : initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage),
    });

export const database = getDatabase(app);
if (!cloudConfig && !existingApp) {
  connectAuthEmulator(auth, `http://${emulatorHost}:9099`, {
    disableWarnings: true,
  });
  connectDatabaseEmulator(database, emulatorHost, 9000);
}
