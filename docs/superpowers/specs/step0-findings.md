# Báo cáo kết quả kiểm chứng Bước 0 (Step 0 Findings)

Tài liệu này ghi lại kết quả kiểm chứng trước khi viết code (Bước 0 - S0.1 đến S0.5) cho dự án `Wordpress-agent-skills` theo đặc tả tại `docs/superpowers/specs/2026-10-05-wordpress-agent-skills-design.md` §0 và dữ liệu thu thập tại `.superpowers/sdd/2026-10-05-wordpress-agent-skills/step0-research.md`.

---

## S0.1: Đường dẫn skill và cơ chế plugin của Antigravity (global + project)

- **Giả định trong spec (Assumption in spec):**
  - Project: `.agents/skills` (ưu tiên, `.agent/skills` là legacy).
  - Global: Bản mới dùng `~/.gemini/config/skills` (dựa trên sự tồn tại của `~/.gemini/config/` hoặc `.migrated`), bản cũ / IDE dùng `~/.gemini/antigravity/skills`.
  - Plugin: Marker `plugin.json` ở root repo.
- **Kết quả kiểm chứng (Finding):**
  - Cấu trúc hệ thống Antigravity trên máy thực tế và tài liệu tích hợp (`agy-customizations/docs/*.md`, `builtin skills/plugin/SKILL.md`):
    - Global skills: Đường dẫn hiện hành là `~/.gemini/config/skills` (được xác nhận trên máy có file `~/.gemini/config/.migrated`). Đường dẫn legacy/IDE là `~/.gemini/antigravity/skills`.
    - Project skills: Chuẩn hoá là `.agents/skills` (các fallback được hỗ trợ gồm `.agent/`, `_agents/`, `_agent/`).
    - Plugin: Đặt tại `~/.gemini/config/plugins/<name>/` (global) hoặc `.agents/plugins/<name>/` (workspace). Manifest `plugin.json` ở root plugin nhận các trường: `name`, `description`, `displayName`, `version`, `logo`, `suggestedPrompts`, `disabled`.
    - Bộ nạp plugin của Antigravity tự động bỏ qua (discards) các trường không thuộc schema như `author` và `homepage` trong `plugin.json`.
- **Ảnh hưởng tới spec và plan (Impact on spec/plan):**
  - Antigravity global = `~/.gemini/config/skills` được xác nhận là chuẩn hiện hành, thư mục legacy là `~/.gemini/antigravity/skills`. Project target chuẩn hoá là `.agents/skills`. Bảng đích `scripts/lib/targets.mjs` tuân thủ đúng thứ tự ưu tiên này và hỗ trợ override qua biến môi trường `ANTIGRAVITY_SKILLS_DIR`.
  - Manifest `plugin.json` ở root repo chỉ khai báo các trường được loader hỗ trợ (`name`, `description`, v.v.), không phụ thuộc vào `author` hay `homepage` do loader tự động bỏ qua.
  - Cơ chế phát hiện plugin Antigravity (`skip-plugin`) trong `scripts/install.mjs` kiểm tra sự tồn tại của `~/.gemini/config/plugins/wordpress-agent-skills/plugin.json`.
- **Trạng thái (Status):**
  - Confirmed (đã kiểm chứng từ tài liệu builtin và cấu trúc môi trường thực tế; sẽ xác nhận nghiệm thu cài đặt thực tế tại M1, M2).

---

## S0.2: Đường dẫn skill và cơ chế plugin của Codex (global + project)

- **Giả định trong spec (Assumption in spec):**
  - Global: `${CODEX_HOME:-~/.codex}/skills`.
  - Project: `.agents/skills`.
  - Plugin manifest: `.codex-plugin/plugin.json`.
- **Kết quả kiểm chứng (Finding):**
  - Global skills: `${CODEX_HOME:-~/.codex}/skills` (mặc định `~/.codex/skills`); hệ thống cũng hỗ trợ `~/.agents/skills` và đường dẫn POSIX `/etc/codex/skills`.
  - Project skills: `.agents/skills` (ngoài ra hỗ trợ `.codex/skills`), tự động duyệt ngược (walks up) lên repo root.
  - Manifest `.codex-plugin/plugin.json`: Nhận các trường `name`, `version`, `description` (bắt buộc); trường `skills: "./skills/"` (bắt buộc bắt đầu bằng `./`, không được chứa `..`); trường `interface` gồm `displayName`, `shortDescription`, `longDescription`.
  - Marketplace & CLI: Codex hỗ trợ lệnh `codex plugin marketplace add <owner>/<repo>` và sau đó `codex plugin add <name>`.
  - Plugin cài đặt trên đĩa được lưu trong cache tại `$CODEX_HOME/plugins/cache/local/<name>/`.
  - Quy chuẩn frontmatter: Tuân thủ giới hạn của agentskills.io với `name` từ 1–64 ký tự kebab-case (không có gạch nối ở đầu/cuối hoặc gạch nối kép `--`), `description` ≤ 1024 ký tự, `compatibility` ≤ 500 ký tự.
- **Ảnh hưởng tới spec và plan (Impact on spec/plan):**
  - Đường dẫn Codex global `${CODEX_HOME:-~/.codex}/skills`, project `.agents/skills` → Thư mục project của Antigravity và Codex trùng nhau (`<proj>/.agents/skills`), cơ chế gộp đích (merge target) trong `scripts/lib/targets.mjs` sẽ tự động hợp nhất và chỉ ghi một lần.
  - Manifest `.codex-plugin/plugin.json` phải đảm bảo trường `skills` có tiền tố `./` (`./skills/`) và khai báo đầy đủ các trường bắt buộc.
  - Codex hỗ trợ `codex plugin marketplace add <owner>/<repo>` + `codex plugin add <name>` → Bổ sung lệnh này vào README như một phương án cài đặt thay thế / chính thức cho Codex bên cạnh script `install.mjs`.
  - Giới hạn độ dài frontmatter (name 1–64 kebab, description ≤ 1024, compatibility ≤ 500) được kiểm tra chặt chẽ bởi luật V1 trong `scripts/validate-skills.mjs`.
  - Dữ liệu về Codex thu thập một phần từ tài liệu thứ cấp (secondary sources: agentskills.io, vendor docs) cần được đối chiếu và xác nhận lại trong kiểm thử nghiệm thu thủ công.
- **Trạng thái (Status):**
  - Confirmed một phần từ tài liệu agentskills.io và tài liệu vendor; cần xác nhận hành vi thực tế trong manual acceptance M5, M6.

---

## S0.3: Đường dẫn và marketplace của Claude Code

- **Giả định trong spec (Assumption in spec):**
  - Global: `~/.claude/skills` (hoặc `$CLAUDE_CONFIG_DIR/skills`).
  - Project: `<proj>/.claude/skills`.
  - Plugin: `.claude-plugin/marketplace.json` và `.claude-plugin/plugin.json`.
- **Kết quả kiểm chứng (Finding):**
  - Global skills: `~/.claude/skills` (hoặc `$CLAUDE_CONFIG_DIR/skills`).
  - Project skills: `<proj>/.claude/skills`.
  - Plugin manifest: `.claude-plugin/plugin.json` nhận `name` (bắt buộc), `version`, `description`, `author{name}`.
  - Marketplace manifest: `.claude-plugin/marketplace.json` gồm `name`, `owner{name}`, mảng `plugins` với các đối tượng `{name, source, version, description}`. Trong đó, mỗi entry plugin trong marketplace bắt buộc phải có trường `description`.
  - Quản lý plugin qua CLI: `/plugin marketplace add <owner>/<repo>` và `/plugin install <name>@<marketplace>`.
  - Thư mục plugin trên đĩa: Lưu tại cache `~/.claude/plugins/cache/<mkt>/<plugin>/<ver>/`, và registry quản lý plugin cài đặt lưu tại file JSON `~/.claude/plugins/installed_plugins.json`.
  - Quy chuẩn frontmatter: Tuân thủ giới hạn của agentskills.io (`name` 1–64 kebab, `description` ≤ 1024, `compatibility` ≤ 500).
- **Ảnh hưởng tới spec và plan (Impact on spec/plan):**
  - Các mục plugin trong `.claude-plugin/marketplace.json` bắt buộc phải có trường `description` để tránh lỗi nạp marketplace.
  - Đối với cơ chế phát hiện plugin đã cài (`skip-plugin`) trong `scripts/install.mjs`, registry `~/.claude/plugins/installed_plugins.json` là nguồn phát hiện tin cậy và chính xác hơn so với việc quét cây thư mục cache.
  - Thông tin về Claude Code thu thập một phần từ tài liệu thứ cấp cần được đối chiếu và xác nhận lại trong kiểm thử nghiệm thu thủ công.
- **Trạng thái (Status):**
  - Confirmed từ tài liệu chính thức và agentskills.io; cần xác nhận hành vi thực tế trong manual acceptance M3, M4.

---

## S0.4: Mốc kiểm thử cơ sở (Baseline Tests) của `wordpress-packaging-handover`

- **Giả định trong spec (Assumption in spec):**
  - Chưa biết kết quả baseline của các test hiện có tại thư mục nguồn `~/.gemini/config/skills/wordpress-packaging-handover/tests/`.
- **Kết quả kiểm chứng (Finding):**
  - Chạy toàn bộ 7 file test cơ sở tại thư mục nguồn trên Node 24 (môi trường không cấu hình biến môi trường `WP_LIVE_PROJECT`):
    - `test_bundler.mjs`: 6 pass, 0 fail.
    - `test_cleaner.mjs`: 6 pass, 0 fail.
    - `test_config_patcher.mjs`: 6 pass, 0 fail.
    - `test_db_sanitizer.mjs`: 5 pass, 7 fail (7 test fail do cần kết nối tới một cơ sở dữ liệu WordPress live thực tế).
    - `test_handover.mjs`: 5 pass, 0 fail.
    - `test_installer_builder.mjs`: 7 pass, 0 fail.
    - `test_safe_replacer.mjs`: 11 pass, 0 fail.
    - Tổng cộng: 46 pass, 7 fail (chỉ fail ở các test cần live database).
- **Ảnh hưởng tới spec và plan (Impact on spec/plan):**
  - Khẳng định tính đúng đắn của quyết định thiết kế trong Spec §4.1: `test_db_sanitizer.mjs` cần được bổ sung gating qua biến môi trường `WP_LIVE_PROJECT`. Khi không có `WP_LIVE_PROJECT`, các test tương tác DB live sẽ tự động skip (thông qua helper `liveTest()`) thay vì đánh dấu fail.
  - Thiết lập mốc chất lượng cơ sở: Toàn bộ các test độc lập không phụ thuộc DB live (tối thiểu 46/46 test) phải pass 100% trong môi trường CI và phát triển cục bộ.
  - Tích hợp module `find-binary.mjs` cùng bộ test `test_find_binary.mjs` để định vị động các file thực thi PHP và MySQL/mysqldump mà không hardcode đường dẫn trên máy.
- **Trạng thái (Status):**
  - Confirmed (kết quả baseline đã được đo lường chính xác trên môi trường thực tế).

---

## S0.5: Quét rò rỉ dữ liệu (Leak Scan) trên 4 skill nguồn

- **Giả định trong spec (Assumption in spec):**
  - Đã biết một số trường hợp rò rỉ tại Spec §4.1, nhưng cần quét toàn diện để không bỏ sót thông tin cá nhân hay khách hàng trước khi đưa vào git.
- **Kết quả kiểm chứng (Finding):**
  - Thực hiện quét toàn bộ 4 thư mục skill nguồn tại `~/.gemini/config/skills/` bằng luật V3 (kết hợp mẫu regex đường dẫn cá nhân và denylist so khớp literal + squash không dấu).
  - Số lượng vị trí phát hiện rò rỉ (chỉ ghi số lượng đếm, không nêu bất kỳ tên khách hàng, tên dự án, tên miền hay đường dẫn cá nhân nào theo Controller Ruling R3; đường dẫn dùng `~`):
    - `flatsome-css-architecture`: 0 dòng vi phạm (hoàn toàn sạch).
    - `flatsome-uxbuilder-design`: 6 dòng chứa tiền tố (prefix) khách hàng, 2 dòng chứa tên công ty, 1 dòng chứa danh mục nghiệp vụ.
    - `wordpress-functions-zero-hardcode`: 9 dòng chứa tiền tố/hằng số khách hàng, 1 dòng chứa tên chi nhánh.
    - `wordpress-packaging-handover`: 21 dòng chứa đường dẫn thư mục người dùng cá nhân (7 dòng trong SKILL.md, 14 dòng trong header các file script/test), khoảng 40 dòng chứa tên dự án phân bổ trên SKILL.md, scripts, templates và tests, và 1 dòng chứa tên miền khách hàng.
  - Toàn bộ các vị trí và giá trị rò rỉ đã được tổng hợp và đối chiếu vào bảng ánh xạ làm sạch cục bộ `.sanitize-map.local.json`.
- **Ảnh hưởng tới spec và plan (Impact on spec/plan):**
  - Skill `flatsome-css-architecture` hoàn toàn sạch, có thể đưa vào repo và chỉ cần chuẩn hoá frontmatter theo cú pháp nghiêm ngặt.
  - Đối với 3 skill còn lại, bắt buộc tuân thủ chặt chẽ quy trình làm sạch (Spec §4.1 & §4.2) trước khi commit đầu tiên:
    - Thay thế các tiền tố bằng `acme_`, hằng số `ACME_DEMO_MODE`, danh mục `Acme Booking`, tên công ty `Công ty ABC`, chi nhánh `Chi nhánh A`, tên miền `https://demo-site.example`, tên dự án `demo_site`.
    - Thay thế các đường dẫn cá nhân bằng `node <skill-dir>/scripts/handover.mjs` hoặc đường dẫn tương đối.
    - Trong `test_safe_replacer.mjs`, tính toán lại chính xác độ dài byte của chuỗi tuần tự hoá (serialized string) tương ứng với tên miền/dự án ẩn danh mới (`http://localhost/demo_site` là 26 byte thay vì 27 byte) để đảm bảo test tiếp tục pass.
  - Hệ thống hook `pre-commit` (chạy `validate-skills.mjs`) và kiểm tra CI với `VALIDATE_DENYLIST` đảm bảo ngăn chặn 100% việc rò rỉ dữ liệu vào lịch sử git.
- **Trạng thái (Status):**
  - Confirmed (đã định vị chính xác toàn bộ vị trí rò rỉ, sẵn sàng cho các task import và làm sạch tiếp theo).
