import React, { memo, useMemo, useState } from 'react';
import {
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  ArrowUpRight,
  Bell,
  ChevronRight,
  CircleAlert,
  ContactRound,
  LogOut,
  MapPin,
  MessagesSquare,
  Search,
} from 'lucide-react-native';
import type { Conversation, Profile } from '../services/chat';
import {
  ActionButton,
  Avatar,
  Brand,
  formatTime,
  SignalArt,
  StatusMessage,
  UnreadBadge,
} from '../ui/components';
import { colors, fonts, radius, space, type } from '../ui/theme';

type DirectoryProps = {
  profiles: Profile[];
  onOpen: (peerId: string) => void;
  loading?: boolean;
  error?: string;
};

type InboxProps = DirectoryProps & { conversations: Conversation[] };

function PageTitle({ title, detail }: { title: string; detail: string }) {
  return (
    <View style={styles.pageTitle}>
      <Brand />
      <View style={styles.pageCopy}>
        <Text accessibilityRole="header" style={styles.display}>
          {title}
        </Text>
        <Text style={styles.description}>{detail}</Text>
      </View>
    </View>
  );
}

function SectionLabel({ label, right }: { label: string; right?: string }) {
  return (
    <View style={styles.section}>
      <Text accessibilityRole="header" style={styles.sectionLabel}>
        {label}
      </Text>
      <View style={styles.sectionRule} />
      {right ? <Text style={styles.sectionRight}>{right}</Text> : null}
    </View>
  );
}

function EmptyState({
  loading,
  error,
  title,
  detail,
  icon,
}: {
  loading?: boolean;
  error?: string;
  title: string;
  detail: string;
  icon: React.ReactNode;
}) {
  if (error) {
    return (
      <StatusMessage
        title="Không thể tải dữ liệu"
        detail={error}
        icon={<CircleAlert color={colors.error} size={23} />}
      />
    );
  }
  if (loading) {
    return <StatusMessage title="Đang tải dữ liệu…" loading />;
  }
  return <StatusMessage title={title} detail={detail} icon={icon} />;
}

const ConversationRow = memo(function ConversationRowContent({
  item,
  profile,
  onOpen,
}: {
  item: Conversation;
  profile?: Profile;
  onOpen: DirectoryProps['onOpen'];
}) {
  const name = profile?.name ?? 'Người dùng';
  const location = item.lastMessage.kind === 'location';
  const preview = location ? 'Đã gửi vị trí' : item.lastMessage.text ?? '';
  const time = formatTime(item.lastMessage.createdAt);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={[
        name,
        preview,
        time,
        item.unread ? `${item.unread} tin chưa đọc` : '',
      ]
        .filter(Boolean)
        .join('. ')}
      onPress={() => onOpen(item.peerId)}
      style={({ pressed }) => [
        styles.row,
        item.unread > 0 && styles.unreadRow,
        pressed && styles.pressedRow,
      ]}
    >
      <Avatar name={name} id={item.peerId} online={profile?.online} />
      <View style={styles.rowCopy}>
        <Text numberOfLines={1} style={styles.name}>
          {name}
        </Text>
        <View style={styles.previewLine}>
          {location && <MapPin size={14} color={colors.accent} />}
          <Text numberOfLines={1} style={styles.preview}>
            {preview}
          </Text>
        </View>
      </View>
      <View style={styles.rowEnd}>
        <Text style={styles.time}>{time}</Text>
        <UnreadBadge count={item.unread} />
      </View>
    </Pressable>
  );
});

export function HomeScreen(props: InboxProps & { onContacts: () => void }) {
  const count = props.conversations.reduce(
    (total, item) => total + item.unread,
    0,
  );
  const online = props.profiles.filter(person => person.online).length;
  return (
    <InboxList
      {...props}
      header={
        <View style={styles.head}>
          <Brand />
          <View style={styles.inboxHero}>
            <SignalArt color={colors.accentLine} />
            <Text accessibilityRole="header" style={styles.inboxTitle}>
              Hộp thư
            </Text>
            <View style={styles.inboxFooter}>
              <Text style={styles.inboxCount}>
                {count > 0 ? `${count} tin chưa đọc` : 'Đã đọc hết tin nhắn'}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Soạn tin nhắn mới"
                onPress={props.onContacts}
                style={({ pressed }) => [
                  styles.heroAction,
                  pressed && styles.pressedDark,
                ]}
              >
                <ArrowUpRight size={22} color={colors.accent} />
              </Pressable>
            </View>
          </View>
          <SectionLabel
            label="Cuộc trò chuyện"
            right={`${online} người đang trực tuyến`}
          />
        </View>
      }
      emptyTitle="Chưa có cuộc trò chuyện"
      emptyDetail="Mở danh bạ để gửi tin nhắn đầu tiên."
      emptyIcon={<MessagesSquare size={24} color={colors.accent} />}
    />
  );
}

export function NotificationsScreen(props: InboxProps) {
  const unread = useMemo(
    () => props.conversations.filter(item => item.unread > 0),
    [props.conversations],
  );
  return (
    <InboxList
      {...props}
      conversations={unread}
      header={
        <PageTitle
          title="Thông báo"
          detail="Cuộc trò chuyện có tin nhắn chưa đọc."
        />
      }
      emptyTitle="Không có thông báo mới"
      emptyDetail="Tin nhắn chưa đọc sẽ xuất hiện ở đây."
      emptyIcon={<Bell size={24} color={colors.accent} />}
    />
  );
}

function InboxList({
  conversations,
  profiles,
  onOpen,
  loading,
  error,
  header,
  emptyTitle,
  emptyDetail,
  emptyIcon,
}: InboxProps & {
  header: React.ReactElement;
  emptyTitle: string;
  emptyDetail: string;
  emptyIcon: React.ReactNode;
}) {
  const byId = useMemo(
    () => new Map(profiles.map(profile => [profile.id, profile])),
    [profiles],
  );

  return (
    <FlatList
      style={styles.screen}
      contentContainerStyle={styles.content}
      data={conversations}
      keyExtractor={item => item.peerId}
      ListHeaderComponent={header}
      ItemSeparatorComponent={Separator}
      ListEmptyComponent={
        <EmptyState
          loading={loading}
          error={error}
          title={emptyTitle}
          detail={emptyDetail}
          icon={emptyIcon}
        />
      }
      ListFooterComponent={
        conversations.length > 0 && error ? (
          <EmptyState
            error={error}
            title={emptyTitle}
            detail={emptyDetail}
            icon={emptyIcon}
          />
        ) : null
      }
      renderItem={({ item }) => (
        <ConversationRow
          item={item}
          profile={byId.get(item.peerId)}
          onOpen={onOpen}
        />
      )}
    />
  );
}

const ContactRow = memo(function ContactRowContent({
  profile,
  onOpen,
}: {
  profile: Profile;
  onOpen: DirectoryProps['onOpen'];
}) {
  const status = profile.online ? 'Đang trực tuyến' : 'Ngoại tuyến';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${profile.name}. ${status}`}
      onPress={() => onOpen(profile.id)}
      style={({ pressed }) => [styles.row, pressed && styles.pressedRow]}
    >
      <Avatar name={profile.name} id={profile.id} online={profile.online} />
      <View style={styles.rowCopy}>
        <Text style={styles.name} numberOfLines={1}>
          {profile.name}
        </Text>
        <Text style={[styles.preview, profile.online && styles.online]}>
          {status}
        </Text>
      </View>
      <ChevronRight color={colors.muted} size={20} />
    </Pressable>
  );
});

function searchableName(name: string) {
  return name
    .toLocaleLowerCase('vi')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd');
}

export function ContactsScreen({
  profiles,
  onOpen,
  loading,
  error,
}: DirectoryProps) {
  const [search, setSearch] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const names = useMemo(
    () =>
      profiles.map(profile => ({
        profile,
        normalized: searchableName(profile.name),
      })),
    [profiles],
  );
  const rows = useMemo(() => {
    const query = searchableName(search.trim());
    return names.filter(entry => entry.normalized.includes(query));
  }, [names, search]);

  return (
    <FlatList
      style={styles.screen}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      data={rows}
      keyExtractor={item => item.profile.id}
      ItemSeparatorComponent={Separator}
      ListHeaderComponent={
        <View style={styles.contactsHead}>
          <Brand />
          <View
            style={[
              styles.searchBar,
              searchFocused && styles.searchBarFocused,
            ]}
          >
            <Search color={colors.muted} size={18} />
            <TextInput
              accessibilityLabel="Tìm kiếm người dùng"
              placeholder="Tìm kiếm người dùng…"
              placeholderTextColor={colors.muted}
              selectionColor={colors.accent}
              underlineColorAndroid="transparent"
              value={search}
              onChangeText={setSearch}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
              style={styles.searchInput}
            />
          </View>
          {rows.length > 0 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.storyStrip}
            >
              {rows.map(({ profile }) => {
                const status = profile.online ? 'Đang trực tuyến' : 'Ngoại tuyến';
                return (
                  <Pressable
                    key={profile.id}
                    accessibilityRole="button"
                    accessibilityLabel={`${profile.name}. ${status}`}
                    onPress={() => onOpen(profile.id)}
                    style={({ pressed }) => [
                      styles.storyItem,
                      pressed && styles.pressedDark,
                    ]}
                  >
                    <Avatar
                      name={profile.name}
                      id={profile.id}
                      online={profile.online}
                      size={56}
                    />
                    <Text numberOfLines={1} style={styles.storyName}>
                      {profile.name}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          ) : null}
        </View>
      }
      ListEmptyComponent={
        <EmptyState
          loading={loading}
          error={error}
          title={search.trim() ? 'Không có kết quả' : 'Danh bạ đang trống'}
          detail={
            search.trim()
              ? 'Thử nhập một tên khác.'
              : 'Người dùng đã đăng ký sẽ xuất hiện ở đây.'
          }
          icon={<ContactRound size={24} color={colors.accent} />}
        />
      }
      renderItem={({ item }) => (
        <ContactRow profile={item.profile} onOpen={onOpen} />
      )}
    />
  );
}

function Separator() {
  return <View style={styles.separator} />;
}

export function SettingsScreen({
  name,
  email,
  onLogout,
}: {
  name: string;
  email?: string | null;
  onLogout: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function logout() {
    setBusy(true);
    setError('');
    try {
      await onLogout();
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : 'Không thể đăng xuất. Hãy thử lại.',
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <PageTitle title="Cài đặt" detail="Tài khoản đang đăng nhập." />
      <View style={styles.profilePanel}>
        <Avatar id={email ?? name} name={name} size={64} />
        <View style={styles.rowCopy}>
          <Text style={styles.name}>{name}</Text>
          {email ? <Text style={styles.preview}>{email}</Text> : null}
        </View>
      </View>
      <SectionLabel label="Phiên đăng nhập" />
      <ActionButton
        label="Đăng xuất"
        tone="danger"
        onPress={logout}
        loading={busy}
        icon={<LogOut size={22} color={colors.error} />}
      />
      {error ? (
        <Text style={styles.error} accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.canvas, flex: 1 },
  head: { gap: space.xl },
  content: {
    alignSelf: 'center',
    maxWidth: 680,
    paddingBottom: 104,
    paddingHorizontal: space.xl,
    paddingTop: space.lg,
    width: '100%',
  },
  inboxHero: {
    backgroundColor: colors.accent,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 12,
    borderTopLeftRadius: 14,
    borderTopRightRadius: 48,
    justifyContent: 'flex-end',
    minHeight: 165,
    overflow: 'hidden',
    paddingBottom: space.lg,
    paddingHorizontal: space.xl,
    paddingTop: space.xl,
  },
  inboxTitle: { ...type.display, color: colors.onAccent },
  inboxFooter: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: space.md,
    justifyContent: 'space-between',
  },
  inboxCount: {
    ...type.body,
    color: colors.onAccent,
    flex: 1,
    fontFamily: fonts.semibold,
  },
  heroAction: {
    alignItems: 'center',
    backgroundColor: colors.onAccent,
    borderRadius: radius.pill,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  pressedDark: { opacity: 0.65 },
  pageTitle: { gap: space.xl },
  pageCopy: { gap: space.xs, paddingBottom: space.lg },
  display: { ...type.display, color: colors.text },
  description: { ...type.body, color: colors.muted },
  section: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: space.md,
    paddingBottom: space.md,
  },
  sectionLabel: {
    ...type.caption,
    color: colors.accent,
    flexShrink: 1,
    letterSpacing: 0.5,
  },
  sectionRule: {
    backgroundColor: colors.border,
    flex: 1,
    height: StyleSheet.hairlineWidth,
  },
  sectionRight: {
    ...type.caption,
    color: colors.online,
  },
  contactsHead: {
    gap: space.lg,
    paddingBottom: space.md,
  },
  searchBar: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    flexDirection: 'row',
    gap: space.sm,
    minHeight: 46,
    paddingHorizontal: space.lg,
  },
  searchBarFocused: {
    backgroundColor: colors.raised,
  },
  searchInput: {
    ...type.body,
    color: colors.text,
    flex: 1,
    paddingVertical: space.sm,
  },
  storyStrip: {
    gap: space.md,
    paddingVertical: space.xs,
  },
  storyItem: {
    alignItems: 'center',
    gap: space.xs,
    width: 68,
  },
  storyName: {
    ...type.caption,
    color: colors.text,
    fontFamily: fonts.regular,
    maxWidth: 68,
    textAlign: 'center',
  },
  row: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    flexDirection: 'row',
    gap: space.md,
    minHeight: 76,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
  },
  unreadRow: { backgroundColor: colors.raised },
  pressedRow: { backgroundColor: colors.raised },
  rowCopy: { flex: 1, gap: 2 },
  name: { ...type.body, color: colors.text, fontFamily: fonts.semibold },
  previewLine: { alignItems: 'center', flexDirection: 'row', gap: space.xs },
  preview: { ...type.body, color: colors.muted, flexShrink: 1 },
  rowEnd: { alignItems: 'flex-end', gap: space.xs },
  time: { ...type.caption, color: colors.muted },
  online: { color: colors.online },
  separator: { height: space.sm },
  profilePanel: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 28,
    flexDirection: 'row',
    gap: space.lg,
    marginBottom: space.xl,
    padding: space.lg,
  },
  error: { ...type.body, color: colors.error, marginTop: space.md },
});
