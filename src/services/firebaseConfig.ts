import type { FirebaseOptions } from 'firebase/app';

const appth05: FirebaseOptions = {
  apiKey: 'AIzaSyBWmctoMDr6gIEK5vTMfsNvCk3XYLbGAXk',
  authDomain: 'appth05.firebaseapp.com',
  projectId: 'appth05',
  databaseURL:
    'https://appth05-default-rtdb.asia-southeast1.firebasedatabase.app',
  appId: '1:781871290856:web:32eddd16267fe82a3f6c5d',
};

// Web client config is public. Database access is enforced by Firebase Auth and Rules.
const useEmulator = false;
export const cloudConfig = useEmulator ? undefined : appth05;
export const emulatorHost = '127.0.0.1';
