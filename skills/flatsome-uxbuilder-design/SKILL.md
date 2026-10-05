---
name: flatsome-uxbuilder-design
description: "Use when designing, building, structuring, or editing WordPress pages or sections using Flatsome UX Builder. Enforces native Flatsome shortcodes ([section], [row], [col], [ux_text], [ux_banner], [ux_slider]), pure semantic HTML inside [ux_text] with zero inner classes and zero inline styles (enabling client TinyMCE visual editing), building layouts directly in Page post_content instead of dead UX Blocks, and forbids fabricated non-existent shortcodes. Bắt buộc dùng khi thiết kế trang, layout, section WordPress trên theme Flatsome."
compatibility: "Targets WordPress 6.0+, Flatsome 3.x UX Builder. Compatible with TinyMCE visual editor and native Flatsome shortcode engine."
---

# Thiết kế giao diện bằng Flatsome UX Builder — Đúng chuẩn, Khách sửa được

## When to use

Use this skill when:
- Designing new pages, templates, or landing page sections on WordPress sites using Flatsome theme.
- Building responsive layouts using native Flatsome shortcodes (`[section]`, `[row]`, `[col]`, `[ux_text]`, `[ux_image]`).
- Registering custom interactive elements into UX Builder via `add_ux_builder_post_type` and `ux_builder_setup`.
- Ensuring non-technical clients can edit text, headings, and images directly in the visual UX Builder without breaking code.

## Vấn đề cần ngăn chặn

Khi được yêu cầu "thiết kế giao diện", việc trả về HTML/text tùy tiện — ví dụ:

```html
<p>[acme_timeslot_grid]</p>
```

hoặc gom toàn bộ nội dung của một trang riêng lẻ vào một UX Block rồi nhét `[block id="xyz"]` vào Page, là **SAI HOÀN TOÀN**, vì:

1. `[acme_timeslot_grid]` là shortcode tự bịa, WordPress không biết nó là gì → khi hiển thị ra sẽ in y nguyên chữ đó lên trang, hoặc trống trơn.
2. Kể cả nếu đó là 1 shortcode PHP thật đã đăng ký (`add_shortcode`), nhét nó trong `<p>` thô như vậy khiến UX Builder KHÔNG nhận diện được đây là 1 element — khách mở Page Editor lên sẽ thấy 1 khối text xám, không có nút chỉnh sửa, không kéo-thả, không đổi màu/size qua giao diện được.
3. Nếu mỗi trang lại bọc trong 1 UX Block đơn lẻ, khi khách hàng/admin vào **Pages -> Edit with UX Builder**, họ chỉ thấy 1 khối `[block id="..."]` duy nhất. Không thể click sửa trực tiếp text, ảnh hay kéo-thả element ngay trên trang đó mà phải lội vào menu UX Blocks tìm ID -> Phá vỡ trải nghiệm UX Builder của Flatsome.

**Mục tiêu của skill này:**
Mọi giao diện xuất ra phải mở được trong UX Builder và mỗi khối là 1 "Element" thật sự — có icon riêng trong bảng Elements, click vào hiện form thuộc tính, kéo-thả sắp xếp lại được trực tiếp trên Page.

---

## Nguyên tắc bắt buộc

### 1. Luôn dùng cấu trúc `[row][col]` làm khung, không tự ý viết `<div>` thô

UX Builder nhận diện layout qua đúng 2 shortcode gốc này. Mọi bố cục nhiều cột phải lồng theo cấu trúc:

```text
[row]
  [col span="6" span__sm="12"]
    ... nội dung cột 1 ...
  [/col]
  [col span="6" span__sm="12"]
    ... nội dung cột 2 ...
  [/col]
[/row]
```

* `span`: Số phần trên 12 cột ở desktop (`span="6"` = 50%).
* `span__sm`: Độ rộng ở mobile/tablet (thường đặt `span__sm="12"` để full-width khi thu nhỏ).
* **KHÔNG viết `<div class="col-md-6">` tay** — UX Builder sẽ không nhận nó là 1 cột kéo-thả được.

### 2. Dùng đúng shortcode Element có sẵn của Flatsome, không tự chế tên

Bảng element phổ biến của Flatsome UX Builder (dùng đúng tên, đúng attribute):

| Nhu cầu | Shortcode chuẩn Flatsome |
| :--- | :--- |
| **Đoạn văn bản có định dạng** | `[ux_text class="..."]...[/ux_text]` |
| **Tiêu đề section** | `[title text="..." tag_name="h2" class="..."]` |
| **Ảnh đơn** | `[ux_image id="123" class="..."]` |
| **Banner có overlay + text + button** | `[ux_banner height="400px" bg="123" class="..."]...[/ux_banner]` |
| **Slider ảnh** | `[image_slider ids="1,2,3"]` |
| **Nút bấm** | `[button text="Xem thêm" link="/lien-he/" style="filled" class="..."]` |
| **Khoảng cách** | `[gap height="30px"]` |
| **Nội dung HTML nhúng động** | `[ux_html class="..."]...[/ux_html]` |
| **Accordion câu hỏi thường gặp** | `[accordion class="..."][accordion_item title="..."]...[/accordion_item][/accordion]` |

> [!NOTE]
> Nếu không chắc tên shortcode chính xác hoặc attribute của nó — dừng lại và tra cứu tài liệu Flatsome trong `wp-content/themes/flatsome/inc/shortcodes/`, không bịa ra tên nghe hợp lý.

### 3. Quy chuẩn UX Block vs Page Content (Component Reusability)

* **UX Block:** Bản chất giống reusable component (như React/Vue/Blade component). **CHỈ ĐƯỢC TẠO** khi thành phần đó dùng chung ở nhiều nơi:
  * Footer (`[block id="footer"]`)
  * Header custom CTA / Top bar
  * Global Modal Popup (`[block id="modal-chi-tiet-phong"]`)
  * Form đặt chỗ / thanh toán dùng ở cả trang chủ và trang đặt lịch (`[block id="chi-tiet-dat-phong"]`)
* **Nội dung trang thông thường:** **BẮT BUỘC nằm trực tiếp trong `post_content` của Page.**
  * Không bao giờ tạo UX Block đơn lẻ chỉ phục vụ duy nhất 1 trang (ví dụ tạo Block cho trang Tra Cứu, Block cho trang Chi Nhánh, Block cho trang Hướng Dẫn). Khách hàng mở Page lên phải thấy cây element trực quan để chỉnh sửa và kéo thả ngay tại chỗ.

### 4. Gán Class chuẩn BEM cho mọi Element Flatsome

Để quản lý CSS kiến trúc bền vững, mọi element Flatsome đều phải được đặt tên class ngữ nghĩa theo BEM:
`[loại-trang]-[tên-section]__[phần-tử]--[biến-thể]`

Ví dụ:
```text
[section class="sec-page-tra-cuu" dark="true" padding="50px"]
  [row class="tra-cuu-hero__row" h_align="center"]
    [col class="tra-cuu-hero__col" span="12" align="center"]
      [title class="tra-cuu-hero__title section-title-gradient" text="Kiểm Tra Thông Tin Vé Đặt Phòng"]
    [/col]
  [/row]
[/section]
```

### 4.1. Thẻ Chữ Bên Trong `[ux_text]` Hoàn Toàn Thuần Túy (Zero Class & Zero Inline Style Trên Thẻ Con)

**Nguyên tắc sống còn cho trải nghiệm UX Builder:**
- **Class CHỈ ĐƯỢC GÁN ở thuộc tính shortcode của Element Flatsome** (hiển thị trong ô **Options / Advanced -> Class** của UX Builder).
- **Bên trong `[ux_text]`, TUYỆT ĐỐI KHÔNG gán attribute `class="..."` hay `style="..."` lên bất kỳ thẻ con nào (`<h2>`, `<h3>`, `<p>`, `<span>`, `<em>`, `<strong>`).**
- **Lý do:** Khách hàng hoặc biên tập viên khi mở UX Builder sẽ dùng trình soạn thảo Visual (TinyMCE). Họ chỉ gõ nội dung văn bản tự nhiên và chọn định dạng tiêu đề (Heading 2) hoặc đoạn văn (Paragraph), in đậm (`<strong>`), in nghiêng (`<em>`). Nếu ép buộc thẻ con phải có class (ví dụ `<h2 class="home-booking__title">`), khi khách sửa text bằng Visual Editor, class đó sẽ bị biến mất hoặc khách không thể tự gán lại được → Vỡ giao diện!

**Ví dụ CHUẨN:**
```html
[ux_text text_align="center" class="home-booking__badge"]
<h2><i class="fas fa-bolt"></i> ĐẶT PHÒNG SIÊU TỐC</h2>
<p>Check-in Tự Động • Không Cần Lễ Tân</p>
[/ux_text]
```
hoặc ví dụ bài viết / giới thiệu:
```html
[ux_text class="about-intro"]
<h2>Chào mừng đến với <em>Công ty ABC &amp; PARTNERS</em></h2>
<p><em>Công ty ABC &amp; PARTNERS trân trọng chào mừng Quý Khách hàng đã quan tâm đến dịch vụ pháp lý của chúng tôi...</em></p>
[/ux_text]
```

**Ví dụ SAI:**
```html
<!-- SAI: Thẻ h2 và p bị nhét class thừa, khách mở visual editor sửa là mất class -->
[ux_text text_align="center" class="home-booking__badge"]
<h2 class="home-booking__title"><i class="fas fa-bolt"></i> ĐẶT PHÒNG SIÊU TỐC</h2>
<p class="home-booking__subtitle">Check-in Tự Động • Không Cần Lễ Tân</p>
[/ux_text]

<!-- SAI NGHIÊM TRỌNG: Tự tạo thêm thẻ div bọc trùng class và nhét inline css -->
[ux_text class="home-booking__badge"]
<div class="home-booking__badge">
  <h2 style="font-size: 24px; color: #fff;">ĐẶT PHÒNG</h2>
</div>
[/ux_text]
```

**Quy tắc viết CSS tương ứng trong `style.css`:**
Luôn cho CSS kế thừa tự nhiên từ class của Element cha:
```css
.home-booking__badge h2 {
    font-size: 1.75rem;
    font-weight: 900;
    text-transform: uppercase;
    background: linear-gradient(90deg, #67e8f9 0%, #ffffff 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
}
.home-booking__badge p {
    color: rgba(255, 255, 255, 0.85);
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 1.5px;
}
```

### 4.2. Tuyệt Đối Không Dùng Inline CSS (`style="..."`) Trong Mọi Hoàn Cảnh

- Dù là `[ux_html]`, shortcode Contact Form 7, thẻ SVG hay khối nội dung bất kỳ, **TUYỆT ĐỐI KHÔNG viết `style="..."` inline**.
- Mọi thuộc tính style (kể cả layout `display`, `flex`, `gap`, `width`, `height`, `padding`, `margin`) **BẮT BUỘC** phải được định nghĩa trong `style.css` thông qua các class ngữ nghĩa.
- Khi cần ẩn/hiện hoặc đổi trạng thái (state toggle), dùng class trạng thái như `.is-hidden`, `.is-active`, `.is-loading`, **KHÔNG BAO GIỜ** viết `style="display: none"` hay `style="display: flex"`.
- **Luôn kiểm tra trước khi hoàn thành:** Chạy kiểm tra grep `style=` trên tất cả nội dung tạo ra để đảm bảo 100% không còn sót inline style.

### 5. Khi cần chức năng ĐỘNG không có sẵn (Lưới khung giờ, bảng giá động, form custom)


**KHÔNG được chỉ viết `[ten_tuy_bia]` rồi coi như xong. Phải làm đủ 2 bước:**

#### Bước A — Viết PHP đăng ký shortcode thật trong `functions.php`:
```php
function acme_timeslot_grid_shortcode( $atts ) {
    $atts = shortcode_atts( array(
        'ngay' => '',
        'so_khung_gio' => 8,
    ), $atts );

    ob_start();
    // ... logic render HTML lưới khung giờ ở đây ...
    return ob_get_clean();
}
add_shortcode( 'acme_timeslot_grid', 'acme_timeslot_grid_shortcode' );
```

#### Bước B — Đăng ký nó thành Element trong UX Builder (Bắt buộc):
```php
add_action( 'ux_builder_setup', function() {
    add_ux_builder_shortcode( 'acme_timeslot_grid', array(
        'name'      => 'Lưới Khung Giờ Đặt Lịch',
        'category'  => 'Acme Booking',
        'thumbnail' => flatsome_ux_builder_thumbnail( 'block' ),
        'options'   => array(
            'ngay' => array(
                'type'  => 'date',
                'label' => 'Ngày áp dụng',
            ),
            'so_khung_gio' => array(
                'type'    => 'number',
                'label'   => 'Số khung giờ',
                'default' => 8,
            ),
        ),
    ) );
} );
```

Chỉ khi làm đủ cả 2 bước, khách mở UX Builder mới thấy "Lưới Khung Giờ Đặt Lịch" xuất hiện như 1 element có icon, kéo-thả được, click vào hiện form thuộc tính — đúng như trải nghiệm họ mong đợi, thay vì dòng chữ `[acme_timeslot_grid]` trơ trọi.

### 6. Không nhét shortcode trong `<p>` thủ công

UX Builder tự quản lý việc bọc thẻ HTML quanh mỗi element khi lưu. Khi tạo nội dung để dán vào Page Editor, viết thẳng chuỗi shortcode nối tiếp nhau theo đúng cấu trúc `[row][col]...[/col][/row]`, **KHÔNG tự thêm `<p>` bao ngoài** — làm vậy sẽ phá vỡ parser của UX Builder.

### 7. Bàn giao cho khách — Luôn kèm ghi chú phạm vi chỉnh sửa được

Với mọi element custom (bước 5), khi bàn giao phải nói rõ với khách:
1. **Phần Flatsome gốc:** Khách tự do kéo-thả, đổi màu, đổi ảnh, đổi text trong UX Builder.
2. **Phần custom (như bảng giờ):** Khách chỉnh được các options trong form thuộc tính (ngày, số giờ...), nhưng đổi cấu trúc render HTML thì cần can thiệp code.

---

## Checklist bắt buộc trước khi bàn giao giao diện

- [ ] Toàn bộ layout dùng `[row][col]`, không có `<div>` thô nào đóng vai trò layout.
- [ ] Mọi shortcode dùng đều là element có thật của Flatsome, hoặc đã được đăng ký đủ cả `add_shortcode` VÀ `ux_builder_setup`.
- [ ] Không có shortcode nào bị bọc trong `<p>` thủ công.
- [ ] Nội dung của trang nằm trực tiếp trong Page (`post_content`), không bọc đơn lẻ vào UX Block.
- [ ] Mọi element Flatsome đều được gắn class chuẩn BEM ở thuộc tính shortcode (Advanced -> Class).
- [ ] Bên trong `[ux_text]`, thẻ chữ là HTML ngữ nghĩa thuần túy (`<h2>`, `<p>`, `<em>`...), **100% KHÔNG có attribute `class` hay `style` inline**.
- [ ] File `style.css` style trực tiếp qua selector cha (`.class-element h2`, `.class-element p`), không đòi hỏi thẻ con phải mang class.
- [ ] Đã test mở thử trong UX Builder xác nhận các khối kéo-thả và form thuộc tính hoạt động bình thường.

---

## Verification

Run deterministic checks to verify that page post_content and seeder files meet UX Builder standards:

```bash
# 1. Check for fabricated raw <div> layout tags inside post_content or seeder:
grep -En "<div class=[\"']col-|<div class=[\"']row" wp-content/themes/flatsome-child/inc/page-builder-seeder.php

# 2. Check for inline styles inside shortcodes:
grep -En 'style="[^"]*"' wp-content/themes/flatsome-child/inc/page-builder-seeder.php

# 3. Check for raw shortcodes mistakenly wrapped in <p>:
grep -En "<p>\[" wp-content/themes/flatsome-child/inc/page-builder-seeder.php
```
