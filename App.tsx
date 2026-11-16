import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { DarkTheme, NavigationContainer } from '@react-navigation/native';
import {
  createNativeStackNavigator,
  type NativeStackScreenProps,
} from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import {
  Bell,
  ContactRound,
  MessagesSquare,
  Settings2,
} from 'lucide-react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import type { User } from 'firebase/auth';
import { LoginScreen, RegisterScreen } from './src/screens/AuthScreens';
import {
  ContactsScreen,
  HomeScreen,
  NotificationsScreen,
  SettingsScreen,
} from './src/screens/MainScreens';
import { ChatScreen } from './src/screens/ChatScreen';
import {
  authError,
  ensureProfile,
  login,
  logout,
  register,
  subscribeAuth,
} from './src/services/auth';
import {
  startPresence,
  subscribeConversations,
  subscribeDirectory,
  type Conversation,
  type Profile,
} from './src/services/chat';
import { colors, fonts, radius } from './src/ui/theme';

type AuthRoutes = { Login: undefined; Register: undefined };
type MainRoutes = { Inbox: undefined; Chat: { peerId: string } };
type Tabs = {
  Home: undefined;
  Contacts: undefined;
  Notifications: undefined;
  Settings: undefined;
};
type Live<T> = { data: T[]; loading: boolean; error?: string };

const AuthStack = createNativeStackNavigator<AuthRoutes>();
const MainStack = createNativeStackNavigator<MainRoutes>();
const Tab = createBottomTabNavigator<Tabs>();
const stackOptions = {
  headerShown: false,
  contentStyle: { backgroundColor: colors.canvas },
};
const theme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: colors.accent,
    background: colors.canvas,
    card: colors.canvas,
    text: colors.text,
    border: 'transparent',
    notification: colors.accent,
  },
};

async function submit(action: () => Promise<unknown>) {
  try {
    await action();
  } catch (error) {
    throw new Error(authError(error));
  }
}

function AuthNavigator() {
  return (
    <AuthStack.Navigator screenOptions={stackOptions}>
      <AuthStack.Screen name="Login">
        {({ navigation }) => (
          <LoginScreen
            onSubmit={(email, password) => submit(() => login(email, password))}
            onSwitch={() => navigation.navigate('Register')}
          />
        )}
      </AuthStack.Screen>
      <AuthStack.Screen name="Register">
        {({ navigation }) => (
          <RegisterScreen
            onSubmit={(name, email, password) =>
              submit(() => register(name, email, password))
            }
            onSwitch={navigation.goBack}
          />
        )}
      </AuthStack.Screen>
    </AuthStack.Navigator>
  );
}

function dockIcon(Icon: typeof Bell) {
  return ({ focused, color }: { focused: boolean; color: string }) => (
    <View style={[styles.tabIcon, focused && styles.tabIconActive]}>
      <Icon
        size={20}
        color={focused ? colors.onAccent : color}
        strokeWidth={2}
      />
    </View>
  );
}

const dock = {
  Home: { label: 'Hộp thư', icon: dockIcon(MessagesSquare) },
  Contacts: { label: 'Danh bạ', icon: dockIcon(ContactRound) },
  Notifications: { label: 'Thông báo', icon: dockIcon(Bell) },
  Settings: { label: 'Cài đặt', icon: dockIcon(Settings2) },
};

function MainNavigator({ user }: { user: User }) {
  const [people, setPeople] = useState<Live<Profile>>({
    data: [],
    loading: true,
  });
  const [inbox, setInbox] = useState<Live<Conversation>>({
    data: [],
    loading: true,
  });
  const uid = user.uid;

  useEffect(() => {
    const stopPresence = startPresence(uid);
    const stopPeople = subscribeDirectory(
      uid,
      data => setPeople({ data, loading: false }),
      () =>
        setPeople(previous => ({
          ...previous,
          loading: false,
          error: 'Chưa thể tải danh bạ.',
        })),
    );
    const stopInbox = subscribeConversations(
      uid,
      data => setInbox({ data, loading: false }),
      () =>
        setInbox(previous => ({
          ...previous,
          loading: false,
          error: 'Chưa thể tải hộp thư.',
        })),
    );
    return () => {
      stopPeople();
      stopInbox();
      stopPresence();
    };
  }, [uid]);

  const listStatus = {
    loading: inbox.loading || people.loading,
    error: inbox.error || people.error,
  };

  function renderChat({
    route,
    navigation,
  }: NativeStackScreenProps<MainRoutes, 'Chat'>) {
    const { peerId } = route.params;
    const peer = people.data.find(profile => profile.id === peerId) ?? {
      id: peerId,
      name: 'Người dùng',
      online: false,
    };
    return (
      <ChatScreen
        key={uid + '/' + peerId}
        uid={uid}
        peer={peer}
        onBack={navigation.goBack}
      />
    );
  }

  return (
    <MainStack.Navigator screenOptions={stackOptions}>
      <MainStack.Screen name="Inbox">
        {({ navigation }) => {
          const open = (peerId: string) =>
            navigation.navigate('Chat', { peerId });
          return (
            <Tab.Navigator
              safeAreaInsets={{ bottom: 0 }}
              screenOptions={({ route }) => {
                const { icon, label } = dock[route.name];
                return {
                  headerShown: false,
                  sceneStyle: styles.screen,
                  tabBarLabel: label,
                  tabBarActiveTintColor: colors.onAccent,
                  tabBarInactiveTintColor: '#8A907E',
                  tabBarLabelStyle: styles.tabLabel,
                  tabBarIconStyle: styles.tabIconSlot,
                  tabBarStyle: styles.tabBar,
                  tabBarHideOnKeyboard: true,
                  tabBarIcon: icon,
                };
              }}
            >
              <Tab.Screen name="Home">
                {({ navigation: tabs }) => (
                  <HomeScreen
                    conversations={inbox.data}
                    profiles={people.data}
                    onOpen={open}
                    onContacts={() => tabs.navigate('Contacts')}
                    {...listStatus}
                  />
                )}
              </Tab.Screen>
              <Tab.Screen name="Contacts">
                {() => (
                  <ContactsScreen
                    profiles={people.data}
                    onOpen={open}
                    loading={people.loading}
                    error={people.error}
                  />
                )}
              </Tab.Screen>
              <Tab.Screen name="Notifications">
                {() => (
                  <NotificationsScreen
                    conversations={inbox.data}
                    profiles={people.data}
                    onOpen={open}
                    {...listStatus}
                  />
                )}
              </Tab.Screen>
              <Tab.Screen name="Settings">
                {() => (
                  <SettingsScreen
                    name={user.displayName || 'Người dùng'}
                    email={user.email}
                    onLogout={() => submit(logout)}
                  />
                )}
              </Tab.Screen>
            </Tab.Navigator>
          );
        }}
      </MainStack.Screen>
      <MainStack.Screen name="Chat">{renderChat}</MainStack.Screen>
    </MainStack.Navigator>
  );
}

export default function App() {
  const [user, setUser] = useState<User | null>();
  const [readyUserId, setReadyUserId] = useState<string>();
  const [profileError, setProfileError] = useState(false);
  const [retry, setRetry] = useState(0);

  useEffect(() => subscribeAuth(setUser), []);
  useEffect(() => {
    let active = true;
    setReadyUserId(undefined);
    setProfileError(false);
    if (user) {
      ensureProfile(user).then(
        () => {
          if (active) setReadyUserId(user.uid);
        },
        () => {
          if (active) setProfileError(true);
        },
      );
    }
    return () => {
      active = false;
    };
  }, [user, retry]);

  let screen = <AuthNavigator />;
  if (user && readyUserId === user.uid) {
    screen = <MainNavigator key={user.uid} user={user} />;
  } else if (user !== null) {
    screen = (
      <View style={styles.center}>
        {profileError ? (
          <>
            <Text style={styles.error}>Chưa kết nối được hồ sơ.</Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => setRetry(value => value + 1)}
              style={styles.action}
            >
              <Text style={styles.actionText}>Thử lại</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={async () => {
                try {
                  await logout();
                } catch {
                  setRetry(value => value + 1);
                }
              }}
              style={styles.action}
            >
              <Text style={styles.actionText}>Đăng xuất</Text>
            </Pressable>
          </>
        ) : (
          <ActivityIndicator
            color={colors.accent}
            accessibilityLabel="Đang kết nối"
          />
        )}
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
        <StatusBar barStyle="light-content" />
        <NavigationContainer theme={theme}>{screen}</NavigationContainer>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  error: { fontFamily: fonts.semibold, color: colors.error, marginBottom: 16 },
  action: {
    minHeight: 48,
    paddingHorizontal: 16,
    justifyContent: 'center',
    borderRadius: radius.pill,
  },
  actionText: { fontFamily: fonts.semibold, color: colors.accent },
  tabBar: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    borderTopWidth: 0,
    borderWidth: 0,
    height: 84,
    paddingTop: 10,
    paddingBottom: 14,
    elevation: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
  },
  tabLabel: {
    fontFamily: fonts.semibold,
    fontSize: 10,
    marginTop: 4,
    marginBottom: 0,
  },
  tabIconSlot: {
    width: 54,
    height: 32,
  },
  tabIcon: {
    width: 54,
    height: 32,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabIconActive: { backgroundColor: colors.accent },
});
