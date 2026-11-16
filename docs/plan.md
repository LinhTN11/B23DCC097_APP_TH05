# Kế hoạch triển khai và nghiệm thu

1. Điều phối dựng React Native CLI, cài dependency, tích hợp navigator, font native, Android và môi trường Firebase.
2. Subagent Firebase triển khai cấu hình Auth, presence, inbox/unread, chat, Rules cùng kiểm thử dữ liệu.
3. Subagent giao diện triển khai primitives, token, đăng nhập/đăng ký và các tab Home, Contacts, Settings, Notifications.
4. Subagent Chat triển khai màn Chat, trạng thái realtime, composer, vị trí, phân trang.
5. Tích hợp qua hook context, chạy TypeScript, lint, test, kiểm thử Rules, dựng Android. Kiểm thử qua hai phiên và lấy ảnh/video theo R8.

Các màn nhận props từ app điều phối. Avatar fallback sinh từ tên. Thành phần Firebase và UI giữ tách để kiểm thử độc lập. Lỗi production hoặc môi trường được ghi bằng kết quả quan sát và lệnh tái hiện trong tài liệu QA.

| Kiểm tra | Kỳ vọng |
| --- | --- |
| R1–R2 | Biểu mẫu hợp lệ, báo lỗi sai mật khẩu, khởi động lại giữ phiên, đăng xuất |
| R3 | Hai người thấy nhau, tìm kiếm không dấu, thoát phiên cập nhật presence |
| R4–R5 | Gửi và nhận không reload, vị trí có tọa độ thực của emulator, cập nhật trong cả hai chiều |
| R6 | Badge tăng khi đóng phòng, về 0 khi mở; gửi/đọc đồng thời không mất dấu |
| R7 | Tab cập nhật theo các cuộc trò chuyện chưa đọc |
| R8 | Có ảnh từng yêu cầu, ghi lại nguồn backend dùng trong minh chứng và video hai thiết bị |
