# Tần số · B23DCCC097 · TH05

Ứng dụng Android/iOS viết bằng React Native CLI và TypeScript. Đăng ký, danh bạ, chat cá nhân, hộp thư và chia sẻ tọa độ dùng Firebase Authentication và Realtime Database.

## Chạy Android

Cần Node.js 22.11 trở lên, JDK 17 hoặc 21, Android SDK Platform 36, Build Tools 36.0.0 và NDK 27.1.12297006. Bật một thiết bị Android hoặc máy ảo, sau đó chạy hai terminal từ thư mục này.

```powershell
npm ci
npm start -- --host 127.0.0.1
```

```powershell
adb reverse tcp:8081 tcp:8081
npm run android
```

Khi chạy hai thiết bị, dùng adb -s để chọn máy và đảo port cho từng máy. Có thể dùng Android Studio Device Manager hoặc khởi động hai instance của cùng AVD với -read-only ở cả hai lệnh. App mặc định dùng Firebase APPTH05 vùng Singapore. Cấu hình Web client ở [src/services/firebaseConfig.ts](src/services/firebaseConfig.ts). Dựng iOS trên macOS bằng CocoaPods và Xcode, sau đó chạy npm run ios.

## Firebase Emulator

Chuyển useEmulator thành true trong [firebaseConfig.ts](src/services/firebaseConfig.ts), khởi động Firebase Emulator bằng npm run firebase:emulators và reverse hai cổng.

```powershell
adb reverse tcp:9000 tcp:9000
adb reverse tcp:9099 tcp:9099
```

Firebase Emulator UI ở http://127.0.0.1:4000. Chạy npm run test:firebase khi các cổng Emulator đang trống. Nếu Emulator đã chạy, dùng node --test tests/firebase.test.mjs để kiểm thử cùng instance cục bộ. Test tạo tài khoản và dữ liệu giả trong môi trường demo.

## Tài liệu

- [Đặc tả và điều kiện nghiệm thu](docs/spec.md)
- [Kiến trúc, lưu đồ dữ liệu và Firebase](docs/architecture.md)
- [Design system và nguồn thư viện](docs/design-system.md)
- [Kế hoạch triển khai](docs/plan.md)
- [Kết quả kiểm thử và minh chứng](docs/qa.md)
- [Quy tắc đồng bộ tài liệu](AGENTS.md)
