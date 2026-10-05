# WordPress Agent Skills

[English](README.md)

Gói kỹ năng WordPress đa tác vụ cho Antigravity, Claude Code và Codex. Dành riêng cho công việc agency/khách hàng, Flatsome và đóng gói dự án.

## Cài đặt

| Agent | Lệnh | Lệnh Cập nhật |
|---|---|---|
| **Antigravity** | `git clone https://github.com/khoazandev/Wordpress-agent-skills ~/.gemini/config/plugins/wordpress-agent-skills` | `git -C ~/.gemini/config/plugins/wordpress-agent-skills pull` |
| **Claude Code** | `/plugin marketplace add khoazandev/Wordpress-agent-skills` then `/plugin install wordpress-agent-skills@wordpress-agent-skills` | `/plugin marketplace update wordpress-agent-skills` |
| **Codex** | `npx github:khoazandev/Wordpress-agent-skills --agents=codex` (hoặc `codex plugin marketplace add khoazandev/Wordpress-agent-skills` + `codex plugin add wordpress-agent-skills`) | Chạy lại lệnh cài |
| **Project Repos** | `npx github:khoazandev/Wordpress-agent-skills --project .` (commit thư mục `.agents/skills`) | Chạy lại lệnh cài |

## Tuỳ chọn Cài đặt

Sử dụng:
```
node scripts/install.mjs [options]
npx github:khoazandev/Wordpress-agent-skills [options]

--agents=<list>     antigravity,claude,codex (mặc định: cả 3)
--project=<path>    cài vào repo dự án thay vì global
--skills=<list>     chỉ cài một số skill (mặc định: tất cả)
--dry-run           in kế hoạch, không ghi
--uninstall         gỡ các skill do tool này cài
--force             thay thế thư mục không có marker (luôn backup) / bỏ qua cảnh báo plugin
--help
```

Mã thoát (Exit codes): 0 (thành công), 1 (lỗi), 2 (cảnh báo).
An toàn: Backups cho `--force` lưu tại `~/.wordpress-agent-skills/backups/`.

## Danh sách Kỹ năng (Skill Inventory)

- **wp-agency-router**: Agency/client router. Kích hoạt: "Giúp tôi với task Flatsome WordPress."
- **flatsome-css-architecture**: Quy chuẩn CSS Flatsome. Kích hoạt: "Sửa layout CSS cho Flatsome."
- **flatsome-uxbuilder-design**: Thiết kế UX Builder. Kích hoạt: "Tạo section UX Builder mới."
- **wordpress-functions-zero-hardcode**: Code functions.php không hardcode. Kích hoạt: "Viết shortcode vào functions.php."
- **wordpress-packaging-handover**: Đóng gói bàn giao. Kích hoạt: "Đóng gói website WordPress này."

## Kết hợp cùng WordPress/agent-skills
Skill pack này sẽ tự nhường quyền cho `wordpress-router` của upstream với các tác vụ core. Không sao chép kỹ năng từ upstream.

## Yêu cầu
- Node.js >= 20.
- PHP và mysqldump chỉ dùng cho `wordpress-packaging-handover`.

## Gỡ cài đặt
Dùng `--uninstall` để gỡ bỏ.

## Đóng góp
- Chạy `npm run setup-hooks` ngay sau khi clone.
- Kiểm tra `npm run validate && npm test` trước khi commit.
- Khi merge nhánh fork, kiểm tra với `npm run validate -- --history`.

## License
MIT
