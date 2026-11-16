# Đặc tả TH05 · Tần số

## Phạm vi và nguồn

Ảnh 1 là đề bài và là căn cứ nghiệm thu. Ảnh 2 là tham chiếu thị giác. Ứng dụng là chat cá nhân React Native CLI bằng TypeScript, với React Navigation, Firebase JS SDK Auth/Realtime Database và geolocation. Ảnh đề bài nhắc bộ Rules được cung cấp và màn Thông báo của Bài 4. Hai nguồn này chưa có trong thư mục dự án. Dùng Rules của dự án để kiểm thử và dựng màn Thông báo tương thích với luồng chat trong lúc chờ đối chiếu.

| Mã | Luồng | Điều kiện nghiệm thu |
| --- | --- | --- |
| R1 | Đăng ký | Họ tên 2–60 ký tự sau trim, email, mật khẩu tối thiểu 6 ký tự và xác nhận giống nhau. Có thông báo lỗi và chặn gửi lặp. |
| R2 | Đăng nhập và Cài đặt | Sai thông tin có lỗi bằng tiếng Việt. Khôi phục phiên khi mở lại. Đăng xuất trong Cài đặt đưa về đăng nhập. |
| R3 | Danh bạ | Danh sách bỏ tài khoản hiện tại, bố cục gồm tên app `TANSO`, ô tìm kiếm không nhãn, dải avatar vuốt ngang và danh sách avatar xếp dọc (bỏ tiêu đề lớn "Danh bạ" và dòng "Người dùng"); tìm theo tên tiếng Việt có dấu hoặc không dấu, online/offline cập nhật trực tiếp. Chọn người để mở Chat. |
| R4 | Chat | Hai chiều realtime, tin của mình bên phải, giờ gửi mặc định ẩn để gọn ô tin nhắn và ấn vào tin nhắn để hiện căn giữa phía trên (giống Messenger), ẩn thanh cuộn dọc, chặn chuỗi rỗng, tự cuộn đến tin mới. Header có tên và trạng thái trực tuyến; hiển thị bong bóng 3 chấm đang nhập theo thời gian thực khi đối phương gõ. |
| R5 | Vị trí | Chỉ xin quyền khi bấm gửi vị trí. Khi chưa cấp quyền hoặc tắt dịch vụ vị trí, hiển thị hộp thoại xin quyền / mở cài đặt bật vị trí thay vì dòng lỗi đỏ. Tin vị trí mở tọa độ trong ứng dụng bản đồ. |
| R6 | Home | Avatar, tên, tin cuối, giờ; hiển thị số người đang trực tuyến cùng hàng ở bên phải dòng "Cuộc trò chuyện". Xếp mới nhất lên đầu. Tin mới vào khi phòng đóng tăng badge. Mở phòng xóa các tin đã quan sát, kể cả khi có tin đang đến. |
| R7 | Thông báo | Có tab riêng. Bản hiện tại liệt kê các cuộc trò chuyện chưa đọc và mở đúng phòng. Đối chiếu Bài 4 khi có mã gốc. |
| R8 | Nộp bài | Mã nguồn bỏ build, node_modules và Pods. Ảnh đăng ký, hộp thư có badge, danh bạ có người online, chat có vị trí, dữ liệu RTDB. Video 1–2 phút bằng hai máy. |

## Điều hướng và trạng thái

Auth stack có Login/Register. Khi đã xác thực và khởi tạo hồ sơ hoàn tất, app vào shell có Home, Contacts, Notifications, Settings với thanh bottom tab bar màu trắng (#FFFFFF), phủ kín xuống mép dưới màn hình, bo góc ở hai cạnh trên, không viền, giữ nguyên nội dung 4 tab và màu sắc biểu tượng đặc trưng. Giao diện toàn app đồng bộ ngôn ngữ bo góc viên thuốc (pill shape) cho ô nhập liệu, nút bấm, avatar tròn, hàng hội thoại và bong bóng tin nhắn; loại bỏ border ở các ô chức năng để bề mặt phẳng và hiện đại. Chat nhận peerId qua root native stack. Giữ phiên nhập khi thao tác gửi thất bại và hiển thị thao tác thử lại. Danh sách có loading, empty, error và nội dung tùy tình huống. Phòng chat dùng danh sách đảo chiều để cuộn trực tiếp tới tin mới, tải một cửa sổ tin gần đây trước, hỗ trợ xem lịch sử cũ.

## Đồng bộ tài liệu

Mỗi thay đổi tác động đến hành vi, hợp đồng dữ liệu, Rules, dependency, thiết lập build hoặc thiết kế phải cập nhật tài liệu tương ứng trong cùng thay đổi. ID R1–R8 đi theo các mục QA. Tài liệu mô tả trạng thái đã kiểm chứng bằng môi trường và lệnh thực tế.
