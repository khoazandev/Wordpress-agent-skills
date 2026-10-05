# WordPress Agent Skills

[English](README.md)

Gói kỹ năng WordPress đa tác vụ cho Antigravity, Claude Code và Codex. Dành riêng cho công việc agency/khách hàng, Flatsome và đóng gói dự án.

## Cài đặt

| Agent | Lệnh | Lệnh Cập nhật |
|---|---|---|
| **Antigravity** | `git clone https://github.com/khoazandev/Wordpress-agent-skills ~/.gemini/config/plugins/wordpress-agent-skills` | `git -C ~/.gemini/config/plugins/wordpress-agent-skills pull` |
| **Claude Code** | `/plugin marketplace add khoazandev/Wordpress-agent-skills` then `/plugin install wordpress-agent-skills@wordpress-agent-skills` | `/plugin marketplace update wordpress-agent-skills` |
| **Codex** | `npx github:khoazandev/Wordpress-agent-skills --agents=codex` (hoặc cách thay thế, chưa được kiểm chứng: `codex plugin marketplace add khoazandev/Wordpress-agent-skills` + `codex plugin add wordpress-agent-skills`) | Chạy lại lệnh cài |
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

Mã thoát (Exit codes): 0 (thành công), 1 (lỗi), 2 (vẫn còn xung đột: các thư mục skill hiện có không chứa marker của gói cài sẽ bị bỏ qua).

### An toàn (Safety)
- **Marker File**: Các skill được cài đặt chứa file marker `.wordpress-agent-skills.json` ghi nhận tên gói, phiên bản, và thời gian cài (không chứa đường dẫn cục bộ).
- **Actions**: Quá trình cài đặt báo cáo các hành động `new` (tạo mới), `update` (cập nhật thư mục đã có marker), `conflict` (xung đột thư mục không có marker, yêu cầu `--force`), hoặc `skip-plugin` (bỏ qua vì đang quản lý bằng cơ chế plugin).
- **Backups**: Khi dùng `--force`, thư mục cũ bị ghi đè sẽ được sao lưu tại `~/.wordpress-agent-skills/backups/<timestamp>/<agent>/<name>/`.
- **Atomic Operations**: Quá trình sử dụng thư mục tạm (staging) và đổi tên nguyên tử (atomic rename).
- **Khuyến nghị**: Luôn chạy với `--dry-run` trước để xem trước thay đổi.

### Vị trí cài đặt (Targets)
| Agent | Global Target | Project Target (`--project`) |
|---|---|---|
| **Antigravity** | `~/.gemini/config/skills` (hoặc `~/.gemini/antigravity/skills`) | `.agents/skills` |
| **Claude Code** | `~/.claude/skills` | `<project>/.claude/skills` |
| **Codex** | `~/.codex/skills` | `.agents/skills` |

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
Dùng `--uninstall` để gỡ bỏ tự động toàn bộ các thư mục skill có chứa marker cài đặt.

Để gỡ cài đặt hoàn toàn phần đăng ký plugin:
- **Antigravity**: Xoá thư mục `~/.gemini/config/plugins/wordpress-agent-skills`.
- **Claude Code**: Chạy lệnh `/plugin uninstall wordpress-agent-skills@wordpress-agent-skills`.

## Đóng góp
- Chạy `npm run setup-hooks` ngay sau khi clone, TRƯỚC KHI tạo commit đầu tiên.
- Kiểm tra `npm run validate && npm test` trước khi commit.
- Khi merge nhánh fork, kiểm tra với `npm run validate -- --history` trên máy cục bộ.
- Xem [Hướng dẫn viết Skill](docs/authoring-guide.md) và [AGENTS.md](AGENTS.md) để biết thêm chi tiết.

## License
MIT
