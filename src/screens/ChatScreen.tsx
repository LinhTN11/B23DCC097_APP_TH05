import {useIsFocused} from '@react-navigation/native';
import {Activity, ArrowLeft, MapPin, Send} from 'lucide-react-native';
import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  ActivityIndicator,
  AppState,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  type ListRenderItem,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {getCurrentLocation, openLocation} from '../device/location';
import {
  loadOlderMessages,
  markRead,
  markThreadRead,
  MAX_MESSAGE_LENGTH,
  MESSAGE_PAGE_SIZE,
  sendMessage,
  setTyping,
  subscribeConnection,
  subscribeMessages,
  subscribeTyping,
  type Message,
  type MessagePayload,
  type Profile,
} from '../services/chat';
import {
  Avatar,
  formatChatMilestone,
  IconButton,
  StatusMessage,
} from '../ui/components';
import {colors, fonts, radius, space, type} from '../ui/theme';
import {MessageBubble, TypingBubble} from './ChatMessage';

type Props = {
  uid: string;
  peer: Profile;
  onBack: () => void;
};

type MessageWindow = {
  recent: Message[];
  history: Message[];
};

type SendKind = 'text' | 'location';

function compareNewest(a: Message, b: Message) {
  if (a.createdAt !== b.createdAt || a.id === b.id) {
    return b.createdAt - a.createdAt;
  }
  return a.id < b.id ? 1 : -1;
}

const messageKey = (message: Message) => message.id;

export function ChatScreen({uid, peer, onBack}: Props) {
  const insets = useSafeAreaInsets();
  const focused = useIsFocused();
  const [foreground, setForeground] = useState(
    AppState.currentState === 'active',
  );
  const [connection, setConnection] = useState<boolean>();
  const [thread, setThread] = useState<MessageWindow>();
  const [loadError, setLoadError] = useState('');
  const [reload, setReload] = useState(0);
  const [actionError, setActionError] = useState('');
  const [paging, setPaging] = useState(false);
  const [historyEnd, setHistoryEnd] = useState(false);
  const [peerTyping, setPeerTyping] = useState(false);
  const [activeTimeId, setActiveTimeId] = useState<string | null>(null);

  const list = useRef<FlatList<Message>>(null);
  const activeSubscription = useRef<symbol | null>(null);
  const pagePending = useRef(false);
  const readAnchor = useRef<Message | undefined>(undefined);
  const readIds = useRef<Set<string> | undefined>(undefined);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', state =>
      setForeground(state === 'active'),
    );
    return () => subscription.remove();
  }, []);

  useEffect(() => subscribeConnection(setConnection), []);

  useEffect(() => {
    if (!focused) {
      setPeerTyping(false);
      return;
    }
    return subscribeTyping(uid, peer.id, setPeerTyping);
  }, [focused, peer.id, uid]);

  useEffect(() => {
    if (!focused || connection !== true) {
      setTyping(uid, peer.id, false);
    }
  }, [connection, focused, peer.id, uid]);

  useEffect(() => {
    return () => {
      setTyping(uid, peer.id, false);
    };
  }, [peer.id, uid]);

  useEffect(() => {
    if (!focused) {
      return;
    }
    const subscription = Symbol();
    activeSubscription.current = subscription;
    setLoadError('');
    const unsubscribe = subscribeMessages(
      uid,
      peer.id,
      recent => {
        setThread(previous => {
          if (!previous) {
            return {recent, history: []};
          }
          const recentIds = new Set(recent.map(messageKey));
          const oldest = recent[recent.length - 1];
          const dropped =
            recent.length === MESSAGE_PAGE_SIZE
              ? previous.recent.filter(
                  message => compareNewest(message, oldest) > 0,
                )
              : [];
          return {
            recent,
            history: dropped.concat(
              previous.history.filter(message => !recentIds.has(message.id)),
            ),
          };
        });
      },
      () => setLoadError('Kiểm tra kết nối rồi thử lại.'),
    );

    return () => {
      activeSubscription.current = null;
      unsubscribe();
    };
  }, [focused, peer.id, reload, uid]);

  const recent = thread?.recent;

  useEffect(() => {
    if (!focused || !foreground || connection !== true) {
      readAnchor.current = undefined;
      readIds.current = undefined;
      return;
    }
    if (!recent?.length) {
      return;
    }

    const newest = recent[0];
    const oldest = recent[recent.length - 1];
    const shouldReadBacklog =
      !readAnchor.current || compareNewest(readAnchor.current, oldest) > 0;
    const incoming = recent.filter(message => message.senderId !== uid);
    const unseen = incoming.filter(
      message => !readIds.current?.has(message.id),
    );
    readAnchor.current = newest;
    if (!shouldReadBacklog && !unseen.length) {
      return;
    }

    const currentIds = new Set(incoming.map(message => message.id));
    readIds.current = currentIds;
    const request = shouldReadBacklog
      ? markThreadRead(uid, peer.id, newest)
      : markRead(
          uid,
          peer.id,
          unseen.map(message => message.id),
        );

    request.catch(() => {
      if (readIds.current === currentIds) {
        if (shouldReadBacklog) {
          readAnchor.current = undefined;
        }
        unseen.forEach(message => currentIds.delete(message.id));
      }
    });
  }, [connection, focused, foreground, peer.id, recent, uid]);

  const messages = useMemo(() => {
    if (!thread) {
      return [];
    }
    if (!thread.history.length) {
      return thread.recent;
    }
    const unique = new Map(
      thread.history.map(message => [message.id, message]),
    );
    thread.recent.forEach(message => unique.set(message.id, message));
    return [...unique.values()].sort(compareNewest);
  }, [thread]);

  const isPeerTyping = peerTyping || Boolean(peer.typing);

  const latestId = recent?.[0]?.id;
  useEffect(() => {
    if (latestId) {
      const frame = requestAnimationFrame(() =>
        list.current?.scrollToOffset({offset: 0, animated: false}),
      );
      return () => cancelAnimationFrame(frame);
    }
  }, [latestId]);

  useEffect(() => {
    if (isPeerTyping) {
      const frame = requestAnimationFrame(() =>
        list.current?.scrollToOffset({offset: 0, animated: true}),
      );
      return () => cancelAnimationFrame(frame);
    }
  }, [isPeerTyping]);

  const loadHistory = async () => {
    const cursor = messages[messages.length - 1];
    const subscription = activeSubscription.current;
    if (
      !cursor ||
      !subscription ||
      pagePending.current ||
      connection !== true
    ) {
      return;
    }
    pagePending.current = true;
    setPaging(true);
    setActionError('');
    try {
      const page = await loadOlderMessages(uid, peer.id, cursor);
      if (activeSubscription.current !== subscription) {
        return;
      }
      setThread(
        previous =>
          previous && {...previous, history: previous.history.concat(page)},
      );
      setHistoryEnd(page.length < MESSAGE_PAGE_SIZE);
    } catch {
      if (activeSubscription.current === subscription) {
        setActionError('Chưa tải được tin nhắn cũ. Hãy thử lại.');
      }
    } finally {
      pagePending.current = false;
      setPaging(false);
    }
  };

  const send = async (kind: SendKind, content: string) => {
    const subscription = activeSubscription.current;
    if (!subscription || connection !== true) {
      return false;
    }

    setActionError('');
    let payload: MessagePayload = {kind: 'text', text: content};
    if (kind === 'location') {
      try {
        const coords = await getCurrentLocation();
        if (!coords) {
          return false;
        }
        payload = {kind, ...coords};
      } catch {
        return false;
      }
    }
    if (activeSubscription.current !== subscription) {
      return false;
    }

    try {
      await sendMessage(uid, peer.id, payload);
      return true;
    } catch {
      setActionError('Gửi chưa thành công. Hãy thử gửi lại.');
      return false;
    }
  };

  const openMap = useCallback((latitude: number, longitude: number) => {
    openLocation({latitude, longitude}).catch(() =>
      setActionError('Thiết bị chưa mở được bản đồ. Hãy thử lại.'),
    );
  }, []);

  const toggleMessageTime = useCallback((id: string) => {
    setActiveTimeId(current => (current === id ? null : id));
  }, []);

  const handleTypingChange = useCallback(
    (typing: boolean) => {
      setTyping(uid, peer.id, typing);
    },
    [peer.id, uid],
  );

  const renderMessage = useCallback<ListRenderItem<Message>>(
    ({item}) => {
      const timeLabel =
        activeTimeId === item.id ? formatChatMilestone(item.createdAt) : '';
      return (
        <View style={styles.messageGroup}>
          {timeLabel ? (
            <Text style={styles.dateMilestone}>{timeLabel}</Text>
          ) : null}
          <MessageBubble
            message={item}
            own={item.senderId === uid}
            peerName={peer.name}
            openMap={openMap}
            onToggleTime={toggleMessageTime}
          />
        </View>
      );
    },
    [activeTimeId, openMap, peer.name, toggleMessageTime, uid],
  );

  const networkLabel =
    connection === undefined ? 'Đang kết nối…' : 'Đang kết nối lại…';
  const canSend = connection === true && !loadError;
  const showHistory = !historyEnd && (recent?.length ?? 0) >= MESSAGE_PAGE_SIZE;

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior="padding"
      enabled={Platform.OS === 'ios'}
      keyboardVerticalOffset={insets.top}>
      <View style={styles.header}>
        <IconButton label="Quay lại" onPress={onBack}>
          <ArrowLeft size={23} color={colors.text} />
        </IconButton>
        <Avatar name={peer.name} id={peer.id} online={peer.online} size={42} />
        <View style={styles.identity}>
          <Text
            accessibilityRole="header"
            style={styles.peerName}
            numberOfLines={1}>
            {peer.name}
          </Text>
          <Text style={[styles.statusText, peer.online && styles.onlineText]}>
            {peer.online ? 'Đang trực tuyến' : 'Ngoại tuyến'}
          </Text>
        </View>
        <Activity
          size={24}
          color={colors.accent}
          importantForAccessibility="no"
        />
      </View>

      {connection !== true && (
        <Text accessibilityLiveRegion="polite" style={styles.connection}>
          {networkLabel}
        </Text>
      )}

      {loadError ? (
        <View style={styles.statusArea}>
          <StatusMessage title="Chưa tải được tin nhắn" detail={loadError} />
          <Pressable
            accessibilityRole="button"
            onPress={() => setReload(value => value + 1)}
            style={styles.historyButton}>
            <Text style={styles.historyText}>Thử lại</Text>
          </Pressable>
        </View>
      ) : !thread ? (
        <View style={styles.statusArea}>
          <StatusMessage title="Đang tải cuộc trò chuyện" loading />
        </View>
      ) : !messages.length && !isPeerTyping ? (
        <View style={styles.statusArea}>
          <StatusMessage
            title="Bắt đầu trò chuyện"
            detail="Gửi tin đầu tiên cho người này."
          />
        </View>
      ) : (
        <FlatList
          ref={list}
          style={styles.timeline}
          contentContainerStyle={styles.thread}
          data={messages}
          inverted
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          keyExtractor={messageKey}
          renderItem={renderMessage}
          ListHeaderComponent={
            isPeerTyping ? (
              <TypingBubble peerName={peer.name} peerId={peer.id} />
            ) : null
          }
          ListFooterComponent={
            showHistory ? (
              <Pressable
                accessibilityRole="button"
                disabled={paging || connection !== true}
                onPress={loadHistory}
                style={styles.historyButton}>
                <Text style={styles.historyText}>
                  {paging ? 'Đang tải…' : 'Xem tin nhắn cũ hơn'}
                </Text>
              </Pressable>
            ) : null
          }
        />
      )}

      {!!actionError && (
        <Text accessibilityLiveRegion="polite" style={styles.actionError}>
          {actionError}
        </Text>
      )}
      <Composer
        enabled={canSend}
        onSend={send}
        onTypingChange={handleTypingChange}
      />
    </KeyboardAvoidingView>
  );
}

function Composer({
  enabled,
  onSend,
  onTypingChange,
}: {
  enabled: boolean;
  onSend: (kind: SendKind, content: string) => Promise<boolean>;
  onTypingChange: (typing: boolean) => void;
}) {
  const insets = useSafeAreaInsets();
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const [androidKeyboardHeight, setAndroidKeyboardHeight] = useState(0);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState<SendKind | null>(null);
  const [inputFocused, setInputFocused] = useState(false);
  const pending = useRef(false);
  const typingRef = useRef(false);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const content = draft.trim();
  const disabled = !enabled || sending !== null;

  const clearTypingTimer = useCallback(() => {
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
  }, []);

  const stopTyping = useCallback(() => {
    clearTypingTimer();
    if (typingRef.current) {
      typingRef.current = false;
      onTypingChange(false);
    }
  }, [clearTypingTimer, onTypingChange]);

  const notifyTyping = useCallback(
    (text: string) => {
      if (!enabled || text.length === 0) {
        stopTyping();
        return;
      }
      if (!typingRef.current) {
        typingRef.current = true;
        onTypingChange(true);
      }
      clearTypingTimer();
      typingTimeoutRef.current = setTimeout(() => {
        typingRef.current = false;
        typingTimeoutRef.current = null;
        onTypingChange(false);
      }, 12_000);
    },
    [clearTypingTimer, enabled, onTypingChange, stopTyping],
  );

  useEffect(() => {
    if (!enabled) {
      stopTyping();
    }
  }, [enabled, stopTyping]);

  useEffect(() => {
    return () => {
      stopTyping();
    };
  }, [stopTyping]);

  useEffect(() => {
    const showEvent =
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent =
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvent, event => {
      setKeyboardOpen(true);
      if (Platform.OS === 'android') {
        setAndroidKeyboardHeight(event.endCoordinates.height);
      }
    });
    const hideSub = Keyboard.addListener(hideEvent, () => {
      setKeyboardOpen(false);
      if (Platform.OS === 'android') {
        setAndroidKeyboardHeight(0);
      }
    });
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const submit = async (kind: SendKind) => {
    if (disabled || pending.current || (kind === 'text' && !content)) {
      return;
    }
    if (kind === 'text') {
      stopTyping();
    }
    pending.current = true;
    setSending(kind);
    try {
      if ((await onSend(kind, content)) && kind === 'text') {
        setDraft(current => (current === draft ? '' : current));
      }
    } finally {
      pending.current = false;
      setSending(null);
    }
  };

  const bottomPadding =
    Platform.OS === 'android' && androidKeyboardHeight > 0
      ? androidKeyboardHeight + insets.bottom + space.sm
      : keyboardOpen
        ? space.sm
        : Math.max(insets.bottom, space.sm) + space.md;

  return (
    <View style={[styles.composer, {paddingBottom: bottomPadding}]}>
      <IconButton
        label="Gửi vị trí"
        onPress={() => submit('location')}
        disabled={disabled}>
        {sending === 'location' ? (
          <ActivityIndicator size="small" color={colors.accent} />
        ) : (
          <MapPin size={23} color={colors.accent} />
        )}
      </IconButton>
      <TextInput
        accessibilityLabel="Nội dung tin nhắn"
        maxLength={MAX_MESSAGE_LENGTH}
        multiline
        onBlur={() => {
          setInputFocused(false);
          stopTyping();
        }}
        onChangeText={text => {
          setDraft(text);
          notifyTyping(text);
        }}
        onFocus={() => {
          setInputFocused(true);
          if (draft.length > 0) {
            notifyTyping(draft);
          }
        }}
        placeholder="Viết tin nhắn…"
        placeholderTextColor={colors.muted}
        selectionColor={colors.accent}
        style={[styles.input, inputFocused && styles.inputFocused]}
        value={draft}
      />
      <IconButton
        label="Gửi tin nhắn"
        onPress={() => submit('text')}
        disabled={disabled || !content}
        variant="primary">
        {sending === 'text' ? (
          <ActivityIndicator size="small" color={colors.onAccent} />
        ) : (
          <Send size={20} color={colors.onAccent} style={styles.sendIcon} />
        )}
      </IconButton>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {flex: 1, backgroundColor: colors.canvas},
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
  },
  identity: {flex: 1, minWidth: 0},
  peerName: {...type.body, fontFamily: fonts.semibold, color: colors.text},
  statusText: {...type.caption, color: colors.muted, flexShrink: 1},
  onlineText: {color: colors.online},
  connection: {
    ...type.caption,
    paddingHorizontal: space.lg,
    paddingVertical: space.xs,
    backgroundColor: colors.surface,
    color: colors.muted,
    textAlign: 'center',
  },
  statusArea: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: space.lg,
  },
  timeline: {flex: 1},
  thread: {
    paddingHorizontal: space.lg,
    paddingVertical: space.lg,
    gap: space.sm,
  },
  messageGroup: {gap: space.sm},
  dateMilestone: {
    ...type.caption,
    color: colors.muted,
    textAlign: 'center',
    paddingVertical: space.sm,
  },
  historyButton: {
    alignSelf: 'center',
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: space.lg,
  },
  historyText: {
    ...type.body,
    fontFamily: fonts.semibold,
    color: colors.accent,
  },
  actionError: {
    ...type.caption,
    color: colors.error,
    paddingHorizontal: space.lg,
    paddingVertical: space.xs,
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.lg,
    paddingTop: space.sm,
  },
  input: {
    ...type.body,
    flex: 1,
    minWidth: 0,
    minHeight: 48,
    maxHeight: 124,
    paddingHorizontal: space.lg,
    paddingVertical: 10,
    textAlignVertical: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    color: colors.text,
  },
  inputFocused: {backgroundColor: colors.raised},
  sendIcon: {transform: [{translateX: -1}, {translateY: 1}]},
});
