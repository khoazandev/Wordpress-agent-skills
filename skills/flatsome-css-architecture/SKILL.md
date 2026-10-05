---
name: flatsome-css-architecture
description: "Use when reading, modifying, writing, or refactoring CSS for WordPress Flatsome child themes (style.css, modular stylesheets). Enforces single source of truth, editing classes in-place (never appending duplicates), colocated responsive media queries next to desktop rules, container centering (max-width: 1260px; margin: auto), natural parent-child cascade without inner classes, and ABSOLUTE ZERO inline styles (style=\"...\"). Bắt buộc dùng khi chỉnh sửa CSS, responsive layout, fix lỗi hiển thị giao diện Flatsome."
compatibility: "Targets WordPress 6.0+, Flatsome 3.x child themes (style.css, modular stylesheets). Modern CSS, CSS variables, Stylelint."
---

# Flatsome Child Theme — CSS Architecture Rules

## When to use

Use this skill when:
- Creating, editing, or refactoring CSS stylesheets for Flatsome child themes (`style.css`, `assets/css/pages/*.css`).
- Troubleshooting layout breaks, column alignment, responsive scaling (Mobile/Tablet/Desktop).
- Enforcing Zero Inline Styles policy across templates, shortcodes, and forms.
- Eliminating CSS bloat, duplicate rules, and redundant `!important` flags.

Bối cảnh: file `style.css` của child theme từng phình tới hơn 10.800 dòng với 4.400+ `!important` vì mỗi lần sửa lại append block mới ở cuối file thay vì sửa tại chỗ, gây ra các lỗi layout nghiêm trọng (section bị lệch trái, section bị vỡ cấu trúc do rule chồng lấn). Skill này tồn tại để KHÔNG lặp lại việc đó.

## Việc phải làm TRƯỚC khi viết bất kỳ CSS nào cho file này

1. **Tìm rule đã tồn tại trước.** Dùng grep/Ctrl+F tìm class liên quan trong file. Nếu class đã được định nghĩa ở đâu đó — SỬA TẠI CHỖ. Không được thêm một block mới ở cuối file để "đè" lên rule cũ.
2. **Nếu rule cũ sai/thừa — xóa hẳn, không comment out để đó.** File không được có 2 block cùng định nghĩa 1 class.
3. **Media query phải nằm ngay cạnh rule desktop của cùng component**, không tách xuống một khu `@media` gộp chung ở cuối file. Xem ví dụ trong `references/architecture-ruleset.md` mục 4.
4. **Không dùng `!important`** trừ khi phải thắng inline style hoặc CSS do plugin JS chèn động (ví dụ Elementor). Ưu tiên tăng specificity tự nhiên (`.sec-contact-col > .col-inner` thay vì `.col-inner`) hoặc dùng `@layer`.
5. **Đặt tên class theo quy ước:** `[loại-trang]-[tên-section]__[phần-tử]--[biến-thể]`, ví dụ `home-why-us__row`. Không tạo tên chung chung như `.row2`, `.wrap-new`.
6. **Container row không bao giờ bị custom margin/width riêng.** Luôn giữ auto-centering:
   ```css
   max-width: 1260px;
   margin-left: auto;
   margin-right: auto;
   width: 100%;
   ```
7. **Kế thừa style tự nhiên xuống thẻ con thuần túy (Không bắt thẻ con phải có class):**
   - Khi viết CSS cho khối text (`[ux_text class="component-badge"]`), luôn target trực tiếp qua selector cha: `.component-badge h2`, `.component-badge p`, `.component-badge em`.
   - Tuyệt đối không bắt buộc các thẻ con `<h2>`, `<p>`, `<span>` bên trong phải có class riêng (như `.component-badge__title`), giúp khách hàng chỉnh sửa văn bản trong UX Builder một cách tự nhiên mà không bao giờ bị mất style.
8. **Tuyệt đối KHÔNG viết CSS inline (`style="..."`):**
   - Không chèn `style="..."` vào bất kỳ thẻ HTML nào, form Contact Form 7, shortcode hay trang nào.
   - Để ẩn/hiện element (state toggle), dùng class CSS (ví dụ `.is-hidden`, `.is-active`), không bao giờ viết `style="display: none"` hay `style="display: flex"`.

## Checklist bắt buộc trước khi commit thay đổi

- [ ] Class này đã tồn tại trong file chưa? Đã tìm và sửa tại chỗ, không thêm bản mới?
- [ ] Rule mới có nằm trong đúng block component (`[HOME:WHY-US]`, `[HOME:CONTACT]`...) không, hay bị lạc xuống cuối file?
- [ ] Có thật sự cần `!important` không?
- [ ] Media query đã đặt cạnh rule desktop tương ứng chưa?
- [ ] Đã xóa rule cũ nếu rule mới thay thế nó hoàn toàn chưa?
- [ ] TUYỆT ĐỐI KHÔNG có `style="..."` inline nào trong HTML, shortcode, form CF7? (Đã chạy grep `style=` kiểm tra?)
- [ ] Backup file (có timestamp) trước khi ghi đè lên site live chưa?
- [ ] Đã test qua Desktop (1920px, 1440px), Tablet (768px), Mobile (375px) chưa?

## Quy trình khi người dùng yêu cầu sửa/thêm CSS

1. Nếu có file `style.css` được cung cấp — đọc toàn bộ trước, xác định class/section liên quan đã tồn tại chưa.
2. Backup trước khi sửa (copy file kèm timestamp).
3. Sửa tại chỗ theo đúng 6 nguyên tắc ở trên.
4. Chạy kiểm tra cú pháp CSS (ví dụ stylelint nếu có sẵn) trước khi giao lại cho người dùng để deploy.
5. Nhắc người dùng test qua các viewport trước khi đẩy lên site live — đừng tự ý xác nhận "đã xong" nếu chưa test.
6. Không tự động chạy loạt refactor giảm dòng / bỏ `!important` hàng loạt trừ khi người dùng yêu cầu rõ — đây là việc thuộc giai đoạn 2 (post-stabilization), làm riêng, từng phần nhỏ, có test sau mỗi phần.

## Tài liệu tham khảo đầy đủ

Đọc `architecture-ruleset.md` khi cần chi tiết đầy đủ: cấu trúc phân lớp ITCSS, ví dụ cụ thể về `@layer`, bảng công cụ hỗ trợ (Stylelint, PurgeCSS, DevTools Coverage), và lộ trình giảm số dòng CSS dài hạn.

---

## Verification

Run deterministic checks before committing CSS changes:

```bash
# 1. Verify zero inline styles in child theme PHP files:
grep -En 'style="[^"]*"' wp-content/themes/flatsome-child/**/*.php

# 2. Check for unauthorized !important overuse:
grep -c '!important' wp-content/themes/flatsome-child/style.css

# 3. Check for duplicated CSS class definitions:
# Inspect modified selectors to ensure in-place edits were performed
```