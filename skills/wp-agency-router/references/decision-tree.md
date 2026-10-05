# Phân Luồng Tác Vụ Agency (Decision Tree)

Tài liệu này hướng dẫn cách phân luồng các yêu cầu từ khách hàng hoặc team agency về đúng skill xử lý.

## 1. Nhận Diện Môi Trường & Bối Cảnh

Khi nhận được yêu cầu, hãy kiểm tra hệ thống file:
- **Child theme Flatsome:** Kiểm tra `style.css` có dòng `Template: flatsome`.
- **Full Site (chuẩn bị bàn giao):** Kiểm tra có thư mục `wp-content/` và file cấu hình cơ sở (thường là `wp-config.php`).

## 2. Các Tình Huống Cụ Thể (15 Ví Dụ)

Dưới đây là các ví dụ thực tế và cách chọn skill hoặc định tuyến. Tuyệt đối dùng tên giả lập như `acme_` hoặc `demo_site` khi thực hành.

### Thuộc Phạm Vi Pack Này (Agency & Flatsome)

1. **"Sửa lại giao diện di động bị vỡ trên trang chủ theme Flatsome"**
   => Chọn: `flatsome-css-architecture`
2. **"Tạo một section giới thiệu công ty ABC dùng UX Builder"**
   => Chọn: `flatsome-uxbuilder-design` (và `flatsome-css-architecture` nếu cần)
3. **"Viết thêm shortcode để hiển thị danh sách chi nhánh của Acme Booking"**
   => Chọn: `wordpress-functions-zero-hardcode`
4. **"Đóng gói web demo_site để gửi cho khách chạy trên hosting của họ"**
   => Chọn: `wordpress-packaging-handover`
5. **"Khách hàng báo giá sản phẩm trong functions.php đang bị fix cứng, hãy sửa lại"**
   => Chọn: `wordpress-functions-zero-hardcode`
6. **"Giúp mình backup database của dự án này và xoá các bản nháp"**
   => Chọn: `wordpress-packaging-handover`
7. **"CSS ở style.css đang rườm rà quá, gom lại cho gọn giúp mình"**
   => Chọn: `flatsome-css-architecture`
8. **"Làm cái layout banner trượt cho trang sản phẩm bằng Flatsome UX Builder"**
   => Chọn: `flatsome-uxbuilder-design`

### Chuyển Hướng Upstream (Ngoài Pack Này)

9. **"Mình muốn tạo một custom Gutenberg block cho dự án"**
   => Chuyển hướng: Upstream / nhóm Block (`wp-block-development`)
10. **"Code thêm một endpoint REST API để lấy dữ liệu bài viết"**
    => Chuyển hướng: Upstream / nhóm API (`wp-rest-api`)
11. **"Site chạy chậm quá, có cách nào optimize database hay autoload không?"**
    => Chuyển hướng: Upstream / nhóm Vận hành (`wp-performance`)
12. **"Set up môi trường wp-env để test thử plugin này"**
    => Chuyển hướng: Upstream / nhóm Môi trường (`wp-env`)
13. **"Viết một block theme dùng theme.json và các template part"**
    => Chuyển hướng: Upstream / nhóm Block theme (`wp-block-themes`)
14. **"Check xem plugin của mình có pass tiêu chuẩn lên WordPress.org chưa"**
    => Chuyển hướng: Upstream / nhóm Phát hành (`wp-plugin-directory-guidelines`)
15. **"Làm sao thêm tương tác frontend bằng Interactivity API?"**
    => Chuyển hướng: Upstream / nhóm API (`wp-interactivity-api`)

---
**Nhắc nhở:** Nếu skill upstream (`wordpress-router`) không khả dụng, hãy tự thực hiện bằng kiến thức sẵn có của bạn, không được chặn yêu cầu của người dùng.
