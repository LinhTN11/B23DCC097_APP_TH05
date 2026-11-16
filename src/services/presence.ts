import {
  onDisconnect,
  onValue,
  push,
  ref,
  remove,
  set,
  type DatabaseReference,
} from 'firebase/database';
import { database } from './firebase';

let activeStop: (() => Promise<void>) | undefined;
let activeTypingRef: DatabaseReference | undefined;

export function subscribeConnection(onData: (connected: boolean) => void) {
  return onValue(ref(database, '.info/connected'), snapshot =>
    onData(snapshot.val() === true),
  );
}

export function setTyping(uid: string, peerId: string, typing: boolean) {
  if (!uid || !peerId || uid === peerId) {
    return;
  }

  const typingRef = ref(database, `presence/${uid}/typing_${peerId}`);
  if (typing) {
    activeTypingRef = typingRef;
    onDisconnect(typingRef)
      .remove()
      .then(() => {
        if (activeTypingRef === typingRef) {
          return set(typingRef, true);
        }
      })
      .catch(() => {
        // Typing state is best-effort.
      });
    return;
  }

  if (activeTypingRef === typingRef) {
    activeTypingRef = undefined;
  }
  onDisconnect(typingRef).cancel().catch(() => {});
  remove(typingRef).catch(() => {});
}

export function subscribeTyping(
  uid: string,
  peerId: string,
  onData: (typing: boolean) => void,
) {
  return onValue(
    ref(database, `presence/${peerId}/typing_${uid}`),
    snapshot => onData(snapshot.val() === true),
    () => onData(false),
  );
}

export function startPresence(uid: string) {
  let active = true;
  let entry: DatabaseReference | undefined;
  let releaseStopOnDisconnect: (() => void) | undefined;

  const stopPrevious = activeStop;
  if (stopPrevious) {
    stopPrevious();
  }

  const unsubscribe = subscribeConnection(connected => {
    if (!connected) {
      entry = undefined;
      releaseStopOnDisconnect?.();
      return;
    }
    if (!active) {
      return;
    }

    const connection = push(ref(database, `presence/${uid}`));
    entry = connection;
    // Register server-side cleanup before publishing presence.
    onDisconnect(connection)
      .remove()
      .then(() => {
        if (active && entry === connection) {
          return set(connection, true);
        }
      })
      .catch(() => {
        // Presence is best-effort. The next connection gets a fresh key.
      });
  });

  let stopping: Promise<void> | undefined;
  function stop(): Promise<void> {
    if (stopping) {
      return stopping;
    }
    active = false;
    stopping = (async () => {
      const typingRef = activeTypingRef;
      activeTypingRef = undefined;
      try {
        if (typingRef) {
          onDisconnect(typingRef).cancel().catch(() => {});
        }
        const removals: Promise<void>[] = [];
        if (entry) {
          removals.push(remove(entry));
        }
        if (typingRef) {
          removals.push(remove(typingRef));
        }
        if (removals.length) {
          await Promise.race([
            Promise.all(removals),
            new Promise<void>(resolve => {
              releaseStopOnDisconnect = resolve;
            }),
          ]);
        }
      } catch {
        // The server's onDisconnect registration remains in place.
      } finally {
        unsubscribe();
      }
    })();
    return stopping;
  }

  activeStop = stop;
  return () => {
    if (activeStop === stop) {
      activeStop = undefined;
    }
    stop();
  };
}

export async function stopPresence() {
  const stop = activeStop;
  activeStop = undefined;
  await stop?.();
}
