import React, { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { colors, fonts, radius, space, type } from './theme';

const timeFormatter = new Intl.DateTimeFormat('vi-VN', {
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

const weekdayFormatter = new Intl.DateTimeFormat('vi-VN', {
  weekday: 'short',
});

const dayMonthFormatter = new Intl.DateTimeFormat('vi-VN', {
  day: 'numeric',
  month: 'short',
});

const fullDateFormatter = new Intl.DateTimeFormat('vi-VN', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

function dayStart(timestamp: number) {
  const date = new Date(timestamp);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

export function formatTime(timestamp: number) {
  return Number.isFinite(timestamp) && timestamp > 0
    ? timeFormatter.format(timestamp)
    : '';
}

export function formatChatMilestone(
  timestamp: number,
  previousTimestamp?: number,
) {
  if (!Number.isFinite(timestamp) || timestamp <= 0) {
    return '';
  }

  const time = timeFormatter.format(timestamp);
  const currentDay = dayStart(timestamp);

  if (
    previousTimestamp !== undefined &&
    Number.isFinite(previousTimestamp) &&
    previousTimestamp > 0 &&
    dayStart(previousTimestamp) === currentDay
  ) {
    return timestamp - previousTimestamp > HOUR_MS ? time : '';
  }

  const today = dayStart(Date.now());
  const dayDiff = Math.round((today - currentDay) / DAY_MS);

  if (dayDiff === 0) {
    return `Hôm nay, ${time}`;
  }
  if (dayDiff === 1) {
    return `Hôm qua, ${time}`;
  }
  if (dayDiff > 1 && dayDiff < 7) {
    return `${weekdayFormatter.format(timestamp)}, ${time}`;
  }
  if (new Date(timestamp).getFullYear() === new Date(today).getFullYear()) {
    return `${dayMonthFormatter.format(timestamp)}, ${time}`;
  }
  return `${fullDateFormatter.format(timestamp)}, ${time}`;
}

export function Brand() {
  return (
    <View accessible accessibilityLabel="Tần số" style={styles.brand}>
      <Svg width={26} height={22} viewBox="0 0 26 22">
        <Path
          fill={colors.accent}
          d="M0 16 8 3h5L5 16H0ZM8 20 18 2h5L13 20H8ZM18 18l5-9h3l-5 9h-3Z"
        />
      </Svg>
      <Text style={styles.wordmark}>TANSO</Text>
    </View>
  );
}

export function SignalArt({ color }: { color: string }) {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Svg
        width="100%"
        height="100%"
        viewBox="0 0 356 156"
        preserveAspectRatio="xMidYMid slice"
      >
        <Path
          d="M-45 111 Q55 135 117 107 T216 70 Q250 63 279 119 T380 132 M-45 100 Q55 124 117 96 T216 59 Q250 52 279 108 T380 121 M-45 89 Q55 113 117 85 T216 48 Q250 41 279 97 T380 110 M-45 78 Q55 102 117 74 T216 37 Q250 30 279 86 T380 99 M-45 67 Q55 91 117 63 T216 26 Q250 19 279 75 T380 88 M-45 56 Q55 80 117 52 T216 15 Q250 8 279 64 T380 77"
          stroke={color}
          strokeWidth={1}
          fill="none"
        />
      </Svg>
    </View>
  );
}

export function Avatar({
  name,
  id,
  online,
  size = 50,
}: {
  name: string;
  id: string;
  online?: boolean;
  size?: number;
}) {
  const words = name.trim().split(/\s+/);
  const letters =
    [words.length > 1 ? words[words.length - 2] : '', words[words.length - 1]]
      .map(word => Array.from(word)[0] ?? '')
      .join('')
      .toLocaleUpperCase('vi') || '?';
  const hue =
    Array.from(id).reduce((sum, letter) => sum + letter.charCodeAt(0), 0) % 360;

  return (
    <View style={{ width: size, height: size }}>
      <View
        style={[styles.avatar, { backgroundColor: `hsl(${hue}, 20%, 26%)` }]}
      >
        <Text
          allowFontScaling={false}
          style={[styles.initials, { fontSize: size * 0.28 }]}
        >
          {letters}
        </Text>
      </View>
      {online !== undefined && (
        <View style={[styles.presence, online && styles.online]} />
      )}
    </View>
  );
}

export function UnreadBadge({ count }: { count: number }) {
  if (!count) {
    return null;
  }
  return (
    <View style={styles.badge}>
      <Text style={styles.badgeText}>{count > 99 ? '99+' : count}</Text>
    </View>
  );
}

export function IconButton({
  label,
  onPress,
  variant = 'quiet',
  disabled = false,
  children,
}: {
  label: string;
  onPress: () => void;
  variant?: 'quiet' | 'primary';
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.iconButton,
        variant === 'primary' && styles.primary,
        (pressed || disabled) && styles.dim,
      ]}
    >
      {children}
    </Pressable>
  );
}

export function ActionButton({
  label,
  onPress,
  loading = false,
  icon,
  tone = 'primary',
}: {
  label: string;
  onPress: () => void;
  loading?: boolean;
  icon?: React.ReactNode;
  tone?: 'primary' | 'quiet' | 'danger';
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ busy: loading, disabled: loading }}
      disabled={loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.action,
        tone === 'primary' && styles.primary,
        pressed && styles.dim,
      ]}
    >
      <Text
        style={[
          styles.actionText,
          tone === 'primary' && styles.primaryText,
          tone === 'danger' && styles.dangerText,
        ]}
      >
        {label}
      </Text>
      {loading ? (
        <ActivityIndicator
          color={tone === 'primary' ? colors.onAccent : colors.text}
        />
      ) : (
        icon
      )}
    </Pressable>
  );
}

export function FormField({
  label,
  inputRef,
  adornment,
  onBlur,
  onFocus,
  style,
  ...props
}: TextInputProps & {
  label: string;
  inputRef?: React.Ref<TextInput>;
  adornment?: React.ReactNode;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={[styles.inputFrame, focused && styles.focused]}>
        <TextInput
          ref={inputRef}
          accessibilityLabel={label}
          placeholderTextColor={colors.muted}
          selectionColor={colors.accent}
          underlineColorAndroid="transparent"
          {...props}
          onBlur={event => {
            setFocused(false);
            onBlur?.(event);
          }}
          onFocus={event => {
            setFocused(true);
            onFocus?.(event);
          }}
          style={[styles.input, style]}
        />
        {adornment}
      </View>
    </View>
  );
}

export function StatusMessage({
  title,
  detail,
  loading = false,
  icon,
}: {
  title: string;
  detail?: string;
  loading?: boolean;
  icon?: React.ReactNode;
}) {
  return (
    <View style={styles.state} accessibilityLiveRegion="polite">
      {loading ? <ActivityIndicator color={colors.accent} /> : icon}
      <View style={styles.stateCopy}>
        <Text style={styles.stateTitle}>{title}</Text>
        {detail ? <Text style={styles.stateDetail}>{detail}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  brand: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    flexDirection: 'row',
    gap: space.sm,
  },
  wordmark: {
    color: colors.accent,
    fontFamily: fonts.wordmark,
    fontSize: 16,
    lineHeight: 26,
  },
  avatar: {
    alignItems: 'center',
    borderRadius: radius.control,
    flex: 1,
    justifyContent: 'center',
  },
  initials: { color: colors.text, fontFamily: fonts.black },
  presence: {
    backgroundColor: colors.muted,
    borderColor: colors.canvas,
    borderRadius: radius.pill,
    borderWidth: 2,
    bottom: -2,
    height: 14,
    position: 'absolute',
    right: -2,
    width: 14,
  },
  online: { backgroundColor: colors.online },
  badge: {
    alignItems: 'center',
    backgroundColor: colors.accent,
    borderRadius: radius.pill,
    minWidth: 23,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  badgeText: { ...type.caption, color: colors.onAccent },
  iconButton: {
    alignItems: 'center',
    backgroundColor: colors.raised,
    borderRadius: radius.control,
    justifyContent: 'center',
    minHeight: 48,
    minWidth: 48,
  },
  action: {
    alignItems: 'center',
    backgroundColor: colors.raised,
    borderRadius: radius.control,
    flexDirection: 'row',
    gap: space.md,
    justifyContent: 'space-between',
    minHeight: 52,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
  },
  primary: { backgroundColor: colors.accent },
  dim: { opacity: 0.65 },
  actionText: {
    ...type.body,
    color: colors.text,
    flexShrink: 1,
    fontFamily: fonts.semibold,
  },
  primaryText: { color: colors.onAccent },
  dangerText: { color: colors.error },
  field: { gap: space.xs },
  fieldLabel: { ...type.caption, color: colors.text },
  inputFrame: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    flexDirection: 'row',
    paddingHorizontal: space.sm,
  },
  focused: { backgroundColor: colors.raised },
  input: {
    ...type.body,
    color: colors.text,
    flex: 1,
    minHeight: 48,
    paddingHorizontal: space.md,
    paddingVertical: space.md,
  },
  state: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    paddingHorizontal: space.lg,
    paddingVertical: space.xl,
  },
  stateCopy: { alignItems: 'center' },
  stateTitle: {
    ...type.body,
    color: colors.text,
    fontFamily: fonts.semibold,
    textAlign: 'center',
  },
  stateDetail: {
    ...type.body,
    color: colors.muted,
    marginTop: 2,
    textAlign: 'center',
  },
});
