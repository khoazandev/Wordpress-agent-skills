# Wordpress-agent-skills — Design Spec

- **Ngày:** 2026-10-05 (rev 2, sau review)
- **Repo đích:** https://github.com/khoazandev/Wordpress-agent-skills
- **Trạng thái:** Đã duyệt qua brainstorming (4 phần). Rev 2 áp dụng kết quả review, chờ duyệt lại
- **Phân loại:** Architectural (repo mới)

---

## 0. Bước 0 — kiểm chứng trước khi viết code

Plan triển khai **bắt đầu** bằng các bước sau. Kết quả được ghi vào `docs/superpowers/specs/step0-findings.md`. Nếu kết quả khác giả định trong spec này thì cập nhật spec trước, rồi mới làm tiếp.

| # | Kiểm chứng | Cách làm | Giả định hiện tại |
|---|---|---|---|
| S0.1 | Đường dẫn skill của **Antigravity** (global + project) | Đối chiếu tài liệu chính thức hiện hành ở antigravity.google, tài liệu builtin `agy-customizations` trên máy, và cấu trúc `~/.gemini/` thực tế | Project: `.agents/skills` (ưu tiên, `.agent/skills` là legacy). Global: bản mới dùng `~/.gemini/config/skills`, bản cũ/IDE dùng `~/.gemini/antigravity/skills` (xem 6.2) |
| S0.2 | Đường dẫn skill của **Codex** (global + project) và định dạng `.codex-plugin` | Tài liệu chính thức của OpenAI Codex | Global: `${CODEX_HOME:-~/.codex}/skills`. Project: `.agents/skills` |
| S0.3 | Đường dẫn và marketplace của **Claude Code** | Tài liệu chính thức của Claude Code | Global: `~/.claude/skills`. Project: `.claude/skills`. Plugin qua `.claude-plugin/marketplace.json` |
| S0.4 | **Mốc test** của `wordpress-packaging-handover` tại vị trí gốc | Chạy từng file `tests/test_*.mjs` bằng `node --test <file>` (liệt kê rõ từng file) | Chưa biết |
| S0.5 | **Quét rò rỉ** toàn bộ 4 skill nguồn, gồm cả `references/`, `scripts/`, `templates/`, `tests/` | Chạy luật V3 (denylist + squash) với thư mục nguồn | Đã biết các trường hợp ở 4.1, có thể còn sót |

---

## 1. Mục tiêu & phạm vi

### 1.1 Mục tiêu

Đóng gói các skill WordPress **do chính tác giả viết** thành một repo public, cài được cho **Antigravity, Claude Code và Codex**, ở cả phạm vi **global** lẫn **per-project**. Repo phải cập nhật dễ dàng và không rò rỉ thông tin máy cá nhân hay tên khách hàng, kể cả trong **lịch sử git**.

### 1.2 Trong phạm vi (v1.0.0)

| Skill | Nguồn | Ghi chú |
|---|---|---|
| `wp-agency-router` | **Mới** | Router cho nhóm việc agency/Flatsome/bàn giao. Phần còn lại chuyển sang upstream |
| `flatsome-css-architecture` | `~/.gemini/config/skills/` | SKILL.md + `references/architecture-ruleset.md` |
| `flatsome-uxbuilder-design` | `~/.gemini/config/skills/` | SKILL.md |
| `wordpress-functions-zero-hardcode` | `~/.gemini/config/skills/` | SKILL.md |
| `wordpress-packaging-handover` | `~/.gemini/config/skills/` | SKILL.md + 7 scripts + 3 templates + 7 tests |

Kèm theo:
- manifest plugin cho 3 agent
- `scripts/install.mjs`, `scripts/validate-skills.mjs`, `scripts/run-tests.mjs`
- git hook cục bộ
- test, CI
- README song ngữ, LICENSE MIT, CHANGELOG, authoring guide

### 1.3 Ngoài phạm vi

- **19 skill upstream** của [WordPress/agent-skills](https://github.com/WordPress/agent-skills): không copy/vendor. Router chỉ trỏ sang theo nhóm việc.
- Agent khác (Cursor, Copilot, Windsurf…).
- **Để v1.1+:**
  - `install.mjs --mode=link` (junction/symlink)
  - script `release.mjs` (v1.0 bump version thủ công, V4 bắt lệch)
  - eval scenarios
  - AI auto-update
  - script verify riêng cho skill Flatsome/zero-hardcode
  - tách plugin con

### 1.4 Tiêu chí thành công

1. `npm run validate` và `npm test` pass trên Windows và Ubuntu với Node 20, 22 và 24 (CI xanh).
2. Không có đường dẫn máy cá nhân, tên khách hay tên dự án thật **trong mọi commit** của lịch sử git. Kiểm tra bằng `npm run validate -- --history` với `.validate-denylist` cục bộ, và CI kiểm tra bằng denylist nạp từ GitHub secret.
3. Cài được và agent nhận diện skill trên cả 3 agent theo đúng README. Kiểm tra thủ công: danh sách plugin trong Antigravity, `/skills` trong Claude, `/skills` trong Codex.
4. `install.mjs` không bao giờ ghi đè hoặc xoá thư mục skill không do nó tạo ra (trừ khi có `--force`, và khi đó luôn có backup). Lỗi giữa chừng không làm mất skill đang cài.

---

## 2. Quyết định đã chốt

| Chủ đề | Quyết định |
|---|---|
| Nội dung repo | Chỉ skill riêng (+ skill mới sau này). Upstream cài riêng |
| Agent mục tiêu | Antigravity, Claude Code, Codex |
| Ngôn ngữ | Song ngữ: `description` tiếng Anh + câu trigger tiếng Việt. Thân SKILL.md tiếng Việt. `README.md` (EN) + `README.vi.md` (VI) |
| Phạm vi cài | Global mặc định + `--project=<path>` |
| Kiến trúc | Repo vừa là plugin cho cả 3 agent (theo mẫu `obra/superpowers`) + `install.mjs` dự phòng |
| License | MIT |
| Runtime | Node.js **≥ 20** (Node 18 đã EOL), ES modules, **0 dependency** |
| Version | SemVer, bắt đầu `1.0.0`. Nguồn duy nhất là `package.json`, bump thủ công ở v1.0 |
| Tên plugin | `wordpress-agent-skills` |

---

## 3. Kiến trúc repo

```text
Wordpress-agent-skills/
├── skills/                                  # NGUỒN DUY NHẤT (canonical)
│   ├── wp-agency-router/
│   │   ├── SKILL.md
│   │   └── references/decision-tree.md
│   ├── flatsome-css-architecture/
│   │   ├── SKILL.md
│   │   └── references/architecture-ruleset.md
│   ├── flatsome-uxbuilder-design/SKILL.md
│   ├── wordpress-functions-zero-hardcode/SKILL.md
│   └── wordpress-packaging-handover/
│       ├── SKILL.md
│       ├── scripts/   (bundler, cleaner, config_patcher, db_sanitizer, handover,
│       │               installer_builder, safe_replacer, lib/find-binary.mjs)
│       ├── templates/ (dynamic-config-snippet.php, htaccess-standard.txt, setup-template.php)
│       └── tests/     (7 file test_*.mjs + test_find_binary.mjs mới)
├── plugin.json                              # Antigravity plugin marker
├── .claude-plugin/{plugin.json, marketplace.json}
├── .codex-plugin/plugin.json
├── rules/AGENTS.md                          # Rule ngắn nạp khi plugin bật (Antigravity)
├── AGENTS.md                                # Hướng dẫn cho agent đóng góp vào repo này
├── .githooks/pre-commit                     # chạy validate (gồm denylist cục bộ)
├── .githooks/pre-push                       # chạy validate --history
├── scripts/
│   ├── install.mjs                          # CLI cài đặt (cũng là "bin")
│   ├── validate-skills.mjs
│   ├── run-tests.mjs                        # liệt kê file test tường minh rồi gọi node --test
│   └── lib/
│       ├── targets.mjs                      # bảng đường dẫn đích theo agent/scope
│       ├── fs-utils.mjs                     # copy có filter, staging + rename atomic, backup
│       └── frontmatter.mjs                  # parser frontmatter tập con nghiêm ngặt
├── tests/{install.test.mjs, validate.test.mjs, frontmatter.test.mjs, fixtures/}
├── .github/workflows/ci.yml
├── docs/{authoring-guide.md, superpowers/specs/…}
├── package.json
├── README.md / README.vi.md / CHANGELOG.md / LICENSE (MIT)
├── .gitignore                               # gồm .validate-denylist
└── .gitattributes                           # * text=auto eol=lf
```

### 3.1 Manifest

- **`plugin.json` (Antigravity):** `{ "name": "wordpress-agent-skills" }`
- **`.claude-plugin/plugin.json`:** `name`, `description`, `version`, `author`, `homepage`, `repository`, `license: "MIT"`, `keywords`
- **`.claude-plugin/marketplace.json`:** marketplace `name: "wordpress-agent-skills"`, `owner`, 1 plugin với `source: "./"` và `version` khớp
- **`.codex-plugin/plugin.json`:** `name`, `version`, `description`, `author`, `license`, `"skills": "./skills/"`, `interface` (displayName, shortDescription, category `"Developer Tools"`). Định dạng xác nhận lại ở S0.2
- **`package.json`:**
  - `"type": "module"`, `"engines": { "node": ">=20" }`
  - `"bin": { "wordpress-agent-skills": "scripts/install.mjs" }`
  - scripts:
    - `validate` = `node scripts/validate-skills.mjs`
    - `test` = `node scripts/run-tests.mjs`
    - `setup-hooks` = `git config core.hooksPath .githooks`
  - `files` giới hạn trong `skills/`, `scripts/`, manifest, README, LICENSE

### 3.2 Rules

- **`rules/AGENTS.md`** (≤ 15 dòng): "Với site Flatsome/UX Builder, code `functions.php` có dữ liệu nghiệp vụ, hoặc việc đóng gói/bàn giao khách, đọc `wp-agency-router`. Việc WordPress khác: dùng `wordpress-router` của WordPress/agent-skills nếu có."
- **`AGENTS.md`** ở root: dành cho agent đóng góp vào repo. Nội dung gồm:
  - cấu trúc repo
  - chạy `npm run setup-hooks` **ngay sau khi clone, trước commit đầu tiên**
  - luôn chạy `npm run validate && npm test`
  - không thêm path cá nhân hay tên khách
  - **merge PR từ fork thì chạy `npm run validate -- --history` cục bộ trên nhánh đó trước** (CI của fork không có denylist)
  - trỏ tới `docs/authoring-guide.md`

---

## 4. Làm sạch 4 skill (sanitization)

### 4.1 Bảng thay đổi

| Loại | Vị trí | Xử lý |
|---|---|---|
| Path máy cá nhân `C:\Users\<user>\.gemini\...` | `wordpress-packaging-handover/SKILL.md` (mục CLI, 4 chỗ). Header `* Module:` trong 7 script + 7 test | SKILL.md đổi thành `node <skill-dir>/scripts/handover.mjs` kèm giải thích `<skill-dir>`. Header chỉ ghi tên file tương đối |
| Tên khách/dự án thật: prefix function/shortcode, hằng `*_DEMO_MODE`, category UX Builder, thư mục dự án/DB, tên công ty, chi nhánh, **domain site khách (kể cả dạng viết liền không dấu)**. Danh sách đầy đủ chỉ nằm trong `.validate-denylist` cục bộ | `flatsome-uxbuilder-design/SKILL.md`, `wordpress-functions-zero-hardcode/SKILL.md`, `wordpress-packaging-handover/SKILL.md`, `templates/setup-template.php`, `scripts/db_sanitizer.mjs`, `scripts/handover.mjs` (help text), `tests/test_db_sanitizer.mjs` (domain đích trong test replace), các test khác | Thay bằng tên trung tính: prefix `acme_` / `ACME_DEMO_MODE`, category `Acme Booking`, dự án `demo_site`, domain `https://demo-site.example`, công ty `Công ty ABC`, chi nhánh `Chi nhánh A`. Giữ câu chuyện bối cảnh. Default DB trong setup-template đổi thành `wordpress` / `database.sql` |
| **`flatsome-css-architecture`** (SKILL.md **và** `references/architecture-ruleset.md`) | Toàn bộ, gồm `description` trong frontmatter | Quét bằng V3 (denylist + squash) ở S0.5. Mọi domain hoặc tên khách tìm thấy được xử lý như dòng trên. Nhãn section chung như `[HOME:WHY-US]` được giữ lại |
| Byte-length serialized trong test | `tests/test_safe_replacer.mjs` (chuỗi `s:27:"http://localhost/<project>"`) | Tính lại độ dài theo chuỗi mới (`http://localhost/demo_site` = 26 byte). Test phải tiếp tục pass |
| Binary cố định (đường dẫn XAMPP mặc định tới `php.exe`, `mysqldump.exe`) | `bundler.mjs`, `cleaner.mjs`, `db_sanitizer.mjs`, `test_config_patcher`, `test_db_sanitizer`, `test_installer_builder` | Thêm `skills/wordpress-packaging-handover/scripts/lib/find-binary.mjs` → `findBinary(name)`. Thứ tự tìm: (1) env `PHP_BIN` / `MYSQLDUMP_BIN` / `MYSQL_BIN`, (2) `PATH`, (3) ứng viên phổ biến: XAMPP, Laragon (glob phiên bản), MAMP, `/usr/bin`, `/usr/local/bin`, `/opt/homebrew/bin`. Không tìm thấy thì trả `null`. Có test riêng `test_find_binary.mjs` |
| Test phụ thuộc site thật | `test_db_sanitizer.mjs` (`LIVE_PROJECT_PATH`) | Chỉ chạy khi có env `WP_LIVE_PROJECT`, không có thì `t.skip()` |
| Danh sách loại trừ của cleaner | `cleaner.mjs` (mục `.gemini`) | **Thay đổi hành vi:** giữ `.gemini`, bổ sung `.claude`, `.codex`, `.agents`, `.cursor`. Thêm test trong `test_cleaner.mjs` xác nhận 5 thư mục này bị loại khỏi gói. Ghi vào `CHANGELOG.md` mục *Changed* |

Các ví dụ dùng domain công khai (`postimg.cc`, `imgur.com`, `unsplash.com`) trong skill zero-hardcode được **giữ**, vì đó là nội dung của luật.

### 4.2 Quy trình nhập skill — làm sạch trước commit đầu tiên

**Thứ tự bắt buộc** (plan phải giữ đúng thứ tự này):

1. Tạo `validate-skills.mjs`, `.githooks/` và `package.json`, rồi chạy `npm run setup-hooks`. Việc này **phải xong trước khi có bất kỳ commit nào chứa nội dung skill**, để hook `pre-commit` chặn được ngay commit đầu tiên. Commit spec hiện có đã được quét sạch.
2. Copy 4 skill vào `skills/` trong working tree, **không `git add`**.
3. Làm sạch theo 4.1.
4. Chạy `npm run validate` (có denylist cục bộ) cho tới khi sạch.
5. Lúc đó mới `git add` / commit. Hook `pre-commit` là lớp chặn thứ hai. Không tạo commit trung gian nào chứa bản chưa sạch.
6. **Trước push đầu tiên:** chạy `npm run validate -- --history` (hook `pre-push` cũng chạy lệnh này). Nếu có vi phạm thì rewrite lịch sử local (chưa push nên rewrite an toàn) rồi mới push.

### 4.3 Chặn tái phạm (3 lớp)

1. **Pattern chung** (public, chạy ở mọi nơi):
   - `` [A-Za-z]:[\\/]+Users[\\/]+(?!<|(?:Public|Default)(?:[\\/]|$))[^\\/\s"'`]+ ``. Pattern này bắt cả `\`, `/` lẫn dạng đã escape `\\`, và đã được kiểm thử với 8 trường hợp, gồm cả `Publicity` không được miễn.
   - `/home/[^/\s<]+/` <!-- validate-allow-path: pattern tự khớp chính nó -->
   - `/Users/[^/\s<]+/` <!-- validate-allow-path -->

   **Miễn trừ (chỉ cho pattern, không bao giờ cho denylist):**
   - file nằm dưới `tests/fixtures/`
   - dòng có chứa pragma `validate-allow-path`, dùng cho ví dụ trong tài liệu
2. **Denylist riêng tư** `.validate-denylist` (gitignored). Mỗi dòng được so khớp theo hai cách, đều không phân biệt hoa thường:
   - **literal:** khớp nguyên chuỗi
   - **squash:** bỏ dấu tiếng Việt (NFD + loại bỏ dấu, `đ→d`) và mọi ký tự ngoài `[a-z0-9]`, rồi tìm trong dòng cũng đã squash. Nhờ vậy một mục như `Hoa_Mai` bắt được cả `hoamai.vn` hay `Hoa Mai`.
   - Mục squash ngắn hơn 5 ký tự thì chỉ so literal, để tránh báo nhầm.
   - Denylist gồm cả tên profile Windows của máy tác giả và phần trước `@` của email cá nhân, làm lớp dự phòng cho pattern. Manifest chỉ ghi GitHub handle và URL của tác giả, không ghi email.
3. **Nơi chạy denylist:**
   - **Git hook cục bộ** (cài bằng `npm run setup-hooks`): `pre-commit` → `validate`, `pre-push` → `validate --history`.
   - **CI:** secret `VALIDATE_DENYLIST` (nhiều dòng) được ghi ra `.validate-denylist` trước bước validate. Nếu secret không có (PR từ fork), CI in cảnh báo rõ ràng và chỉ chạy phần pattern chung. Nhánh `main` của chính repo luôn có secret. Người merge tự chạy `validate --history` cho PR từ fork (mục 11).
- **Allowlist** path công cụ phổ biến (`C:\xampp\`, `C:\laragon\`, `/Applications/MAMP/`) chỉ áp dụng trong `find-binary.mjs`.

### 4.4 Chuẩn hoá frontmatter

- Mọi SKILL.md có `name`, `description`, `compatibility` theo cú pháp ở mục 8.1.
- `description` của `wordpress-packaging-handover` bổ sung câu trigger tiếng Việt.
- UTF-8 không BOM, line ending LF.

---

## 5. Router `wp-agency-router`

### 5.1 Phạm vi — không tranh trigger với upstream

Upstream `wordpress-router` tự nhận "classify WordPress repos and route". Router này **không** tự nhận "dùng đầu tiên cho mọi việc WordPress". Nó chỉ xử lý nhóm việc agency:

- `description`: "Use for agency/client WordPress work: Flatsome child themes and UX Builder pages, business-data code in functions.php (shortcodes, CPT, ACF, prices, bookings), and packaging/migrating/handing over a site to a client. Routes to the right skill in this pack; for other WordPress work (blocks, block themes, REST, WP-CLI, performance…) defers to the official `wordpress-router` if installed. Dùng cho site Flatsome, code functions.php dữ liệu nghiệp vụ, đóng gói/bàn giao web cho khách."
- `compatibility`: "WordPress 6.0+, PHP 7.4+. Filesystem-based agent; no scripts required."

### 5.2 Quy trình trong SKILL.md

1. **Nhận diện nhanh** bằng cách đọc file, không cần script:
   - `style.css` có `Template: flatsome` → site Flatsome
   - có `wp-config.php` + `wp-content/` → full site
2. **Định tuyến trong pack:**

   | Việc cần làm / từ khoá | Skill |
   |---|---|
   | CSS, responsive, `style.css` child theme Flatsome, vỡ layout | `flatsome-css-architecture` |
   | Dựng trang/section, UX Builder, `[section]` `[row]` `[col]` `[ux_text]` | `flatsome-uxbuilder-design` **+** `flatsome-css-architecture` |
   | `functions.php`, shortcode, CPT, taxonomy, ACF, giá/chi nhánh/trạng thái đặt chỗ | `wordpress-functions-zero-hardcode` |
   | Đóng gói, backup, migrate, bàn giao, `setup.php`, search-replace URL | `wordpress-packaging-handover` |

3. **Ngoài pack — định tuyến theo nhóm việc, không liệt kê cứng 19 skill:**
   - Nếu có skill `wordpress-router` (upstream) → chuyển sang nó.
   - Nếu không có, gợi ý theo nhóm, mỗi nhóm kèm *ví dụ* tên skill upstream tại thời điểm viết:
     - Block / block theme / pattern
     - API (REST, Interactivity, Abilities)
     - Vận hành (WP-CLI, performance, PHPStan)
     - Môi trường (wp-env, Playground, Blueprint)
     - Phát hành plugin (directory guidelines)

     Agent dùng skill nào khớp nếu có, nếu không thì làm bằng kiến thức chung. Router cũng in một dòng hướng dẫn cài upstream (`/plugin marketplace add WordPress/agent-skills` cho Claude; với các agent khác thì trỏ tới README upstream).
   - **Không chặn người dùng** khi upstream vắng mặt.
4. **Chuỗi kiểm tra trước bàn giao** (site Flatsome): zero-hardcode → css → uxbuilder → packaging.

### 5.3 `references/decision-tree.md`

Tiếng Việt. Gồm bước nhận diện chi tiết và 10–15 ví dụ câu người dùng ánh xạ sang skill (hoặc sang "upstream / nhóm X").

---

## 6. `scripts/install.mjs`

### 6.1 CLI (v1.0)

```text
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

### 6.2 Bảng đích (`scripts/lib/targets.mjs`, xác nhận lại ở Bước 0)

| Agent | Global | Project |
|---|---|---|
| antigravity | Nếu `~/.gemini/config/` tồn tại (bố cục hiện hành) → `~/.gemini/config/skills`. Nếu không → `~/.gemini/antigravity/skills` (bố cục cũ). Override bằng env `ANTIGRAVITY_SKILLS_DIR` | `<proj>/.agents/skills` |
| claude | `${CLAUDE_CONFIG_DIR:-~/.claude}/skills` | `<proj>/.claude/skills` |
| codex | `${CODEX_HOME:-~/.codex}/skills` | `<proj>/.agents/skills` (chờ S0.2) |

- Các đích trùng nhau được gộp lại, chỉ ghi một lần. Nếu S0.2 cho thấy Codex dùng thư mục project khác thì sẽ không có gộp, và code vẫn đúng vì gộp chỉ là so sánh đường dẫn.
- HOME lấy từ `os.homedir()`, có thể override bằng env `WAS_HOME` để test.

### 6.3 Luật an toàn

1. **Marker:** `<dest>/.wordpress-agent-skills.json` = `{ "package": "wordpress-agent-skills", "version": "<x.y.z>", "installedAt": "<ISO>" }`. **Không có trường `source` hay đường dẫn nào**, vì ở chế độ project người dùng sẽ commit thư mục skill, và một đường dẫn máy trong marker sẽ bị commit theo. Ở v1.0 chỉ có mode copy, nên marker luôn nằm trong bản copy và không cần sidecar.
2. **Phân loại đích:** `new` · `update` (có marker của ta) · `conflict` (tồn tại, không có marker) · `skip-plugin` (agent đã cài plugin).
3. **`conflict`:** không có `--force` thì không đụng vào, exit `2`. Có `--force` thì chuyển bản cũ sang `~/.wordpress-agent-skills/backups/<YYYYMMDD-HHmmss>/<agent>/<name>/` (ngoài mọi thư mục mà agent quét), rồi cài.
4. **Ghi atomic** (áp dụng cho `new`, `update` và `--force`):
   1. Copy vào thư mục staging `<skills-root>/../.wordpress-agent-skills-staging/<name>-<rand>/`, áp dụng bộ lọc ở mục 6. **Sau khi copy xong** mới ghi marker vào staging. Bộ lọc bỏ file bắt đầu bằng `.` chỉ áp dụng cho file nguồn, không áp dụng cho marker do tool tự tạo. Thư mục staging nằm cạnh thư mục `skills/`, cùng ổ đĩa nên `rename` được, và không nằm trong thư mục mà agent quét skill.
   2. Nếu đích đã tồn tại: `rename(dest → staging/<name>-old-<rand>)`.
   3. `rename(staging/new → dest)`. Marker vào đích cùng lúc với nội dung skill, nên không bao giờ có trạng thái "skill đã có nhưng thiếu marker".
   4. Thành công thì xoá bản `-old` (khi `--force` thì chuyển bản này vào backups). Lỗi ở bước 3 thì `rename` bản `-old` về `dest` (rollback) và exit `1`.
   5. Đầu mỗi lần chạy, dọn các thư mục staging sót lại từ lần chạy trước bị ngắt.
5. **Phát hiện plugin:**
   - antigravity: có `~/.gemini/config/plugins/wordpress-agent-skills/plugin.json`
   - claude: trong `~/.claude/plugins/` có `.claude-plugin/plugin.json` với `name` = `wordpress-agent-skills`

   Nếu có → `skip-plugin` kèm cảnh báo. `--force` thì vẫn cài.
6. **Bộ lọc copy (áp dụng cho file nguồn):** bỏ `tests/`, `node_modules/`, file hoặc thư mục bắt đầu bằng `.`.
7. **`--uninstall`:** chỉ xoá đích có marker của ta.
8. **Output:** bảng `agent | skill | dest | action`. Exit code: `0` ok · `1` lỗi · `2` còn conflict.

---

## 7. Hướng dẫn cài (README)

| Agent | Khuyến nghị | Cập nhật | Thay thế |
|---|---|---|---|
| Antigravity | `git clone https://github.com/khoazandev/Wordpress-agent-skills ~/.gemini/config/plugins/wordpress-agent-skills` (đường dẫn plugin xác nhận ở S0.1) | `git -C <dir> pull` | `npx github:khoazandev/Wordpress-agent-skills --agents=antigravity` |
| Claude Code | `/plugin marketplace add khoazandev/Wordpress-agent-skills` → `/plugin install wordpress-agent-skills@wordpress-agent-skills` | `/plugin marketplace update wordpress-agent-skills` | `npx … --agents=claude` |
| Codex | `npx github:khoazandev/Wordpress-agent-skills --agents=codex` | chạy lại | manifest `.codex-plugin/` |
| Repo dự án | `npx github:khoazandev/Wordpress-agent-skills --project .` rồi commit thư mục skill được tạo | chạy lại | — |

README còn có các mục: danh sách skill, "Dùng cùng WordPress/agent-skills", yêu cầu (Node ≥ 20; PHP/mysqldump chỉ cần cho packaging-handover), gỡ cài đặt, đóng góp (`npm run setup-hooks`), license.

### 7.1 Chuyển đổi trên máy tác giả (bước cuối plan, cần xác nhận)

1. Cài kiểu plugin Antigravity (clone vào thư mục plugins).
2. **Kiểm tra trước:** Antigravity nhận đủ 5 skill qua plugin (tên có namespace của plugin). Trong lúc này 4 skill bị trùng tạm thời với bản cũ, chấp nhận được. Nếu plugin không nạp `skills/` như giả định thì **dừng lại**: giữ nguyên bản cũ, dùng `install.mjs --agents=antigravity --force` làm phương án thay thế, rồi cập nhật README.
3. Chỉ khi bước 2 đạt mới chuyển 4 thư mục cũ trong `~/.gemini/config/skills/` vào `~/.wordpress-agent-skills/backups/` (không xoá cứng).
4. Kiểm tra lại: đủ 5 skill, không còn trùng.

---

## 8. `scripts/validate-skills.mjs`

### 8.1 Cú pháp frontmatter được hỗ trợ (tập con nghiêm ngặt)

- Khối mở bằng dòng `---` đầu file và đóng bằng dòng `---`.
- Mỗi dòng có dạng `key: value`, với `key` khớp `^[a-z][a-z0-9_-]*$`.
- `value` chỉ được là một trong hai dạng:
  - **Chuỗi ngoặc kép trên một dòng:** `"..."`. Escape được hỗ trợ: `\"`, `\\`. Escape khác báo lỗi.
  - **Plain scalar trên một dòng:** không bắt đầu bằng `"`, `'`, `>`, `|`, `[`, `{`, `&`, `*`, `!`, và không chứa `: ` hoặc ` #`.
- **Mọi cú pháp khác** (block scalar `>`/`|`, chuỗi nháy đơn, giá trị nhiều dòng, list, map lồng) → lỗi V1, kèm thông báo "unsupported frontmatter syntax; use a single-line double-quoted string".
- **`description` bắt buộc dùng chuỗi ngoặc kép**, kể cả khi không có dấu `:`, để người viết khỏi phải nhớ khi nào thì cần. Các key khác được phép dùng plain scalar, ví dụ `compatibility: WordPress 6.0+, PHP 7.4+` (không chứa `: `).
- Cả 4 skill hiện có đều dùng chuỗi ngoặc kép một dòng, nên tương thích.

### 8.2 Luật

| # | Luật |
|---|---|
| V1 | Mỗi `skills/<dir>/SKILL.md` tồn tại. Frontmatter đúng cú pháp 8.1, `description` dùng ngoặc kép. `name === <dir>` và khớp `^[a-z0-9-]+$`. `description` dài 1–1024 ký tự. Có `compatibility` |
| V2 | Kiểm tra đường dẫn tương đối **chỉ khi nó đứng đầu token**: token (trong backtick, link markdown, hoặc tách bởi khoảng trắng) bắt đầu đúng bằng `references/`, `scripts/`, `templates/` hoặc `./`, không có segment nào phía trước. File được trỏ tới phải tồn tại trong thư mục skill. Token như `shared/scripts/x.mjs` hoặc `<skill-dir>/scripts/…` không bị kiểm tra |
| V3 | Pattern chung (4.3.1) trên mọi file text của repo, trừ allowlist và miễn trừ của 4.3.1. Denylist (4.3.2) nếu `.validate-denylist` tồn tại, **không có miễn trừ nào**. Cờ `--history`: áp V3 lên mọi blob text trong `git rev-list --all` |
| V4 | `version` và `name` khớp nhau giữa `package.json`, `.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json` (plugins[0]), `.codex-plugin/plugin.json` |
| V5 | `skills/wp-agency-router/SKILL.md` nhắc tên mọi skill khác trong `skills/` |
| V6 | Mọi file `.md/.mjs/.php/.json/.txt` decode được UTF-8 hợp lệ, không BOM |

- Output: `file:line: [Vx] message`. Có lỗi thì exit `1`.
- Cờ hỗ trợ: `--root=<path>` (test với fixture), `--history`, `--denylist=<path>` (CI và test).
- Bản thân `validate-skills.mjs` cũng bị quét. Regex trong source phải viết dạng escape (`\/home\/`, `[\\/]`) để không tự khớp chính nó; nếu không tránh được thì dùng pragma `validate-allow-path`. Test `validate.test.mjs` chạy validate trên chính repo và kỳ vọng sạch.

---

## 9. Test

- **Runner:** `scripts/run-tests.mjs`
  - Dùng `fs.readdir` để liệt kê **tường minh** `tests/*.test.mjs` và `skills/*/tests/test_*.mjs`, sắp xếp, rồi gọi `node --test <file1> <file2> …` và trả về đúng exit code.
  - Lý do: đã kiểm chứng trên Node 24 rằng `node --test tests/` báo `Cannot find module`, còn `node --test` không đối số chỉ tự tìm `*.test.mjs`, bỏ sót file kiểu `test_*.mjs`.
- **`tests/install.test.mjs`** (HOME giả qua `WAS_HOME`):
  - cài global cho 3 agent
  - chọn đích Antigravity theo bố cục (`config/` có hoặc không) và theo env override
  - `--project` gộp đích trùng
  - conflict → exit 2, không thay đổi gì
  - `--force` có tạo backup
  - update xoá file thừa của version cũ
  - **atomic:** giả lập lỗi ở bước rename (inject fs) → đích cũ còn nguyên, không sót staging
  - dọn staging sót lại
  - `--uninstall` chỉ xoá đích có marker
  - `--dry-run` không ghi gì
  - `skip-plugin`
  - bộ lọc bỏ `tests/`
  - marker được tạo **sau** khi copy, trong staging, nên có mặt ở đích; nội dung marker **chỉ** gồm `package`, `version`, `installedAt` và không chứa đường dẫn nào
- **`tests/frontmatter.test.mjs`:**
  - hợp lệ: chuỗi ngoặc kép có `\"`, có `:` bên trong
  - báo lỗi: `>`, `|`, nháy đơn, nhiều dòng, plain scalar chứa `: `, `description` không dùng ngoặc kép
- **`tests/validate.test.mjs`:**
  - mỗi luật V1–V6 có fixture vi phạm và fixture hợp lệ
  - V2 không báo cho `shared/scripts/x.mjs`
  - V3 pattern: bắt `C:\Users\x`, `C:/Users/x`, `C:\\Users\\x` (đã escape), `/home/x/`, `/Users/x/`; bỏ qua `C:\Users\<user>`, `C:\Users\Public`, `D:/Users/Default`; **không** bỏ qua `C:\Users\Publicity`. Các chuỗi này nằm trong `tests/fixtures/` <!-- validate-allow-path -->
  - V3 squash bắt được dạng viết liền không dấu
  - `--history` trên một repo git tạm có commit cũ chứa chuỗi cấm
- **Test `wordpress-packaging-handover`:** kết quả không tệ hơn mốc S0.4. Thêm test cleaner mới (4.1). Test cần PHP sẽ skip khi không tìm thấy PHP.
- **`test_find_binary.mjs`:** `findBinary(name, deps = {})` nhận các tham số inject sau, mỗi cái có giá trị mặc định:
  - `env` (mặc định `process.env`)
  - `platform` (mặc định `process.platform`)
  - `exists(path) → boolean` (mặc định `fs.existsSync`)
  - `listDir(path) → string[]` (mặc định `fs.readdirSync` có try/catch, dùng cho glob Laragon)

  Hàm tự tính `PATH` delimiter (`;` khi `win32`, `:` khi khác), đuôi file (`PATHEXT`/`.exe` khi `win32`, không có đuôi khi khác) và ghép đường dẫn bằng `path.win32` hoặc `path.posix` **theo `platform` được inject**, không theo hệ điều hành thật. Test truyền filesystem giả (một `Set` các đường dẫn) cho cả hai giá trị `platform: 'win32'` và `'linux'`, nên cùng một bộ test chạy giống nhau trên Windows và Ubuntu. Các trường hợp test:
  - env override thắng
  - tìm thấy trong `PATH`
  - fallback XAMPP / Laragon (chọn phiên bản cao nhất)
  - fallback `/usr/bin`
  - không tìm thấy → `null`

---

## 10. CI — `.github/workflows/ci.yml`

- **Trigger:** `push`, `pull_request`.
- **Matrix:** `os: [ubuntu-latest, windows-latest]` × `node: [20, 22, 24]`, tổng cộng 6 job.
- **Các bước:**
  1. checkout với `fetch-depth: 0` (cần cho `--history`)
  2. setup-node. **Không** bật `cache: npm`, vì repo không có dependency nên không có lockfile, và setup-node sẽ báo lỗi nếu bật cache mà thiếu lockfile
  3. `shivammathur/setup-php` (8.2) **chỉ ở hàng `node: 22`** (2/6 job). Hành vi của PHP không phụ thuộc phiên bản Node, nên các job còn lại để test PHP tự skip qua `findBinary('php') === null`. Như vậy test PHP vẫn chạy trên cả Windows lẫn Ubuntu
  4. ghi secret `VALIDATE_DENYLIST` ra `.validate-denylist` nếu có, không có thì in cảnh báo
  5. `npm run validate -- --history`
  6. `npm test`
  7. `node scripts/install.mjs --dry-run --project "$RUNNER_TEMP/p"`

---

## 11. Phát hành (v1.0)

- **Bump thủ công:** sửa `version` ở 4 manifest. V4 sẽ bắt nếu sót chỗ nào. Cập nhật `CHANGELOG.md` (có mục *Changed* cho thay đổi loại trừ của cleaner), rồi tag `v1.0.0` và tạo GitHub Release.
- **Trước push đầu tiên:** chạy `npm run validate -- --history` (4.2 bước 6) và tạo secret `VALIDATE_DENYLIST` trên GitHub.
- **Merge PR từ fork** (CI không có secret nên CI xanh không đảm bảo sạch tên khách): người merge checkout nhánh PR và chạy `npm run validate -- --history` cục bộ trước khi merge. Quy tắc này ghi vào `AGENTS.md` và mục đóng góp của README.
- **`docs/authoring-guide.md`:**
  - quy ước tên thư mục và frontmatter (cú pháp 8.1). **`description` luôn dùng chuỗi ngoặc kép một dòng**, vì mô tả tiếng Việt hay có dấu `:`
  - cấu trúc `references/` và `scripts/`
  - khai báo skill mới vào router (V5)
  - mục Verification trong mỗi SKILL.md
  - `npm run setup-hooks` (ngay sau khi clone, trước commit đầu tiên)
  - `npm run validate && npm test`

---

## 12. Rủi ro & giảm thiểu

| Rủi ro | Giảm thiểu |
|---|---|
| Đường dẫn của Antigravity/Codex khác giả định hoặc thay đổi | Bước 0 kiểm chứng; mọi đường dẫn gom trong `targets.mjs`; Antigravity phát hiện theo bố cục + env override |
| Trùng skill khi vừa cài plugin vừa chạy `install.mjs` | `skip-plugin` + cảnh báo |
| Ghi đè skill người dùng tự viết | Marker + `conflict` exit 2 + backup khi `--force` |
| Lỗi giữa chừng làm mất skill | Staging + rename + rollback; dọn staging sót lại |
| Tên khách lọt vào repo hoặc lịch sử | Làm sạch trước commit đầu tiên; denylist squash; hook pre-commit/pre-push; CI qua secret; `--history` |
| Denylist bị lộ | Gitignored; CI nạp từ secret |
| Parser frontmatter hiểu sai | Tập con nghiêm ngặt, cú pháp khác thì báo lỗi |
| Router tranh trigger với upstream | Phạm vi hẹp (agency/Flatsome/bàn giao); phần còn lại chuyển sang `wordpress-router` |
| Runner test khác nhau giữa các bản Node | `run-tests.mjs` liệt kê file tường minh; CI chạy Node 20/22/24 |
| Lỗi encoding tiếng Việt | `.gitattributes` eol=lf + V6 |
| Path cá nhân dạng `/` hoặc đã escape trong chuỗi JS | Pattern `[\\/]+` (đã thử với 8 trường hợp) + tên profile máy trong denylist |
| Marker để lộ path máy khi người dùng commit `.agents/skills` | Marker không có trường `source` |

---

## 13. Checklist nghiệm thu thủ công (tiêu chí 1.4.3)

Đây là tiêu chí duy nhất không tự động hoá được. Plan sẽ có một task riêng điền checklist này vào `docs/superpowers/specs/acceptance-v1.0.0.md` trước khi tag `v1.0.0`.

| # | Agent | Cách cài | Kiểm tra | Kết quả |
|---|---|---|---|---|
| M1 | Antigravity | plugin (`git clone` vào thư mục plugins) | Danh sách plugin có `wordpress-agent-skills` và đủ 5 skill; prompt "sửa CSS responsive child theme Flatsome" kích hoạt `wp-agency-router` → `flatsome-css-architecture` | ☐ |
| M2 | Antigravity | `install.mjs --project <tmp>` | Mở `<tmp>` → thấy đủ 5 skill từ `.agents/skills` | ☐ |
| M3 | Claude Code | `/plugin marketplace add` + `/plugin install` | `/skills` liệt kê đủ 5 skill; prompt "đóng gói web gửi khách" kích hoạt `wordpress-packaging-handover` | ☐ |
| M4 | Claude Code | `install.mjs --agents=claude --project <tmp>` | `/skills` trong `<tmp>` thấy đủ 5 skill | ☐ |
| M5 | Codex | `install.mjs --agents=codex` (global) | `/skills` liệt kê đủ 5 skill | ☐ |
| M6 | Codex | `install.mjs --agents=codex --project <tmp>` | `/skills` trong `<tmp>` thấy đủ 5 skill | ☐ |
| M7 | Tất cả | `install.mjs --uninstall` | Các thư mục skill do tool cài đã bị gỡ; skill khác vẫn còn nguyên | ☐ |
