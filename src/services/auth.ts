import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  type User,
} from 'firebase/auth';
import { get, ref, set } from 'firebase/database';
import { auth, database } from './firebase';
import { stopPresence } from './presence';

let creatingProfile: Promise<User> | undefined;

export function subscribeAuth(onUser: (user: User | null) => void) {
  return onAuthStateChanged(auth, onUser);
}

export async function register(name: string, email: string, password: string) {
  const displayName = name.trim();
  if (displayName.length < 2 || displayName.length > 60) {
    throw new Error('Họ tên cần có từ 2 đến 60 ký tự.');
  }

  const registration = (async () => {
    const { user } = await createUserWithEmailAndPassword(
      auth,
      email.trim(),
      password,
    );

    await updateProfile(user, { displayName });
    await set(ref(database, `profiles/${user.uid}`), { name: displayName });
    return user;
  })();

  creatingProfile = registration;
  try {
    return await registration;
  } finally {
    if (creatingProfile === registration) {
      creatingProfile = undefined;
    }
  }
}

export function login(email: string, password: string) {
  return signInWithEmailAndPassword(auth, email.trim(), password);
}

export async function ensureProfile(user: User) {
  if (creatingProfile && (await creatingProfile).uid === user.uid) {
    return;
  }

  const profile = ref(database, `profiles/${user.uid}`);
  if (!(await get(profile)).exists()) {
    const displayName = user.displayName?.trim();
    const name =
      displayName && displayName.length >= 2
        ? displayName.slice(0, 60)
        : 'Người dùng';
    await set(profile, { name });
  }
}

export async function logout() {
  try {
    await stopPresence();
  } finally {
    await signOut(auth);
  }
}

export function authError(error: unknown) {
  const code =
    error && typeof error === 'object' && 'code' in error ? error.code : '';
  switch (code) {
    case 'auth/invalid-email':
      return 'Email chưa đúng định dạng.';
    case 'auth/email-already-in-use':
      return 'Email này đã được đăng ký.';
    case 'auth/weak-password':
      return 'Mật khẩu cần ít nhất 6 ký tự.';
    case 'auth/invalid-credential':
    case 'auth/user-not-found':
    case 'auth/wrong-password':
      return 'Email hoặc mật khẩu không đúng.';
    case 'auth/user-disabled':
      return 'Tài khoản này đã bị vô hiệu hóa.';
    case 'auth/too-many-requests':
      return 'Bạn đã thử quá nhiều lần. Vui lòng thử lại sau.';
    case 'auth/network-request-failed':
      return 'Bạn đang mất kết nối. Kiểm tra mạng rồi thử lại.';
    default:
      return 'Chưa thể hoàn tất thao tác. Vui lòng thử lại.';
  }
}
