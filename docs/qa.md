# Kiểm thử TH05

| Hạng mục | Cách kiểm tra |
| --- | --- |
| TypeScript và lint | npm run typecheck, npm run lint |
| Firebase Rules | npm run test:firebase hoặc node --test tests/firebase.test.mjs khi Emulator đã chạy |
| Giao diện và bo góc viên thuốc | Kiểm tra bo góc viên thuốc (pill shape: 999/28-32) trên các ô input, nút bấm, avatar, row, bubble; kiểm tra bỏ border ở các ô; kiểm tra thanh nav màu trắng full xuống dưới với chiều cao 84dp, bo góc cạnh trên (radius 28), icon tab đang chọn dạng viên thuốc (54x32, r=16) đồng tâm song song với độ cong cạnh trên; kiểm tra icon launcher là logo 3 vạch Tần số (`#D6F34B` trên `#0C0D0A`) |
| Hộp thư & Danh bạ kiểu Messenger | Kiểm tra màn Hộp thư hiển thị số người đang trực tuyến cùng hàng ở bên phải dòng `Cuộc trò chuyện`; màn Danh bạ có tên app `TANSO`, thanh tìm kiếm pill không nhãn, dải avatar vuốt ngang và danh sách avatar xếp dọc, bỏ tiêu đề lớn `Danh bạ` và tiêu đề phụ `Người dùng` |
| Android | Dựng APK rồi cài vào hai Android emulator với hai phiên tài khoản khác nhau |
| Vị trí | Đặt GPS máy ảo bằng adb emu geo fix với kinh độ trước vĩ độ, cấp quyền tại composer; kiểm tra khi từ chối quyền hoặc tắt định vị trên máy thì hiện hộp thoại xin quyền / mở Cài đặt vị trí và không hiện dòng lỗi đỏ |
| Liên kết & xem trước link | Gửi URL đầy đủ (`https://...`) và URL rút gọn (`vnexpress.net`, `youtu.be/...`) để kiểm tra trạng thái tải, sau khi tải xong ẩn dòng URL thô và hiển thị thẻ xem trước trực tiếp không ô bao ngoài (ảnh, logo/tên miền, tiêu đề, mô tả), đồng thời kiểm tra tin nhắn đối phương có Avatar cạnh bong bóng chat |
| Trạng thái đang nhập | Khi một máy đang nhập trong ô soạn thảo, máy đối phương thấy bong bóng 3 chấm chuyển động (không kèm chữ) ở cuối luồng chat; Header Chat, Hộp thư và Danh bạ giữ nguyên trạng thái trực tuyến/tin cuối; tự tắt khi xóa trống, gửi tin, mất focus, rời phòng hoặc sau 12 giây không gõ |
| Ẩn/hiện thời gian & thanh cuộn Chat | Mặc định ẩn giờ gửi bên trong bong bóng tin nhắn, bong bóng vị trí và thẻ xem trước liên kết; ấn vào tin nhắn để bật/tắt mốc thời gian căn giữa phía trên tin nhắn (giống Messenger); ấn tiêu đề nguồn/mũi tên hoặc nhấn giữ thẻ liên kết để mở URL; ấn biểu tượng bản đồ/mũi tên hoặc nhấn giữ bong bóng vị trí để mở bản đồ; kiểm tra thanh cuộn dọc ở màn Chat được ẩn hoàn toàn |
| Firebase Console | Dùng tab Data của APPTH05, mở chats và cặp UID để thấy dữ liệu đã gửi |
| Video | Ghi hai thiết bị cùng khung 1–2 phút, cho thấy gửi/nhận và badge cập nhật |

## Kết quả đã xác nhận

- Windows, Node 24.15.0, JDK 21, Android API 36 x86_64. TypeScript (`npm run typecheck`) và ESLint (`npm run lint`) đạt với 0 lỗi, 0 cảnh báo.
- Đã cập nhật bong bóng đang nhập chỉ giữ 3 chấm chuyển động (bỏ chữ `Đang nhập…` ở bong bóng, Header Chat, Hộp thư và Danh bạ); khi gửi vị trí lúc chưa cấp quyền hoặc tắt định vị sẽ mở hộp thoại xin quyền / mở cài đặt vị trí thay vì hiện dòng lỗi đỏ; ẩn thanh cuộn dọc ở màn Chat (`showsVerticalScrollIndicator={false}`); và ẩn giờ gửi khỏi bong bóng/thẻ xem trước, chỉ hiện căn giữa phía trên tin nhắn khi ấn vào (giống Messenger).
- Ngôn ngữ thiết kế: Đã chuyển đổi bo góc các phần tử sang dạng bo góc viên thuốc (radius.pill = 999), loại bỏ hoàn toàn border ở các ô nhập liệu/hàng/thẻ/bubble/status. Thanh bottom navigation bar màu trắng (#FFFFFF), chiều cao 84dp thoáng đãng khỏi thanh điều hướng hệ thống, trải full bề ngang và sát mép đáy màn hình, bo cong đồng tâm ở 2 góc trên (`borderTopLeftRadius, borderTopRightRadius: 28`), không viền. Icon tab đang chọn được bọc trong viên thuốc lime (54x32dp, radius.pill với cung đầu r = 16dp) uốn cong đồng tâm song song với đường bo cạnh trên thanh nav, bảo toàn 100% nội dung 4 tab và màu sắc biểu tượng đặc trưng.
- Đã thay biểu tượng ứng dụng Android (Adaptive Icon XML + PNG các mật độ `mdpi`–`xxxhdpi`) sang logo Tần số (`#D6F34B` trên nền `#0C0D0A`), đổi giao diện Danh bạ sang bố cục Messenger (tên app, ô tìm kiếm không nhãn, dải avatar vuốt ngang, danh sách dọc; bỏ chữ `Danh bạ` lớn và chữ `Người dùng`), và chuyển số người đang trực tuyến sang cùng hàng bên phải `Cuộc trò chuyện` ở màn Hộp thư.
- Gradle chạy thành công lệnh `gradlew.bat :app:assembleDebug` sau khi cập nhật icon và giao diện mới, cài lại qua ADB lên thiết bị/máy ảo kết nối.
- Firebase Emulator đạt 2/2 ca tích hợp. Bao gồm quyền đọc/ghi, dữ liệu hợp lệ, fan-out nguyên tử, listener của hai người dùng và onDisconnect.
- Web client và RTDB Singapore đã được cấu hình trên dự án APPTH05. Kiểm tra truy cập ẩn danh vào danh bạ trả về Permission denied.
- Màn Thông báo TH04 và mẫu Rules đi kèm đề cần đầu vào gốc để đối chiếu. Build và các quyền hệ thống iOS cần được xác nhận trên macOS.
