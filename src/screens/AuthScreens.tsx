import React, { useRef, useState } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { ArrowRight, Eye, EyeOff } from 'lucide-react-native';
import { ActionButton, Brand, FormField, SignalArt } from '../ui/components';
import { colors, fonts, space, type } from '../ui/theme';

export function LoginScreen({
  onSubmit,
  onSwitch,
}: {
  onSubmit: (email: string, password: string) => Promise<void>;
  onSwitch: () => void;
}) {
  return <AuthForm mode="login" onSubmit={onSubmit} onSwitch={onSwitch} />;
}

export function RegisterScreen({
  onSubmit,
  onSwitch,
}: {
  onSubmit: (name: string, email: string, password: string) => Promise<void>;
  onSwitch: () => void;
}) {
  return <AuthForm mode="register" onSubmit={onSubmit} onSwitch={onSwitch} />;
}

type AuthFormProps = {
  onSwitch: () => void;
} & (
  | {
      mode: 'login';
      onSubmit: (email: string, password: string) => Promise<void>;
    }
  | {
      mode: 'register';
      onSubmit: (
        name: string,
        email: string,
        password: string,
      ) => Promise<void>;
    }
);

function RevealPassword({
  visible,
  onPress,
}: {
  visible: boolean;
  onPress: () => void;
}) {
  const Icon = visible ? EyeOff : Eye;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={visible ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
      onPress={onPress}
      style={styles.passwordToggle}
    >
      <Icon color={colors.muted} size={20} />
    </Pressable>
  );
}

function AuthForm(props: AuthFormProps) {
  const registering = props.mode === 'register';
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [passwordVisible, showPassword] = useState(false);
  const [confirmationVisible, showConfirmation] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const locked = useRef(false);
  const emailInput = useRef<TextInput>(null);
  const passwordInput = useRef<TextInput>(null);
  const confirmationInput = useRef<TextInput>(null);

  async function submit() {
    if (locked.current) {
      return;
    }

    const address = email.trim();
    const displayName = name.trim();
    if (registering && (displayName.length < 2 || displayName.length > 60)) {
      setError('Họ và tên cần có từ 2 đến 60 ký tự.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) {
      setError('Nhập địa chỉ email hợp lệ.');
      return;
    }
    if (registering && password.length < 6) {
      setError('Mật khẩu cần ít nhất 6 ký tự.');
      return;
    }
    if (!password) {
      setError('Nhập mật khẩu.');
      return;
    }
    if (registering && confirmation !== password) {
      setError('Hai mật khẩu chưa khớp.');
      return;
    }

    locked.current = true;
    setBusy(true);
    setError('');
    Keyboard.dismiss();
    try {
      if (props.mode === 'register') {
        await props.onSubmit(displayName, address, password);
      } else {
        await props.onSubmit(address, password);
      }
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : 'Thao tác chưa thành công. Hãy thử lại.',
      );
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        <Brand />
        <View style={[styles.hero, registering && styles.joinHero]}>
          <SignalArt color={colors.accentLine} />
          <Text
            accessibilityRole="header"
            style={[styles.heroTitle, registering && styles.joinTitle]}
          >
            {registering ? 'Tạo tài khoản' : 'Đăng nhập'}
          </Text>
          <Text style={styles.heroCaption}>
            {registering
              ? 'Tham gia Tần số bằng email.'
              : 'Mở hộp thư của bạn.'}
          </Text>
          <View pointerEvents="none" style={styles.heroCorner} />
        </View>
        <View style={styles.form}>
          {registering && (
            <FormField
              label="Họ và tên"
              placeholder="Nguyễn Minh Anh"
              value={name}
              maxLength={60}
              autoComplete="name"
              editable={!busy}
              onChangeText={setName}
              returnKeyType="next"
              submitBehavior="submit"
              onSubmitEditing={() => emailInput.current?.focus()}
            />
          )}
          <FormField
            label="Email"
            inputRef={emailInput}
            placeholder="ban@vidu.com"
            value={email}
            autoCapitalize="none"
            autoComplete="email"
            autoCorrect={false}
            keyboardType="email-address"
            editable={!busy}
            onChangeText={setEmail}
            returnKeyType="next"
            submitBehavior="submit"
            onSubmitEditing={() => passwordInput.current?.focus()}
          />
          <FormField
            label="Mật khẩu"
            inputRef={passwordInput}
            placeholder={registering ? 'Ít nhất 6 ký tự' : 'Nhập mật khẩu'}
            value={password}
            secureTextEntry={!passwordVisible}
            autoCapitalize="none"
            autoComplete={registering ? 'new-password' : 'current-password'}
            editable={!busy}
            onChangeText={setPassword}
            returnKeyType={registering ? 'next' : 'go'}
            submitBehavior={registering ? 'submit' : 'blurAndSubmit'}
            onSubmitEditing={
              registering ? () => confirmationInput.current?.focus() : submit
            }
            adornment={
              <RevealPassword
                visible={passwordVisible}
                onPress={() => showPassword(!passwordVisible)}
              />
            }
          />
          {registering && (
            <FormField
              label="Nhập lại mật khẩu"
              inputRef={confirmationInput}
              placeholder="Xác nhận mật khẩu"
              value={confirmation}
              secureTextEntry={!confirmationVisible}
              autoCapitalize="none"
              autoComplete="new-password"
              editable={!busy}
              onChangeText={setConfirmation}
              returnKeyType="go"
              onSubmitEditing={submit}
              adornment={
                <RevealPassword
                  visible={confirmationVisible}
                  onPress={() => showConfirmation(!confirmationVisible)}
                />
              }
            />
          )}
          {error ? (
            <Text accessibilityLiveRegion="polite" style={styles.error}>
              {error}
            </Text>
          ) : null}
          <ActionButton
            label={registering ? 'Tạo tài khoản' : 'Đăng nhập'}
            onPress={submit}
            loading={busy}
            icon={<ArrowRight color={colors.onAccent} size={20} />}
          />
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: busy }}
          onPress={props.onSwitch}
          disabled={busy}
          style={({ pressed }) => [styles.switch, pressed && styles.pressed]}
        >
          <Text style={styles.switchText}>
            {registering ? 'Đã có tài khoản? ' : 'Chưa có tài khoản? '}
            <Text style={styles.switchLink}>
              {registering ? 'Đăng nhập' : 'Đăng ký'}
            </Text>
          </Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.canvas, flex: 1 },
  scroll: {
    alignSelf: 'center',
    flexGrow: 1,
    gap: space.xl,
    maxWidth: 520,
    paddingHorizontal: space.xl,
    paddingVertical: space.xl,
    width: '100%',
  },
  hero: {
    backgroundColor: colors.accent,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 12,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 40,
    gap: space.xs,
    justifyContent: 'flex-end',
    minHeight: 148,
    overflow: 'hidden',
    paddingBottom: space.xl,
    paddingLeft: space.xl,
    paddingRight: space.lg,
    paddingTop: space.xxl,
  },
  joinHero: { minHeight: 100, paddingBottom: space.lg, paddingTop: space.lg },
  heroTitle: { ...type.display, color: colors.onAccent },
  joinTitle: type.title,
  heroCaption: { ...type.body, color: colors.onAccent },
  heroCorner: {
    backgroundColor: colors.canvas,
    height: 36,
    position: 'absolute',
    right: -34,
    top: -13,
    transform: [{ rotate: '45deg' }],
    width: 72,
  },
  form: { gap: space.md },
  passwordToggle: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    width: 48,
  },
  error: { ...type.body, color: colors.error },
  switch: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    paddingVertical: space.sm,
  },
  switchText: { ...type.body, color: colors.muted, textAlign: 'center' },
  switchLink: { color: colors.accent, fontFamily: fonts.semibold },
  pressed: { opacity: 0.65 },
});
