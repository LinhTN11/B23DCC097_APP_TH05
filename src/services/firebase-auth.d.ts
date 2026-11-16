import type {Persistence} from 'firebase/auth';

// Metro selects Firebase Auth's React Native entry point. The SDK's shared
// TypeScript declaration omits the persistence helper from that entry point.
declare module 'firebase/auth' {
  export function getReactNativePersistence(storage: {
    getItem(key: string): Promise<string | null>;
    setItem(key: string, value: string): Promise<void>;
    removeItem(key: string): Promise<void>;
  }): Persistence;
}
