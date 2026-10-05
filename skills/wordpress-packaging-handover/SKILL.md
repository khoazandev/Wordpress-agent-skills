---
name: wordpress-packaging-handover
description: "Use when packaging, backing up, or handing over a WordPress project to a lead, client, or production server. Enforces complete parent+child theme bundling, dynamic wp-config URL detection (zero-hardcode subfolder/domain), safe serialized URL search-replace, multi-layer secure 1-click setup.php installer (token auth, self-locking, TTL), pre-handover clean-up (active_plugins whitelist, zero .bak files, zero raw design assets), and dual file-size reporting (binary Explorer MiB vs decimal MB). Dùng khi đóng gói, sao lưu, migrate hoặc bàn giao website WordPress cho khách."
compatibility: "Targets WordPress 5.8+ (PHP 7.4+). Works on Windows, Linux, and macOS."
---

# WordPress Packaging & Handover Standard

Quy chuẩn và công cụ tự động hóa toàn diện cho việc đóng gói, dọn dẹp, kiểm tra tính toàn vẹn và bàn giao dự án WordPress. Đảm bảo dự án có thể chạy ngay trên mọi môi trường (Localhost XAMPP/Laragon/Docker hoặc Hosting/VPS thực tế) mà không cần cấu hình thủ công phức tạp, không phát sinh lỗi vỡ giao diện (UX Builder/ACF), và tuân thủ các chuẩn mực bảo mật cao nhất.

---

### Yêu cầu (Requirements)
- Node.js >= 20
- PHP CLI và mysqldump được cấu hình qua biến môi trường (PHP_BIN, MYSQLDUMP_BIN, MYSQL_BIN), hoặc có trong PATH, hoặc nằm ở các thư mục chuẩn như XAMPP/Laragon/MAMP.

## Khi nào sử dụng (When to use)

Kích hoạt skill này trong các tình huống sau:
1. **Bàn giao dự án hoàn thiện cho khách hàng hoặc Team Lead:** Cần đóng gói mã nguồn, database, và bộ cài đặt chuẩn chỉ.
2. **Di chuyển website (Migration):** Chuyển website từ Localhost lên Staging/Production hoặc giữa các thư mục/tên miền khác nhau.
3. **Sao lưu nghiệm thu (Snapshot & Backup):** Đóng gói một mốc release ổn định của dự án để lưu trữ hoặc bàn giao nghiệm thu từng giai đoạn.
4. **Chuẩn hóa trước khi commit / zip:** Quét dọn file rác dev (`.bak*`, `.old`, `.log`, file thiết kế `.fig`/`.sketch`/`.psd`, log WooCommerce) trước khi đưa mã nguồn lên Git hoặc đóng file nén.

---

## 7 Nguyên Tắc Cốt Lõi & Cơ Chế Phòng Thủ (7 Core Policies)

### 1. Nguyên tắc Theme Cha - Theme Con (Parent/Child Theme Policy)
- **Vấn đề:** Khách hàng hoặc bên tiếp nhận giải nén gói website chỉ thấy child theme (`flatsome-child`), dẫn đến lỗi WordPress: *"The parent theme is missing. Please install the "flatsome" parent theme"*.
- **Chuẩn đóng gói:**
  - Tự động phân tích trường `Template: <parent-slug>` trong `style.css` của child theme.
  - Cung cấp 2 chế độ bản quyền:
    - `--parent-theme-mode=bundle` (Mặc định khi có quyền phân phối): Đóng gói đầy đủ cả parent theme và child theme vào gói zip website; đồng thời nén riêng `[parent].zip`, `[child].zip` và tạo thư mục `themes/` mở sẵn cho người dùng cài lẻ qua WP Admin.
    - `--parent-theme-mode=external-license` (Dành cho theme thương mại có giấy phép độc quyền): Tự động tách parent theme ra khỏi gói bàn giao, tạo sẵn tài liệu hướng dẫn khách hàng mua/kích hoạt theme bản quyền (`LICENSE_NOTICE.txt` và `PARENT_THEME_INSTRUCTIONS.txt`).

### 2. Cấu hình Dynamic URL (Zero Hard-Coded Subfolder/Domain)
- **Vấn đề:** Gán cứng `define('WP_HOME', 'http://localhost/demo_site')` sẽ gây vỡ web khi client đổi tên thư mục (ví dụ `demo_site_v2`) hoặc deploy lên IP mạng LAN / domain thật.
- **Giải pháp:** Nhúng đoạn mã nhận diện giao thức (`HTTPS`/`HTTP`), host và subfolder tự động vào `wp-config.php`:
  ```php
  // DYNAMIC SITE URL & HOME
  if ( ! defined( 'WP_HOME' ) ) {
      $protocol = ( ! empty( $_SERVER['HTTPS'] ) && $_SERVER['HTTPS'] !== 'off' || ( isset( $_SERVER['SERVER_PORT'] ) && $_SERVER['SERVER_PORT'] == 443 ) ) ? "https://" : "http://";
      $host = isset( $_SERVER['HTTP_HOST'] ) ? $_SERVER['HTTP_HOST'] : 'localhost';
      $script_dir = str_replace( '\\', '/', dirname( $_SERVER['SCRIPT_NAME'] ?? '' ) );
      $subfolder = ( $script_dir === '/' || $script_dir === '.' ) ? '' : '/' . trim( explode( '/', trim( $script_dir, '/' ) )[0] ?? '', '/' );
      define( 'WP_HOME', rtrim( $protocol . $host . $subfolder, '/' ) );
  }
  if ( ! defined( 'WP_SITEURL' ) ) {
      define( 'WP_SITEURL', WP_HOME );
  }
  ```

### 3. Thay thế an toàn dữ liệu tuần tự hóa (Safe Serialized URL Replacer)
- **Vấn đề:** Thay thế URL dạng chuỗi thô (`REPLACE(col, 'old', 'new')`) làm sai lệch độ dài byte `s:len:"value";` trong chuỗi PHP serialized của WordPress (Flatsome UX Builder, Elementor, ACF, Customizer, Widget settings), khiến PHP `unserialize()` thất bại và vỡ toàn bộ layout giao diện.
- **Giải pháp:** Sử dụng thuật toán đệ quy chuẩn hóa byte-length (`safeReplaceSerialized`):
  - Phân tích và nhận diện chính xác các block `s:length:"string";`.
  - Tính toán độ dài chuỗi mới theo UTF-8 byte length (hỗ trợ tiếng Việt có dấu).
  - Tự động đệ quy qua các cấu trúc mảng (`a:n:{...}`) và đối tượng (`O:n:"cls":n:{...}`).

### 4. Phòng thủ 5 tầng cho bộ cài đặt tự động (`setup.php`)
- **Vấn đề:** Một file cài đặt `setup.php` nằm hớ hênh trên server là lỗ hổng bảo mật nghiêm trọng (RCE, ghi đè DB, tạo backdoor admin) nếu không được kiểm soát.
- **5 Lớp Bảo Mật Được Áp Dụng:**
  1. **Khóa Bí Mật Ngẫu Nhiên (Auth Token):** Mỗi lần đóng gói sinh một token 16 ký tự hexa ngẫu nhiên bảo mật cao (`crypto.randomBytes(8)`). Chỉ người nắm token URL (`setup.php?key=<token>`) hoặc nhập tay mã xác thực mới được phép kích hoạt.
  2. **Tự Động Khóa / Chống Tái Chạy (Self-Locking Anti-Replay):** Nếu phát hiện `wp-config.php` đã có kết nối DB thành công và bảng `wp_options` đã có dữ liệu, script lập tức từ chối và khóa vĩnh viễn: *"Trang web đã được cài đặt và kích hoạt bảo vệ. Không thể chạy lại bộ cài."*
  3. **Thời Hạn Sống Tự Động (24-Hour TTL):** Bộ cài tự động hết hạn và từ chối hoạt động sau 24 giờ kể từ thời điểm đóng gói, ngăn chặn việc file bị lãng quên trên host.
  4. **Tự Hủy 3 Cấp (3-Tier Windows/Apache Unlink Fallback):**
     - Cấp 1: Thử gọi `unlink(__FILE__)`.
     - Cấp 2: Nếu Windows/Apache giữ file handle khiến `unlink` thất bại, tự động đổi tên thành `setup-locked-{hash}.php.bak`.
     - Cấp 3: Xuất hướng dẫn xóa file thủ công kèm cảnh báo đỏ trong giao diện nếu cả 2 cách trên gặp sự cố quyền hạn.
  5. **Tích hợp Serialized Replacer thuần PHP:** Bộ cài tự động thực hiện search-replace an toàn ngay sau khi import database mà không cần người dùng thao tác lệnh.

### 5. Cơ chế Dump Database Đa Tầng (mysqldump CLI + PHP PDO Fallback)
- **Vấn đề:** Nhiều môi trường shared hosting hoặc server bị tắt hàm `exec()` / `system()`, khiến việc gọi `mysqldump` CLI bị chặn.
- **Cơ chế:**
  - Tầng 1: Sử dụng `mysqldump` CLI với các cờ tối ưu hóa: `--quick`, `--single-transaction`, `--default-character-set=utf8mb4`.
  - Tầng 2: Nếu lệnh CLI thất bại hoặc thiếu quyền, tự động kích hoạt script PHP PDO thuần túy nhúng sẵn để truy vấn cấu trúc bảng (`SHOW CREATE TABLE`) và trích xuất dữ liệu theo từng chunk 500 dòng an toàn bộ nhớ.
  - Tự động dọn dẹp bảng rác trước khi dump: transients hết hạn (`_transient_*`), log ActionScheduler cũ (`actionscheduler_logs`), revision bài viết thừa.

### 6. Bộ Dọn Dẹp Thông Minh & Đối Chiếu Whitelist Plugin
- **Vấn đề:** Xóa bừa các plugin không hoạt động hoặc xóa theo danh sách cứng có thể làm mất dữ liệu của plugin quan trọng mà khách hàng đang tạm tắt.
- **Cơ chế:**
  - Truy vấn danh sách `active_plugins` trực tiếp từ database (bảng `wp_options`).
  - Chỉ xóa các plugin inactive khi dev chỉ định rõ cờ `--clean-inactive-plugins`.
  - Tự động quét và loại bỏ 100% rác phát triển:
    - File sao lưu tạm: `*.bak*`, `*.old`, `*.swp`, `*~`, `*.tmp`.
    - File thiết kế gốc: `*.fig`, `*.sketch`, `*.psd`, `*.ai`, `*.xd`.
    - Log hệ thống: `wp-content/uploads/wc-logs/`, `debug.log`.
    - Git & Editor metadata: `.git/`, `.vscode/`, `.idea/`.

### 7. Báo Cáo Kích Thước File Chuẩn Kép (Dual File-Size Reporting)
- **Vấn đề:** Báo cáo dung lượng theo chuẩn thập phân (136.7 MB = $136.7 \times 10^6$ bytes) thường gây hiểu lầm khi khách hàng kiểm tra bằng Windows Explorer (hiển thị 130.3 MB vì dùng chuẩn nhị phân $1 \text{ MiB} = 1,048,576 \text{ bytes}$).
- **Quy tắc:** Bắt buộc luôn hiển thị song song cả 2 chuẩn trong mọi báo cáo và bảng nghiệm thu:
  - **Windows Explorer:** Định dạng nhị phân Base-2 (`MiB` / `KiB`).
  - **Chuẩn Quốc Tế:** Định dạng thập phân Base-10 (`MB` / `KB`).
  - Kèm theo số byte chính xác: `130.00 MiB / 136.31 MB (136,314,880 bytes)`.

---

## Bảng Đối Chiếu File Rác vs File Bắt Buộc Giữ

| Hạng Mục | Bắt Buộc Giữ (Whitelist) | Bắt Buộc Loại Bỏ (Blacklist) |
|---|---|---|
| **Theme** | Parent theme (`flatsome`), Child theme (`flatsome-child`), file `style.css` gốc | `style.css.bak*`, `functions.php.old`, folder theme thừa không dùng |
| **Plugin** | Các plugin có tên trong `active_plugins` (kể cả WooCommerce, Akismet, ACF...) | Plugin dev test tạm thời, thư mục plugin rỗng, log nội bộ |
| **Uploads** | Toàn bộ hình ảnh, tài liệu thực tế của website (`wp-content/uploads/`) | `wc-logs/`, file backup database cũ nằm trong uploads, cache plugin |
| **Config** | `wp-config.php` đã chèn Dynamic URL & Salts bảo mật, `.htaccess` chuẩn | File config nháp (`wp-config.php.bak`, `wp-config-local.php`) |
| **Thiết kế** | Web assets đã xuất bản (SVG, PNG, WebP, CSS, JS) | File thiết kế gốc nặng hàng trăm MB (`*.fig`, `*.psd`, `*.ai`) |
| **Root/Hệ thống**| WordPress Core sạch, `setup.php`, `database.sql` | `.git/`, `.gitignore`, `.editorconfig`, `.vscode/`, `.idea/`, `node_modules/` |

---

## Hướng Dẫn Sử Dụng CLI (`handover.mjs`)

Module chính được đặt tại:
`<skill-dir>/scripts/handover.mjs`

*(Chú thích: `<skill-dir>` là thư mục cài đặt skill, ví dụ `~/.claude/skills/wordpress-packaging-handover`, `~/.codex/skills/...`, `~/.gemini/config/skills/...` hoặc `.agents/skills/...` nếu cài theo plugin)*

### Cú pháp cơ bản
```bash
node "<skill-dir>/scripts/handover.mjs" [flags]
```

### Các cờ hỗ trợ (Flags)

| Cờ | Mặc định | Mô tả |
|---|---|---|
| `--path=<dir>` | Thư mục hiện tại (`cwd`) | Đường dẫn thư mục gốc WordPress cần đóng gói |
| `--output=<dir>` | `<path>/dong_goi_du_an` | Thư mục lưu trữ các file gói bàn giao |
| `--parent-theme-mode=<mode>` | `bundle` | Chế độ đóng gói theme cha: `bundle` hoặc `external-license` |
| `--regenerate-salts` | `false` | Tự động sinh mới 8 khóa bảo mật 64-ký tự ngẫu nhiên trong `wp-config.php` |
| `--clean-inactive-plugins`| `false` | Đối chiếu DB và xóa các plugin không kích hoạt |
| `--skip-clean` | `false` | Bỏ qua bước quét dọn file rác |
| `--skip-db` | `false` | Bỏ qua bước dump database (khi đã có sẵn file SQL) |
| `--themes-only` | `false` | Chỉ đóng gói theme cha và theme con |
| `--auth-token=<token>` | Tự sinh (16 ký tự hexa) | Chỉ định Secret Auth Token tùy chỉnh cho `setup.php` |
| `--php-fallback-dump` | `false` | Ép buộc sử dụng PHP PDO dump thay vì `mysqldump` CLI |
| `--dry-run` | `false` | Chạy giả lập: kiểm tra cấu hình, dự toán dung lượng mà không ghi/xóa file |
| `--help` | - | Hiển thị bảng trợ giúp đầy đủ |

### Ví dụ Thực Chiến

#### 1. Đóng gói hoàn chỉnh dự án Localhost chuẩn bị bàn giao
```bash
node "<skill-dir>/scripts/handover.mjs" \
  --path="C:\xampp\htdocs\demo_site" \
  --regenerate-salts \
  --parent-theme-mode=bundle
```

#### 2. Đóng gói cho theme thương mại (Không kèm mã nguồn theme cha)
```bash
node "<skill-dir>/scripts/handover.mjs" \
  --path="/var/www/demo_site" \
  --parent-theme-mode=external-license
```

#### 3. Chạy giả lập kiểm tra tính an toàn trước khi chạy thật
```bash
node "<skill-dir>/scripts/handover.mjs" \
  --path="/var/www/demo_site" \
  --dry-run
```

---

## Cấu Trúc Gói Bàn Giao Đầu Ra (Output Directory)

Thư mục đầu ra mặc định (`dong_goi_du_an/`) sẽ bao gồm:
```
dong_goi_du_an/
├── [Project]_Full_Website.zip    # Bản nén toàn bộ mã nguồn website sạch + database + setup.php
├── [Project].zip                 # Bản nén gọn danh cho khách hàng cài đặt
├── [parent-theme].zip            # Theme cha gốc (ví dụ: flatsome.zip)
├── [child-theme].zip             # Theme con sạch không file rác (ví dụ: flatsome-child.zip)
├── themes/                       # Thư mục giải nén sẵn chứa cả 2 theme để copy nhanh
│   ├── flatsome/
│   └── flatsome-child/
├── custom-plugins/               # Các plugin tự viết/tùy biến (nếu có)
│   └── [custom-plugin].zip
├── database.sql                  # Bản dump database đã dọn sạch rác và tối ưu UTF-8
├── setup.php                     # Bộ cài đặt tự động 1-click bảo mật 5 lớp
├── README_CAI_DAT.txt            # Hướng dẫn cài đặt chi tiết cho người nhận
└── LICENSE_NOTICE.txt            # Thông cáo bản quyền theme (khi bật external-license)
```

---

## Quy Trình Cài Đặt 1-Click Phía Người Nhận (Installer Flow)

1. Giải nén toàn bộ file vào thư mục web (ví dụ `C:\xampp\htdocs\du_an_moi` hoặc thư mục `public_html` của hosting).
2. Tạo trước cơ sở dữ liệu MySQL rỗng (hoặc để `setup.php` tự động tạo).
3. Mở trình duyệt truy cập đường dẫn kèm token do CLI cung cấp:
   `http://localhost/du_an_moi/setup.php?key=<AUTH_TOKEN>`
4. Nhập thông tin kết nối Database và nhấn **"Bắt đầu cài đặt"**.
5. Hệ thống tự động:
   - Cập nhật thông số DB vào `wp-config.php`.
   - Nạp toàn bộ dữ liệu từ `database.sql`.
   - Chạy bộ thay thế dữ liệu serialized chuẩn xác để đồng bộ URL mới.
   - Kích hoạt cơ chế tự hủy an toàn để xóa bỏ `setup.php`.
6. Đăng nhập ngay vào trang quản trị WordPress theo thông tin tài khoản admin mặc định.

---

## Checklist Nghiệm Thu Bắt Buộc Trước Khi Giao Khách (Verification Checklist)

Trước khi gửi gói zip cho khách hàng, chuyên viên kỹ thuật cần kiểm tra:

- [ ] **Không có lỗi Parent Theme Missing:** Gói zip hoặc thư mục bàn giao có đầy đủ theme cha hoặc hướng dẫn giấy phép.
- [ ] **Dynamic URL hoạt động:** Thử đổi tên thư mục gốc trên Localhost (ví dụ `test_web`), web vẫn truy cập được không bị vỡ stylesheet/ảnh.
- [ ] **Không lỗi UX Builder / ACF:** Đăng nhập WP Admin, mở UX Builder chỉnh sửa một trang bất kỳ. Toàn bộ element, banner, slider vẫn hiển thị mượt mà (chứng minh serialized data không bị hỏng).
- [ ] **Không có file rác:** Kiểm tra kích thước file và danh sách bên trong zip, không tồn tại `.bak`, `.log`, `.fig`, `wc-logs/`.
- [ ] **Setup.php tự hủy hoặc tự khóa:** Chạy thử `setup.php` trên môi trường test, xác nhận file tự xóa hoặc đổi tên sau khi cài thành công; truy cập lại báo lỗi khóa bảo vệ.
- [ ] **Báo cáo chuẩn kích thước:** File báo cáo nghiệm thu ghi rõ kích thước ở cả 2 định dạng Explorer MiB và Decimal MB.
