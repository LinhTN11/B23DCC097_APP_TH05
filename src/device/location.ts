import Geolocation from '@react-native-community/geolocation';
import {Alert, Linking, PermissionsAndroid, Platform} from 'react-native';

type Coordinates = {
  latitude: number;
  longitude: number;
};

async function openLocationSettings() {
  if (Platform.OS === 'android') {
    try {
      await Linking.sendIntent('android.settings.LOCATION_SOURCE_SETTINGS');
      return;
    } catch {
      // Fallback to app settings if the device blocks the location source intent.
    }
  }
  Linking.openSettings().catch(() => {});
}

function promptLocationPermission() {
  Alert.alert(
    'Cấp quyền vị trí',
    'Ứng dụng cần quyền truy cập vị trí để gửi định vị của bạn.',
    [
      {text: 'Để sau', style: 'cancel'},
      {
        text: 'Mở Cài đặt',
        onPress: () => {
          Linking.openSettings().catch(() => {});
        },
      },
    ],
  );
}

function promptEnableLocation() {
  Alert.alert(
    'Bật dịch vụ vị trí',
    'Thiết bị đang tắt định vị. Bạn có muốn mở Cài đặt để bật vị trí không?',
    [
      {text: 'Để sau', style: 'cancel'},
      {
        text: 'Bật vị trí',
        onPress: () => {
          openLocationSettings().catch(() => {});
        },
      },
    ],
  );
}

function readPosition(
  enableHighAccuracy: boolean,
  timeout: number,
  maximumAge: number,
): Promise<Coordinates> {
  return new Promise((resolve, reject) => {
    Geolocation.getCurrentPosition(
      ({coords: {latitude, longitude}}) => resolve({latitude, longitude}),
      error => reject(error),
      {enableHighAccuracy, timeout, maximumAge},
    );
  });
}

export async function getCurrentLocation(): Promise<Coordinates | null> {
  Geolocation.setRNConfiguration({
    skipPermissionRequests: true,
    authorizationLevel: 'whenInUse',
    enableBackgroundLocationUpdates: false,
    locationProvider: 'auto',
  });

  let highAccuracy = true;
  if (Platform.OS === 'android') {
    const fine = PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION;
    const coarse = PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION;
    const result = await PermissionsAndroid.requestMultiple([fine, coarse]);
    const {GRANTED} = PermissionsAndroid.RESULTS;
    highAccuracy = result[fine] === GRANTED;

    if (!highAccuracy && result[coarse] !== GRANTED) {
      promptLocationPermission();
      return null;
    }
  } else {
    const authorized = await new Promise<boolean>(resolve => {
      Geolocation.requestAuthorization(
        () => resolve(true),
        () => resolve(false),
      );
    });
    if (!authorized) {
      promptLocationPermission();
      return null;
    }
  }

  try {
    return await readPosition(highAccuracy, 6_000, 10_000);
  } catch {
    try {
      return await readPosition(false, 6_000, 60_000);
    } catch (error) {
      const code =
        error && typeof error === 'object' && 'code' in error
          ? Number((error as {code: unknown}).code)
          : 0;
      if (code === 1) {
        promptLocationPermission();
      } else {
        promptEnableLocation();
      }
      return null;
    }
  }
}

export async function openLocation({latitude, longitude}: Coordinates) {
  const coordinates = `${latitude},${longitude}`;
  const nativeUrl =
    Platform.OS === 'ios'
      ? `maps://?ll=${coordinates}&q=${encodeURIComponent('Vị trí')}`
      : `geo:${coordinates}?q=${coordinates}`;

  try {
    await Linking.openURL(nativeUrl);
  } catch {
    await Linking.openURL(
      `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
        coordinates,
      )}`,
    );
  }
}
