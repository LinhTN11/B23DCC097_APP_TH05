import {ArrowUpRight, Globe, MapPin} from 'lucide-react-native';
import React, {memo, useEffect, useRef, useState} from 'react';
import {
  ActivityIndicator,
  Animated,
  Image,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Svg, {Path} from 'react-native-svg';
import type {Message} from '../services/chat';
import {
  extractUrls,
  fetchLinkMetadata,
  getCachedLinkMetadata,
  splitTextWithUrls,
  type LinkMetadata,
} from '../services/linkPreview';
import {Avatar} from '../ui/components';
import {colors, fonts, radius, space, type} from '../ui/theme';

type BubbleProps = {
  message: Message;
  own: boolean;
  peerName: string;
  openMap: (latitude: number, longitude: number) => void;
  onToggleTime: (messageId: string) => void;
};

function openExternalUrl(url: string) {
  Linking.openURL(url).catch(() => {});
}

function useLinkMetadata(url?: string): LinkMetadata | undefined {
  const [meta, setMeta] = useState<LinkMetadata | undefined>(() =>
    url ? getCachedLinkMetadata(url) : undefined,
  );

  useEffect(() => {
    if (!url) {
      setMeta(undefined);
      return;
    }
    let active = true;
    const cached = getCachedLinkMetadata(url);
    if (cached) {
      setMeta(cached);
      return;
    }
    setMeta(undefined);
    fetchLinkMetadata(url).then(result => {
      if (active) {
        setMeta(result);
      }
    });
    return () => {
      active = false;
    };
  }, [url]);

  return meta;
}

function LinkedText({text, ink}: {text: string; ink: string}) {
  const segments = splitTextWithUrls(text);
  return (
    <Text style={[styles.messageText, {color: ink}]}>
      {segments.map((segment, index) =>
        segment.url ? (
          <Text
            key={index}
            accessibilityRole="link"
            onPress={() => openExternalUrl(segment.url!)}
            style={[styles.linkText, {color: ink}]}>
            {segment.text}
          </Text>
        ) : (
          <React.Fragment key={index}>{segment.text}</React.Fragment>
        ),
      )}
    </Text>
  );
}

function LinkPreviewCard({
  url,
  meta,
  onToggleTime,
}: {
  url: string;
  meta: LinkMetadata;
  onToggleTime: () => void;
}) {
  const [imageFailed, setImageFailed] = useState(false);
  const [logoFailed, setLogoFailed] = useState(false);

  useEffect(() => {
    setImageFailed(false);
    setLogoFailed(false);
  }, [url]);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={
        meta.title
          ? `Xem thời gian tin nhắn liên kết ${meta.title}`
          : `Xem thời gian tin nhắn liên kết ${meta.domain}`
      }
      accessibilityHint="Nhấn vào tiêu đề nguồn hoặc nhấn giữ để mở liên kết"
      onPress={onToggleTime}
      onLongPress={() => openExternalUrl(url)}
      style={({pressed}) => [styles.linkCard, pressed && styles.pressed]}>
      {meta.image && !imageFailed ? (
        <Image
          source={{uri: meta.image}}
          style={styles.linkImage}
          resizeMode="cover"
          onError={() => setImageFailed(true)}
        />
      ) : null}
      <View style={styles.linkBody}>
        <Pressable
          accessibilityRole="link"
          accessibilityLabel={
            meta.title ? `Mở liên kết ${meta.title}` : `Mở liên kết ${meta.domain}`
          }
          hitSlop={8}
          onPress={() => openExternalUrl(url)}
          style={({pressed}) => [
            styles.linkDomainRow,
            pressed && styles.pressed,
          ]}>
          {meta.logo && !logoFailed ? (
            <Image
              source={{uri: meta.logo}}
              style={styles.linkLogo}
              resizeMode="cover"
              onError={() => setLogoFailed(true)}
            />
          ) : (
            <Globe size={12} color={colors.muted} />
          )}
          <Text numberOfLines={1} style={styles.linkDomain}>
            {meta.domain}
          </Text>
          <ArrowUpRight size={14} color={colors.muted} />
        </Pressable>
        {meta.title ? (
          <Text numberOfLines={2} style={styles.linkTitle}>
            {meta.title}
          </Text>
        ) : null}
        {meta.description ? (
          <Text numberOfLines={2} style={styles.linkDescription}>
            {meta.description}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

function TypingDot({delay}: {delay: number}) {
  const phase = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(phase, {
          toValue: 1,
          duration: 280,
          useNativeDriver: true,
        }),
        Animated.timing(phase, {
          toValue: 0,
          duration: 280,
          useNativeDriver: true,
        }),
        Animated.delay(Math.max(0, 420 - delay)),
      ]),
    );
    pulse.start();
    return () => pulse.stop();
  }, [delay, phase]);

  const translateY = phase.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -3],
  });
  const opacity = phase.interpolate({
    inputRange: [0, 1],
    outputRange: [0.4, 1],
  });

  return (
    <Animated.View
      style={[styles.typingDot, {opacity, transform: [{translateY}]}]}
    />
  );
}

export const TypingBubble = memo(function TypingBubbleContent({
  peerName,
  peerId,
}: {
  peerName: string;
  peerId: string;
}) {
  return (
    <View
      accessible
      accessibilityLabel={`${peerName} đang nhập tin nhắn`}
      style={styles.bubbleRow}>
      <Avatar name={peerName} id={peerId} size={32} />
      <View style={[styles.bubble, styles.peerBubble, styles.typingBubble]}>
        <View style={styles.typingDots}>
          <TypingDot delay={0} />
          <TypingDot delay={140} />
          <TypingDot delay={280} />
        </View>
      </View>
    </View>
  );
});

export const MessageBubble = memo(
  function Bubble({
    message,
    own,
    peerName,
    openMap,
    onToggleTime,
  }: BubbleProps) {
    const {latitude, longitude} = message;
    const location =
      message.kind === 'location' &&
      latitude !== undefined &&
      longitude !== undefined;
    const ink = own ? colors.onAccent : colors.text;
    const text = message.text ?? '';
    const firstUrl = !location ? extractUrls(text)[0] : undefined;
    const meta = useLinkMetadata(firstUrl);
    const toggleTime = () => onToggleTime(message.id);

    let content: React.ReactNode;
    if (location) {
      content = (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Xem thời gian tin nhắn vị trí"
          accessibilityHint="Nhấn vào biểu tượng bản đồ hoặc nhấn giữ để mở bản đồ"
          onPress={toggleTime}
          onLongPress={() => openMap(latitude, longitude)}
          style={({pressed}) => [
            styles.bubble,
            own ? styles.ownBubble : styles.peerBubble,
            styles.locationCard,
            pressed && styles.pressed,
          ]}>
          <Pressable
            accessibilityRole="link"
            accessibilityLabel="Mở vị trí trên bản đồ"
            hitSlop={8}
            onPress={() => openMap(latitude, longitude)}
            style={styles.mapMark}>
            <Svg
              width={42}
              height={42}
              viewBox="0 0 42 42"
              style={StyleSheet.absoluteFill}
              pointerEvents="none">
              <Path
                d="M0 9h42M0 21h42M0 33h42M9 0v42M21 0v42M33 0v42"
                stroke={ink}
                strokeOpacity={0.16}
              />
            </Svg>
            <MapPin size={22} color={ink} />
          </Pressable>
          <View style={styles.coordinates}>
            <Text style={[styles.locationTitle, {color: ink}]}>
              Vị trí đã chia sẻ
            </Text>
            <Text style={[styles.coordinatesText, {color: ink}]}>
              {latitude.toFixed(4)}, {longitude.toFixed(4)}
            </Text>
          </View>
          <Pressable
            accessibilityRole="link"
            accessibilityLabel="Mở vị trí trên bản đồ"
            hitSlop={10}
            onPress={() => openMap(latitude, longitude)}
            style={styles.locationOpenButton}>
            <ArrowUpRight size={18} color={ink} />
          </Pressable>
        </Pressable>
      );
    } else if (firstUrl && meta !== undefined) {
      const segments = splitTextWithUrls(text);
      const textOnly = segments
        .filter(segment => !segment.url)
        .map(segment => segment.text)
        .join('')
        .trim();

      content = (
        <>
          {textOnly.length > 0 ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Tin nhắn: ${textOnly}`}
              onPress={toggleTime}
              style={({pressed}) => [
                styles.bubble,
                own ? styles.ownBubble : styles.peerBubble,
                pressed && styles.pressed,
              ]}>
              <Text style={[styles.messageText, {color: ink}]}>{textOnly}</Text>
            </Pressable>
          ) : null}
          <LinkPreviewCard url={firstUrl} meta={meta} onToggleTime={toggleTime} />
        </>
      );
    } else {
      content = (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Tin nhắn: ${text}`}
          onPress={toggleTime}
          style={({pressed}) => [
            styles.bubble,
            own ? styles.ownBubble : styles.peerBubble,
            pressed && styles.pressed,
          ]}>
          <LinkedText text={text} ink={ink} />
          {firstUrl ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator
                size="small"
                color={own ? colors.onAccent : colors.muted}
              />
              <Text
                style={[
                  styles.linkLoadingText,
                  own && styles.ownLoadingText,
                ]}>
                Đang tải xem trước…
              </Text>
            </View>
          ) : null}
        </Pressable>
      );
    }

    return (
      <View style={[styles.bubbleRow, own && styles.ownRow]}>
        {!own ? (
          <Avatar name={peerName} id={message.senderId} size={32} />
        ) : null}
        <View style={[styles.bubbleColumn, own && styles.ownColumn]}>
          {content}
        </View>
      </View>
    );
  },
  (previous, next) => {
    const a = previous.message;
    const b = next.message;
    return (
      previous.own === next.own &&
      previous.peerName === next.peerName &&
      previous.openMap === next.openMap &&
      previous.onToggleTime === next.onToggleTime &&
      a.id === b.id &&
      a.senderId === b.senderId &&
      a.createdAt === b.createdAt &&
      a.kind === b.kind &&
      a.text === b.text &&
      a.latitude === b.latitude &&
      a.longitude === b.longitude
    );
  },
);

const styles = StyleSheet.create({
  bubbleRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'flex-start',
    gap: space.sm,
  },
  ownRow: {justifyContent: 'flex-end'},
  bubbleColumn: {
    maxWidth: '82%',
    alignItems: 'flex-start',
    gap: space.xs,
  },
  ownColumn: {alignItems: 'flex-end'},
  bubble: {
    borderRadius: 22,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    gap: space.xs,
  },
  ownBubble: {
    backgroundColor: colors.accent,
    borderBottomRightRadius: space.xs,
  },
  peerBubble: {
    backgroundColor: colors.surface,
    borderBottomLeftRadius: space.xs,
  },
  messageText: type.body,
  linkText: {
    textDecorationLine: 'underline',
    fontFamily: fonts.semibold,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
  },
  linkCard: {
    width: 256,
    maxWidth: '100%',
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: colors.surface,
  },
  pressed: {opacity: 0.75},
  linkImage: {
    width: '100%',
    height: 144,
    backgroundColor: colors.canvas,
  },
  linkBody: {
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    gap: 2,
  },
  linkDomainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
  },
  linkLogo: {
    width: 14,
    height: 14,
    borderRadius: 3,
  },
  linkDomain: {
    ...type.caption,
    color: colors.muted,
    flex: 1,
    fontSize: 11,
  },
  linkLoadingText: {
    ...type.caption,
    color: colors.muted,
    fontFamily: fonts.regular,
  },
  ownLoadingText: {
    color: 'rgba(20, 24, 7, 0.72)',
  },
  linkTitle: {
    ...type.body,
    color: colors.text,
    fontFamily: fonts.semibold,
    lineHeight: 20,
  },
  linkDescription: {
    ...type.caption,
    color: colors.muted,
    fontFamily: fonts.regular,
    lineHeight: 17,
  },
  coordinatesText: {
    ...type.caption,
    fontVariant: ['tabular-nums'],
  },
  locationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    minHeight: 48,
  },
  locationOpenButton: {
    padding: 2,
  },
  typingBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: space.sm,
    paddingHorizontal: space.md,
  },
  typingDots: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    height: 22,
  },
  typingDot: {
    width: 7,
    height: 7,
    borderRadius: radius.pill,
    backgroundColor: colors.online,
  },
  mapMark: {
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    width: 42,
    height: 42,
  },
  coordinates: {flexShrink: 1, alignItems: 'flex-start'},
  locationTitle: {...type.body, fontFamily: fonts.semibold},
});
