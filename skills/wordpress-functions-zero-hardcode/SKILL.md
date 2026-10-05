---
name: wordpress-functions-zero-hardcode
description: "Use when writing, modifying, or reviewing WordPress functions.php, custom shortcodes, CPT (custom post types), taxonomies, ACF fields, or dynamic business data queries. Enforces zero hard-coded values (no static prices, no hardcoded branch lists, no simulated or random booking status via rand/crc32, no external media hotlinks, and cache-busting using filemtime instead of time). Bắt buộc dùng khi viết code PHP cho WordPress functions.php, shortcode, database queries, hoặc chuẩn bị bàn giao code cho khách hàng."
compatibility: "Targets WordPress 6.0+ (PHP 7.4+). WordPress functions.php, child themes, CPTs, ACF Pro, WooCommerce, and AJAX/REST endpoints."
---

# Chuẩn functions.php khi bàn giao khách hàng — Zero Hardcode Policy

## When to use

Use this skill when:
- Writing or reviewing code in `functions.php`, child themes, or custom plugin includes.
- Creating custom shortcodes, Custom Post Types (CPT), custom taxonomies, or ACF fields.
- Querying dynamic business data (products, prices, branch locations, booking statuses).
- Preparing code for client handover to ensure no mock or hardcoded values leak to production.

## Vấn đề cần ngăn chặn

Trong quá trình phát triển, việc set cứng giá trị mẫu (`'350.000 vnđ'`, `'Tất cả (62)'`, ảnh demo từ postimg.cc, trạng thái đặt phòng random) để nhanh chóng dựng giao diện là bình thường. Nhưng nếu những giá trị đó còn sót lại khi bàn giao cho khách, hậu quả nghiêm trọng hơn một lỗi UI:

1. **Giá sai hiển thị cho khách hàng thật** → thiệt hại tài chính, mất uy tín.
2. **Trạng thái "Đã đặt/Trống" giả (ví dụ dùng `crc32()`/`rand()` để mô phỏng)** → double-booking thật, khách đặt trùng phòng.
3. **Số liệu đếm ("62 phòng") không tự cập nhật khi khách thêm/xóa phòng** → thông tin sai lệch âm thầm, không ai phát hiện cho đến khi khách phàn nàn.
4. **Ảnh/link trỏ ra domain ngoài không thuộc khách** → rủi ro khi domain đó sập, đổi nội dung, hoặc vi phạm bản quyền.

> **Nguyên tắc cốt lõi**: Mọi dữ liệu hiển thị cho khách hàng cuối phải bắt nguồn từ database thật (CPT, taxonomy, ACF, options page) — không phải từ giá trị viết chết trong code PHP.

---

## 9 Nguyên Tắc Bắt Buộc

### 1. Không bao giờ dùng dữ liệu giả lập để mô phỏng trạng thái nghiệp vụ thật

❌ **SAI — ví dụ thực tế đã gặp:**
```php
$pseudo_hash = crc32("{$slot_unique_id}-salt") % 100;
$is_booked = $is_expired || ($pseudo_hash < 12);
```
*Đây là random giả lập trạng thái đặt phòng — nếu lọt vào production, khách đặt trùng chỗ đã có người đặt thật.*

✅ **ĐÚNG — luôn truy vấn nguồn dữ liệu thật:**
```php
$is_booked = acme_check_real_booking( $room_id, $date, $slot_time ); // query CPT/table đơn đặt phòng thật
```

**Nếu tại thời điểm viết code CHƯA có bảng lưu đơn đặt phòng thật, phải:**
- Dừng lại, báo rõ cho người yêu cầu: *"Chức năng này cần có nguồn dữ liệu đặt phòng thật (CPT/table), hiện chưa có — cần dựng trước khi hoàn thiện phần trạng thái Đã đặt/Trống."*
- Nếu cần demo tạm cho preview nội bộ, đánh dấu bằng comment rõ ràng và constant riêng:
```php
// ⚠️ DEMO ONLY — XÓA TRƯỚC KHI BÀN GIAO. Cần nối vào bảng đặt phòng thật.
define( 'ACME_DEMO_MODE', true );
```
Kèm 1 dòng ở đầu file liệt kê mọi constant `_DEMO_MODE` đang bật, để không ai quên xóa.

---

### 2. Không hard-code dữ liệu mà khách hàng sẽ tự thay đổi

Nếu 1 giá trị có khả năng khách cần tự sửa sau này (thêm chi nhánh, đổi giá, đổi số lượng phòng) — nó không được nằm chết trong mảng PHP. Phải đưa vào 1 trong các nguồn quản lý được qua giao diện admin:

| Loại dữ liệu | Nơi lưu đúng chuẩn |
| :--- | :--- |
| **Danh sách chi nhánh** | Custom Taxonomy (`chi_nhanh`) hoặc CPT riêng, không phải mảng `$branches_config` viết tay trong PHP |
| **Giá phòng / giá combo** | ACF Field trên từng CPT phòng (đã đúng trong code hiện có — giữ nguyên cách này) |
| **Số liệu tổng (số phòng, số chi nhánh)** | Tính động bằng `wp_count_posts()` / `get_terms()` với count, KHÔNG viết số cứng như "Tất cả (62)" |
| **Cấu hình chung (email nhận thông báo, số điện thoại hotline, link Zalo)** | ACF Options Page (`acf_add_options_page`), không hard-code trong `functions.php` |
| **Ảnh mặc định/placeholder** | Upload vào Media Library của chính site khách, lấy qua `wp_get_attachment_image_url()` — không trỏ domain ngoài (`postimg.cc`, `imgur`, v.v.) |

❌ **Ví dụ SAI:**
```php
$output .= '<button data-filter="branch32">Chi nhánh A (11)</button>'; // số 11 chết cứng
```

✅ **Ví dụ ĐÚNG:**
```php
$count = acme_count_rooms_by_branch( $branch_id ); // query thật, luôn đúng
$output .= '<button data-filter="branch' . esc_attr($branch_id) . '">' . esc_html($branch_name) . ' (' . $count . ')</button>';
```

---

### 3. Danh sách cấu hình cố định (KHÔNG phải dữ liệu khách sửa) vẫn được phép hard-code

Không phải mọi mảng PHP đều sai — phân biệt rõ:
- **Được phép hard-code**: bảng ánh xạ kỹ thuật không đổi theo nghiệp vụ khách (ví dụ `$weekday_names = array('1' => 'T2', ...)` — tên thứ trong tuần không bao giờ đổi).
- **Không được hard-code**: bất kỳ thứ gì phản ánh tình trạng kinh doanh hiện tại của khách (giá, số lượng, danh sách chi nhánh, trạng thái đặt chỗ).

*Khi không chắc 1 giá trị thuộc loại nào — mặc định coi nó là "khách sẽ cần sửa" và đưa vào DB/admin, an toàn hơn là hard-code nhầm.*

---

### 4. Cache-busting đúng chuẩn, không dùng `time()`

❌ **SAI:**
```php
wp_enqueue_style('flatsome-child-style', $uri, array(...), time());
```
*Phá cache trình duyệt hoàn toàn, mọi khách tải lại CSS mỗi lần vào trang.*

✅ **ĐÚNG:**
```php
wp_enqueue_style('flatsome-child-style', $uri, array(...), filemtime(get_stylesheet_directory() . '/style.css'));
```
*Version chỉ đổi khi file thật sự thay đổi — cache hoạt động đúng, vẫn tự invalidate khi deploy code mới.*

---

### 5. Không ghi vào database ở mọi page load nếu không cần thiết

Nếu 1 đoạn code chỉ cần chạy 1 lần (đồng bộ setting, tạo dữ liệu mặc định), nó phải gắn vào hook chạy 1 lần (`after_switch_theme`, hoặc kiểm tra flag đã chạy qua `get_option`), không gắn vào hook chạy mỗi request (`init`, `after_setup_theme`, `wp_head`) mà bên trong lại có `set_theme_mod()`, `wp_insert_post()`, hay bất kỳ DB write nào.

❌ **SAI: check-and-insert chạy mỗi request:**
```php
add_action('init', function() {
    if (!get_page_by_path('modal-slug', OBJECT, 'blocks')) {
        wp_insert_post(...); // query DB mỗi lần dù đã tồn tại
    }
});
```

✅ **ĐÚNG: dùng flag option, chỉ chạy logic nặng khi thật sự cần:**
```php
add_action('init', function() {
    if (get_option('acme_modal_block_created')) return;
    $existing = get_posts(array('name' => 'modal-slug', 'post_type' => 'blocks', 'posts_per_page' => 1));
    if (empty($existing)) {
        wp_insert_post(...);
    }
    update_option('acme_modal_block_created', true);
});
```

---

### 6. Không lặp script khi shortcode được gọi nhiều lần trên cùng 1 trang

Mọi khối `<script>` in ra bên trong hàm shortcode phải có cờ chống lặp:

```php
function acme_render_xyz_shortcode($atts) {
    // ... render HTML ...

    static $script_printed = false;
    if (!$script_printed) {
        $script_printed = true;
        ?>
        <script>/* ... */</script>
        <?php
    }
    return ob_get_clean();
}
```

*Nếu logic JS cần chạy độc lập với vị trí shortcode, ưu tiên chuyển hẳn ra `add_action('wp_footer', ...)` đăng ký đúng 1 lần, thay vì in trong hàm render.*

---

### 7. Truy vấn nặng phải cache bằng transient, không query lại mỗi request

Với dữ liệu ít thay đổi (danh sách phòng, giá — không phải trạng thái đặt chỗ real-time):

```php
$rooms = get_transient('acme_all_rooms_cache');
if ($rooms === false) {
    $rooms = get_posts(array('post_type' => 'phong', 'posts_per_page' => -1, 'post_status' => 'publish'));
    set_transient('acme_all_rooms_cache', $rooms, 15 * MINUTE_IN_SECONDS);
}
```

*Dữ liệu real-time thật sự (trạng thái Đã đặt/Trống) thì KHÔNG cache theo cách này — phải luôn query trực tiếp hoặc dùng cơ chế invalidate cache ngay khi có đơn đặt mới.*

---

### 8. Escape output — giữ nguyên chuẩn bảo mật WordPress

Tiếp tục dùng `esc_html()`, `esc_attr()`, `esc_url()` cho mọi giá trị động in ra HTML — không được nới lỏng khi tối ưu các mục trên.

---

### 9. Tránh hàm đã deprecated

Dùng `get_posts(array('name' => $slug, 'post_type' => $type, 'posts_per_page' => 1))` thay cho `get_page_by_path()` (deprecated từ WP 6.2) để tránh cảnh báo và đảm bảo tương thích bản WordPress mới.

---

## Checklist Bắt Buộc Trước Khi Bàn Giao `functions.php`

- [ ] **Grep toàn file tìm chuỗi số/giá viết chết** dạng `'... vnđ'`, `"(<số>)"`, hoặc mảng cấu hình chi nhánh/giá viết tay — xác nhận từng cái nên nằm trong DB/ACF hay thật sự là hằng số kỹ thuật không đổi.
- [ ] **Không còn `crc32`, `rand()`, `mt_rand()`**, hoặc bất kỳ giá trị random nào dùng để mô phỏng trạng thái nghiệp vụ thật (đặt chỗ, tồn kho, thanh toán).
- [ ] **Không còn constant `_DEMO_MODE`** nào đang bật.
- [ ] **Không còn URL ảnh/link trỏ ra domain không thuộc sở hữu của khách** (như postimg.cc, imgur, unsplash demo).
- [ ] **`wp_enqueue_style` / `wp_enqueue_script` dùng `filemtime()`**, không dùng `time()`.
- [ ] **Không có DB write nào chạy vô điều kiện** trên hook chạy mỗi request.
- [ ] **Mọi shortcode in `<script>` đều có cờ chống lặp** khi gọi nhiều lần.
- [ ] **Đã tra cứu và thay thế hàm deprecated** nếu có (`get_page_by_path` → `get_posts`).
- [ ] **Dữ liệu real-time (trạng thái đặt chỗ) xác nhận KHÔNG bị cache sai cách** (kể cả cache của plugin caching bên ngoài — nếu site dùng cache toàn trang, nhắc khách/dev loại trừ phần này hoặc chuyển sang load qua AJAX/REST API).

---

## Verification

Run deterministic checks to verify compliance before committing or handing over:

```bash
# 1. Check for simulated random data in PHP files:
grep -En "crc32\(|rand\(|mt_rand\(" wp-content/themes/flatsome-child/

# 2. Check for cache busting using time() instead of filemtime():
grep -En "time\(\)" wp-content/themes/flatsome-child/functions.php

# 3. Check for external hotlinked demo images:
grep -En "postimg\.cc|imgur\.com|unsplash\.com" wp-content/themes/flatsome-child/

# 4. Check for deprecated WP functions:
grep -En "get_page_by_path\(" wp-content/themes/flatsome-child/
```
