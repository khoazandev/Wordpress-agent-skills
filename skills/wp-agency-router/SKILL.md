---
name: wp-agency-router
description: "Use for agency/client WordPress work: Flatsome child themes and UX Builder pages, business-data code in functions.php (shortcodes, CPT, ACF, prices, bookings), and packaging/migrating/handing over a site to a client. Routes to the right skill in this pack; for other WordPress work (blocks, block themes, REST, WP-CLI, performance…) defers to the official `wordpress-router` if installed. Dùng cho site Flatsome, code functions.php dữ liệu nghiệp vụ, đóng gói/bàn giao web cho khách."
compatibility: "WordPress 6.0+, PHP 7.4+. Filesystem-based agent; no scripts required."
---

# Router Bàn Giao & Agency WordPress (`wp-agency-router`)

Router này giúp phân luồng các tác vụ WordPress đặc thù của agency (như dùng theme Flatsome, xử lý dữ liệu nghiệp vụ, và bàn giao dự án). **Lưu ý:** Skill này không bao trùm mọi tác vụ WordPress, nó chuyên biệt cho quy trình agency và sẽ nhường quyền xử lý cho các skill upstream khi cần.

Chi tiết phân luồng xem tại: [decision-tree.md](references/decision-tree.md).

## 1. Nhận Diện Nhanh (Không cần script)

Hãy đọc các file trong dự án để xác định ngữ cảnh:
- Nếu `style.css` có chứa `Template: flatsome`, đây là site sử dụng child theme Flatsome.
- Nếu có file `wp-config.php` và thư mục `wp-content/`, đây là một full site WordPress.

## 2. Định Tuyến Trong Pack

Phân luồng các yêu cầu vào 4 skill có sẵn trong gói:

- **flatsome-css-architecture**: Sử dụng khi cần viết CSS, responsive, chỉnh sửa layout, hoặc sửa lỗi hiển thị trên child theme Flatsome (`style.css`).
- **flatsome-uxbuilder-design**: Sử dụng khi cần dựng trang, thiết kế section, làm việc với UX Builder, hoặc xử lý các shortcode Flatsome như `[section]`, `[row]`, `[col]`, `[ux_text]`.
- **wordpress-functions-zero-hardcode**: Sử dụng khi cần viết hoặc sửa `functions.php`, shortcode tuỳ chỉnh, Custom Post Type (CPT), taxonomy, ACF, và các logic tính toán nghiệp vụ (giá, chi nhánh, trạng thái đặt chỗ...).
- **wordpress-packaging-handover**: Sử dụng khi cần đóng gói, backup, migrate, tạo script bàn giao (`setup.php`), hoặc search-replace URL cho khách hàng.

## 3. Định Tuyến Ngoài Pack (Upstream)

Đối với các yêu cầu không thuộc nhóm trên, hãy kiểm tra xem skill `wordpress-router` (của gói upstream) có được cài đặt hay không.
- Nếu **có**, hãy nhường quyền định tuyến cho `wordpress-router`.
- Nếu **không**, tuyệt đối không chặn người dùng. Hãy gợi ý phân luồng theo nhóm việc, sử dụng kiến thức chung hoặc các skill sau (ví dụ tại thời điểm viết):
  - **Block / block theme / pattern**: `wp-block-development`, `wp-block-themes`, `wp-patterns`
  - **API (REST, Interactivity, Abilities)**: `wp-rest-api`, `wp-interactivity-api`, `wp-abilities-api`
  - **Vận hành (WP-CLI, performance, PHPStan)**: `wp-wpcli-and-ops`, `wp-performance`, `wp-phpstan`
  - **Môi trường (wp-env, Playground, Blueprint)**: `wp-env`, `wp-playground`, `blueprint`
  - **Phát hành plugin (directory guidelines)**: `wp-plugin-development`, `wp-plugin-directory-guidelines`

*Lưu ý cài đặt upstream:* Nếu bạn đang dùng Claude Code, có thể chạy lệnh `/plugin marketplace add WordPress/agent-skills` để bổ sung. Với các agent khác, hãy tham khảo tài liệu tại https://github.com/WordPress/agent-skills.

## 4. Chuỗi Kiểm Tra Trước Bàn Giao

Nếu nhận được yêu cầu chuẩn bị bàn giao cho một dự án Flatsome, hãy thực hiện kiểm tra tuần tự theo chuỗi sau:
1. `wordpress-functions-zero-hardcode` (Loại bỏ giá trị cứng)
2. `flatsome-css-architecture` (Chuẩn hoá CSS)
3. `flatsome-uxbuilder-design` (Kiểm tra thiết kế trang)
4. `wordpress-packaging-handover` (Đóng gói cuối cùng)

## 5. Verification (Kiểm Chứng)

Trước khi thực hiện tác vụ, hãy tự đặt câu hỏi:
1. Yêu cầu này có thuộc về giao diện Flatsome, logic nghiệp vụ hay đóng gói không?
2. Nếu thuộc về Flatsome/agency, tôi đã chọn đúng 1 trong 4 skill cục bộ chưa?
3. Nếu không, tôi đã nhường quyền cho upstream `wordpress-router` (hoặc xử lý bằng kiến thức chung) đúng cách chưa?
