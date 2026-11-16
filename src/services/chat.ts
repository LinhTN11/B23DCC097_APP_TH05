import {
  endAt,
  endBefore,
  get,
  limitToLast,
  onValue,
  orderByChild,
  orderByValue,
  push,
  query,
  ref,
  serverTimestamp,
  update,
  type DataSnapshot,
} from 'firebase/database';
import { database } from './firebase';

export {
  setTyping,
  startPresence,
  subscribeConnection,
  subscribeTyping,
} from './presence';

export const MESSAGE_PAGE_SIZE = 50;
export const MAX_MESSAGE_LENGTH = 4000;

export interface Profile {
  id: string;
  name: string;
  online: boolean;
  typing?: boolean;
}

export interface Location {
  latitude: number;
  longitude: number;
}

export interface Message {
  id: string;
  senderId: string;
  createdAt: number;
  kind: 'text' | 'location';
  text?: string;
  latitude?: number;
  longitude?: number;
}

export interface Conversation {
  peerId: string;
  lastMessage: Message;
  unread: number;
}

export type MessagePayload =
  | { kind: 'text'; text: string }
  | ({ kind: 'location' } & Location);

type ListenerError = (error: Error) => void;
type ProfileRecords = Record<string, { name: string }>;
type UnreadRecords = Record<string, Record<string, number>>;

function messagesPath(uid: string, peerId: string) {
  const [lower, higher] = [uid, peerId].sort();
  return `chats/${lower}/${higher}/messages`;
}

export function subscribeDirectory(
  uid: string,
  onData: (profiles: Profile[]) => void,
  onError: ListenerError,
) {
  let profiles: ProfileRecords | undefined;
  let presence: Record<string, Record<string, boolean>> | undefined;

  const emit = () => {
    if (!profiles || !presence) {
      return;
    }

    const online = presence;
    const typingKey = `typing_${uid}`;
    const directory = Object.entries(profiles)
      .filter(([id]) => id !== uid)
      .map(([id, { name }]) => ({
        id,
        name,
        online:
          Object.keys(online[id] ?? {}).some(key => !key.startsWith('typing_')) ||
          id in online,
        typing: Boolean(online[id]?.[typingKey]),
      }));
    directory.sort((first, second) =>
      first.name.localeCompare(second.name, 'vi'),
    );
    onData(directory);
  };

  const stopProfiles = onValue(
    ref(database, 'profiles'),
    snapshot => {
      profiles = snapshot.val() ?? {};
      emit();
    },
    onError,
  );

  const stopPresence = onValue(
    ref(database, 'presence'),
    snapshot => {
      presence = snapshot.val() ?? {};
      emit();
    },
    onError,
  );

  return () => {
    stopProfiles();
    stopPresence();
  };
}

export function subscribeConversations(
  uid: string,
  onData: (conversations: Conversation[]) => void,
  onError: ListenerError,
) {
  let inbox: Record<string, Message> | undefined;
  let unread: UnreadRecords | undefined;

  const emit = () => {
    if (!inbox || !unread) {
      return;
    }
    const markers = unread;
    const conversations = Object.entries(inbox).map(
      ([peerId, lastMessage]) => ({
        peerId,
        lastMessage,
        unread: Object.keys(markers[peerId] ?? {}).length,
      }),
    );
    conversations.sort(
      (first, second) =>
        second.lastMessage.createdAt - first.lastMessage.createdAt ||
        first.peerId.localeCompare(second.peerId),
    );
    onData(conversations);
  };

  const stopInbox = onValue(
    ref(database, `inbox/${uid}`),
    snapshot => {
      inbox = snapshot.val() ?? {};
      emit();
    },
    onError,
  );

  const stopUnread = onValue(
    ref(database, `unread/${uid}`),
    snapshot => {
      unread = snapshot.val() ?? {};
      emit();
    },
    onError,
  );

  return () => {
    stopInbox();
    stopUnread();
  };
}

function readMessages(snapshot: DataSnapshot) {
  const messages: Message[] = [];
  snapshot.forEach(child => {
    messages.push({ ...child.val(), id: child.key });
  });
  return messages.reverse();
}

export function subscribeMessages(
  uid: string,
  peerId: string,
  onData: (messages: Message[]) => void,
  onError: ListenerError,
) {
  return onValue(
    query(
      ref(database, messagesPath(uid, peerId)),
      orderByChild('createdAt'),
      limitToLast(MESSAGE_PAGE_SIZE),
    ),
    snapshot => onData(readMessages(snapshot)),
    onError,
  );
}

export async function loadOlderMessages(
  uid: string,
  peerId: string,
  oldest: Message,
) {
  const page = query(
    ref(database, messagesPath(uid, peerId)),
    orderByChild('createdAt'),
    endBefore(oldest.createdAt, oldest.id),
    limitToLast(MESSAGE_PAGE_SIZE),
  );
  return readMessages(await get(page));
}

export async function sendMessage(
  uid: string,
  peerId: string,
  payload: MessagePayload,
) {
  if (uid === peerId) {
    throw new Error('Không thể gửi tin nhắn cho chính mình.');
  }

  let message: MessagePayload;
  if (payload.kind === 'text') {
    const text = payload.text.trim();
    if (!text || text.length > MAX_MESSAGE_LENGTH) {
      throw new Error('Nội dung tin nhắn không hợp lệ.');
    }
    message = { kind: 'text', text };
  } else {
    const { latitude, longitude } = payload;
    if (
      !Number.isFinite(latitude) ||
      latitude < -90 ||
      latitude > 90 ||
      !Number.isFinite(longitude) ||
      longitude < -180 ||
      longitude > 180
    ) {
      throw new Error('Tọa độ không hợp lệ.');
    }
    message = { kind: 'location', latitude, longitude };
  }

  const basePath = messagesPath(uid, peerId);
  const id = push(ref(database, basePath)).key!;
  const entry = { ...message, senderId: uid, createdAt: serverTimestamp() };
  const summary = { ...entry, id };

  await update(ref(database), {
    [`${basePath}/${id}`]: entry,
    [`inbox/${uid}/${peerId}`]: summary,
    [`inbox/${peerId}/${uid}`]: summary,
    [`unread/${peerId}/${uid}/${id}`]: entry.createdAt,
  });
}

export async function markRead(uid: string, peerId: string, seen: string[]) {
  if (!seen.length) {
    return;
  }

  await update(
    ref(database, `unread/${uid}/${peerId}`),
    Object.fromEntries(seen.map(id => [id, null])),
  );
}

export async function markThreadRead(
  uid: string,
  peerId: string,
  newest: Message,
) {
  const backlog = await get(
    query(
      ref(database, `unread/${uid}/${peerId}`),
      orderByValue(),
      endAt(newest.createdAt, newest.id),
    ),
  );
  const seen: string[] = [];
  backlog.forEach(marker => {
    if (marker.key) {
      seen.push(marker.key);
    }
  });
  await markRead(uid, peerId, seen);
}
