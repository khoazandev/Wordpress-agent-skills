# Bộ Quy Tắc Kiến Trúc CSS — flatsome-child/style.css

Mục tiêu: biến file 10.800 dòng, 4.400+ `!important` thành một hệ thống có thể tìm, sửa, và mở rộng mà không sợ vỡ layout ở chỗ khác.

---

## 1. Nguyên tắc cốt lõi

> **Một class chỉ nên bị định nghĩa ở ĐÚNG MỘT nơi trong file.**
> Nếu bạn thấy mình đang viết `.sec-why-choose-row` lần thứ 2, thứ 3 — dừng lại, tìm và sửa bản gốc, đừng thêm bản mới đè lên.

Đây là nguyên nhân số 1 khiến file phình to: mỗi lần sửa lại append thêm block mới ở cuối file thay vì sửa tại chỗ.

---

## 2. Cấu trúc phân lớp (ITCSS rút gọn cho WordPress)

Chia file thành 6 vùng theo thứ tự cố định, mỗi vùng có specificity tăng dần từ trên xuống. Dùng comment chia section rõ ràng để dù không có build tool vẫn dễ định vị bằng Ctrl+F:

```css
/* ==========================================================================
   1. SETTINGS — Biến CSS (design tokens), không sinh ra CSS thật
   ========================================================================== */
:root {
  --color-primary: #b1976b;
  --color-navy: #18346b;
  --color-green: #14976b;
  --container-max: 1260px;
  --gap-section: 24px;
  --bp-tablet: 550px;
  --bp-desktop: 850px;
}

/* ==========================================================================
   2. RESET / BASE — Chỉ những gì thật sự cần override từ Flatsome core
   ========================================================================== */

/* ==========================================================================
   3. LAYOUT — Grid, row, container dùng chung nhiều nơi
   ========================================================================== */

/* ==========================================================================
   4. COMPONENTS — Từng khối UI riêng biệt, đặt tên theo section
   [HOME:WHY-US] [HOME:CONTACT] [HOME:HERO] [PAGE:PRACTICE-CONTACT] ...
   ========================================================================== */

/* ==========================================================================
   5. UTILITIES — Class dùng lặp lại nhiều component (.u-hide-mobile...)
   ========================================================================== */

/* ==========================================================================
   6. RESPONSIVE OVERRIDES — Chỉ nếu không gộp được media query vào component
   (Khuyến nghị: viết media query NGAY TRONG block component, không tách riêng
   xuống cuối file — xem mục 4)
   ========================================================================== */
```

**Vì sao thứ tự này quan trọng:** CSS sau luôn có quyền ưu tiên ngang bằng CSS trước nếu specificity bằng nhau. Đặt biến/reset lên đầu, component cụ thể xuống dưới, đảm bảo thứ tự tự nhiên phản ánh đúng độ ưu tiên mong muốn — giảm nhu cầu dùng `!important` để "thắng" thứ tự file.

---

## 3. Quy ước đặt tên (Naming Convention)

Dùng tiền tố theo **vị trí** + tên theo **BEM rút gọn**, để nhìn tên class là biết ngay nó thuộc trang nào, section nào:

```
[loại-trang]-[tên-section]__[phần-tử]--[biến-thể]
```

Ví dụ:
- `home-why-us__row`
- `home-why-us__box`
- `home-why-us__box--active`
- `page-practice-contact__form`

**Quy tắc bắt buộc:**
- Không dùng tên chung chung như `.row2`, `.wrap-new`, `.section6-v2` — đây là nguồn gốc của việc không biết class nào đang thật sự được dùng.
- Không tạo class trùng ý nghĩa (`.sec-why-choose-row` và `.why-choose-wrapper` cùng tồn tại) — chọn MỘT tên, xóa tên cũ khi refactor.
- Comment ngay phía trên mỗi component block:
  ```css
  /* [HOME:WHY-US] — Section "Tại sao chọn..." — dùng ở trang chủ */
  ```

---

## 4. Media query: viết TẠI CHỖ, không tách rời

**Sai (nguồn gốc lỗi Cross-Device Leakage đã gặp):**
```css
.sec-why-choose-row { display: flex; }
/* ... 3000 dòng CSS khác ở giữa ... */
@media (max-width: 849px) {
  .sec-why-choose-row { flex-direction: column; } /* dễ bị quên, dễ conflict */
}
```

**Đúng — nhúng media query ngay cạnh rule desktop của cùng 1 component:**
```css
/* [HOME:WHY-US] */
.home-why-us__row {
  display: flex;
  flex-direction: row;
}

@media (max-width: 849px) {
  .home-why-us__row {
    flex-direction: column;
  }
}
```

→ Khi cần sửa section nào, bạn chỉ cần tìm 1 chỗ, thấy toàn bộ hành vi desktop + tablet + mobile của nó nằm liền kề, không phải kéo xuống cuối file dò xem có override nào không.

---

## 5. Kiểm soát specificity KHÔNG cần `!important`

`!important` chỉ nên dùng khi **thật sự phải thắng CSS inline hoặc CSS do plugin bên thứ 3 chèn động** (ví dụ Elementor inline style). Với CSS do chính bạn viết để override Flatsome, có 2 cách thay thế:

### Cách 1 — Tăng specificity tự nhiên bằng cách match thêm cha
```css
/* Thay vì: */
.col-inner { display: block !important; }

/* Dùng specificity cao hơn Flatsome một cách tự nhiên: */
.sec-contact-col > .col-inner { display: block; }
```

### Cách 2 — Dùng CSS Cascade Layers (hỗ trợ tốt trên mọi trình duyệt hiện đại)
```css
@layer flatsome-core, child-overrides;

@layer child-overrides {
  .home-why-us__row {
    display: flex; /* Luôn thắng flatsome-core dù specificity thấp hơn,
                       không cần !important */
  }
}
```
Đây là cách "đúng chuẩn" nhất để thoát khỏi vòng xoáy `!important` — layer đứng sau luôn thắng layer đứng trước, bất kể specificity, nên bạn không cần đoán Flatsome viết specificity bao nhiêu.

> Việc thay toàn bộ 4.400 `!important` hiện có nên để ở **giai đoạn 2 (post-stabilization roadmap)** như đã thống nhất — không làm cùng lúc với sửa bug.

---

## 6. Design tokens — dùng biến thay vì lặp giá trị

Thay vì gõ lại `#b1976b`, `1260px`, `850px` hàng trăm lần rải rác (khiến đổi màu thương hiệu sau này phải sửa hàng trăm chỗ), khai báo 1 lần ở `:root` (xem mục 2) rồi dùng `var(--color-primary)` mọi nơi. Điều này giảm số dòng thật sự cần sửa khi có thay đổi thiết kế, dù không giảm số dòng CSS hiện có ngay lập tức.

---

## 7. Checklist bắt buộc trước khi thêm bất kỳ rule mới nào

Trước khi paste thêm CSS vào file, tự hỏi:

1. ☐ Class này đã tồn tại trong file chưa? (Ctrl+F trước khi thêm)
2. ☐ Rule này có thể viết trong block component đã có sẵn thay vì tạo block mới ở cuối file không?
3. ☐ Có thật sự cần `!important` không, hay chỉ cần specificity cao hơn 1 cấp?
4. ☐ Media query đã được đặt cạnh rule desktop tương ứng chưa?
5. ☐ Đã xóa rule cũ nếu rule mới thay thế hoàn toàn nó chưa? (không được để cả 2 cùng tồn tại)

Dán checklist này lên đầu file `style.css` như một comment nhắc nhở cho bất kỳ ai (kể cả AI) sửa file sau này.

---

## 8. Công cụ hỗ trợ duy trì lâu dài

| Công cụ | Mục đích |
|---|---|
| **Stylelint** | Bắt lỗi cú pháp, cảnh báo dùng `!important` quá nhiều, enforce naming convention |
| **Chrome DevTools → Coverage tab** | Xem % CSS thực sự được dùng trên từng trang, tìm rule chết |
| **PurgeCSS** (chạy định kỳ, không tự động trong build vì WordPress không có build step cố định) | Xuất báo cáo class không còn dùng để xóa thủ công (an toàn hơn xóa tự động trên site động) |
| **Git hoặc ít nhất diff thủ công giữa các bản backup** | So sánh trước/sau mỗi lần sửa, biết chính xác thay đổi gì |

---

## 9. Quy trình làm việc đề xuất cho mỗi lần sửa CSS trong tương lai

1. Backup file có timestamp.
2. Xác định đúng component block cần sửa bằng tên section (`[HOME:WHY-US]`...).
3. Sửa tại chỗ — không append cuối file.
4. Chạy Stylelint kiểm tra cú pháp.
5. Test qua ma trận viewport (Desktop/Tablet/Mobile) trước khi deploy.
6. Cập nhật đồng bộ bản local + bản live.

---

## 10. Lộ trình giảm 10.800 dòng (tổng quan)

| Giai đoạn | Việc làm | Rủi ro |
|---|---|---|
| Đã làm | Sửa 2 bug layout, dedupe 2 block lỗi | Thấp — đã test |
| Tiếp theo | Áp bộ quy tắc này cho mọi thay đổi mới | Không giảm dòng cũ, nhưng ngăn phình thêm |
| Sau khi ổn định | Chạy Coverage/PurgeCSS, xóa rule chết theo từng trang | Trung bình — cần test kỹ từng trang sau khi xóa |
| Dài hạn | Thay `!important` bằng `@layer` hoặc specificity tự nhiên | Trung bình-cao — nên làm từng block nhỏ, test ngay sau mỗi block |