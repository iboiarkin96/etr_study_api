# UI-Kit v2 — bug audit & grouped redesign plan

**Источник:** диалог `69d1abed-1a3a-4944-93d6-7d1f150b5aa5` (2026-05-13 11:51 → 11:54).
**Контекст:** ручное тестирование первой итерации UI-Kit v2. Бэклог собран в 11 групп (A–K).

---

## 1. Исходный список дефектов (как ты прислал)

> Я провёл тестирование доки. Есть много замечаний.

1. **Design philosophy.** Нет описания того, какой подход используется при дизайне фронта (Material Design с минимумом перегруженности современными концепциями, чтобы сделать опыт пользования лучше) — описать прямо в UI-kit. Возможно, UI-kit вообще может заменить перегруженную фронтовую документацию `services/portal/internal/front` (останутся только конкретные экраны и их механика).
2. **Theme toggle.** Где описан переключатель темы? Сделать его в виде фонарика, как было раньше, но усилить дизайнерское решение. Обязательно всплывающее окно о переключении (сейчас есть) — но предложить решение в существующем UI-kit.
3. **`@ivan` в History.** Переделать на полное упоминание пользователя с реальным именем и ссылкой на профиль.
4. **Example boundaries.** Пример сделать или в рамке, или иначе — не понятно, где заканчивается example, а где начинается новый блок описания (пример: `components/footer-history.html`).
5. **TOC modals.** Проверить наличие модалок для TOC в реализации и удалить их в новой реализации.
6. **Rocket animation.** `components/rocket.html` — нужна анимация того, как работает ракета.
7. **TOC showcase.** На `templates/doc-article.html` есть On this page — а где описание этого элемента в UI-kit?
8. **TOC hierarchy.** On this page не реагирует на уровень заголовка (h1, h2, …).
9. **TOC auto-collapse.** On this page не сворачивается сам по себе — использовать `components/toc-fab.html` и расширять область текста, если иконка свёрнута.
10. **Status model.** `templates/doc-explanation.html` не содержит статусной модели, которая есть у текущей ADR-реализации (взять идею и усилить, сделать более привлекательной).
11. **doc-reference.** Плохо проработана `templates/doc-reference.html`.
12. **ops-cockpit filters.** `templates/ops-cockpit.html` — не работают фильтры. Если это шаблон, то он отражает лишь часть функциональности cockpit — расширить и усилить решение.
13. **Editors avatars.** Потеряно решение, что все редакторы страницы отображаются на ней (иконки фото). Решение в старой доке не такое красивое и премиальное — предложить вариант в духе профессиональной стильной топовой IT-компании.
14. **Breadcrumbs.** Сейчас находятся и в шапке, и под h1 (`templates/doc-tutorial.html`): «Study App · Internal / Internal / Frontend / First UI-kit page» — убрать перед h1.
15. **Rocket vs arrow.** Вижу просто стрелочку вверх вместо ракеты (`components/rocket.html`).
16. **Landing-portal hero.** На главной портала должен быть потрясающий дизайн — сейчас используется решение с WebGL, в текущей реализации такого нет (`templates/landing-portal.html`).

> Помни, что мы занимаемся **тотальным редизайном** проектной документации. Рождается абсолютно новый дизайн, и каждое прошлое решение должно браться как baseline и должно быть переделано в новом красивом современном дизайне как у топовых компаний. Должна сохраняться единая стилистика (на то он и UI-kit) и блочность решений (чтобы можно было переиспользовать).

---

## 2. Принципы итерации 2

1. **Каждый предыдущий элемент = baseline.** Не «починить», а **переделать в современном дизайне топовых IT-компаний** (Stripe / Linear / Vercel / Anthropic). Если работает — это всё равно baseline, дизайн пересобирается.
2. **Единая стилистика обязательна.** Один кит → один визуальный язык. Любое решение, выпадающее из ритма (типографика, отступы, motion, accent), — баг.
3. **Блочность.** Каждое решение — переиспользуемый блок. Никаких one-off inline-стилей в шаблонах: появился паттерн дважды → выносим в компонент.
4. **UI-Kit поглощает фронт-доки.** `services/portal/internal/front/` ужимается до экранов и их механики; всё «как мы строим интерфейс» переезжает в UI-Kit.

---

## 3. Группы дефектов

### Группа A — Design philosophy section (новый раздел Foundations)

**Baseline:** в портале нет места, где сформулирован дизайн-подход. Принципы размазаны по `internal/front/foundations/*` и не читаются как канон.

**Что не так:**
- Нет страницы «о чём этот дизайн» — какие принципы, табу, на чём вдохновлялись.
- `internal/front/` дублирует темы, которые логичнее держать в UI-Kit (tokens, motion, css-arch, hotkeys, glossary).

**Что сделать:**
1. Добавить в `nav-tree-uikit.json` группу **Foundations** новый пункт `Design philosophy` (`pages/foundations/philosophy.html`):
   - Тезис подхода: «Material-grounded, минимум перегрузки, premium-restraint». Сформулировать в 3–5 коротких принципах.
   - Что **запрещено** (drop-shadow-кричалки, gradients-без-смысла, иконочный шум, мульти-h1 и т.д.).
   - На чём вдохновлялись (один абзац, без бренд-копирования).
2. Перенести из `internal/front/foundations/` в `pages/foundations/`: `tokens`, `motion`, `css-architecture`, `js-modules`, `hotkeys`. В `internal/front/` оставить redirect-stubs (HTML с `<meta http-equiv="refresh">`).
3. Удалить из `internal/front/` всё, что становится дубликатом UI-Kit. В `nav-tree-internal.json` секцию Frontend урезать до **Screens + Architecture map**.

**Критерии приёмки:**
- [ ] `/services/portal/ui-kit/pages/foundations/philosophy.html` существует, есть в sidebar.
- [ ] 5 foundation-страниц переехали в UI-Kit, старые URL отдают `<meta refresh>` → новые.
- [ ] `internal/front/` содержит только `screens/` + `architecture-map.html` (+ index).
- [ ] Поисковый индекс пересобран; нет ссылок-сирот.

---

### Группа B — Theme toggle: flashlight reborn

**Baseline:** старый портал имел переключатель темы в виде **фонарика** (метафора «освещаем интерфейс»). Сейчас в UI-Kit это просто иконка ◐.

**Что сделать:**
1. Компонент `theme-toggle` переделать в **flashlight**:
   - Иконка фонарика SVG (тонкая линия, premium-look).
   - При клике — короткая анимация «луч» (CSS-only, 200–300 ms, уважает `prefers-reduced-motion`).
2. Toast-уведомление о смене темы (живёт ~2 сек, исчезает плавно). Toast = **новый переиспользуемый компонент** `toast` в UI-Kit. Текущее уведомление — baseline; переделать визуально (тонкая капсула, accent-glow при появлении).
3. На странице `components/theme-toggle.html`:
   - Example демонстрирует фонарик + toast (статический «открытый» вариант).
   - Variants: light → dark, dark → light, system.
   - Описание метафоры (откуда фонарик и зачем).

**Критерии приёмки:**
- [ ] Кнопка во всех `data-component="theme-toggle"` рендерит фонарик-SVG, не ◐.
- [ ] Клик переключает тему **и** показывает toast «Switched to dark/light».
- [ ] Toast — независимый компонент с `components/toast.html` showcase.
- [ ] `prefers-reduced-motion` отключает «луч» и slide-in toast.

---

### Группа C — Page maintainers: premium author chip

**Baseline:** старый портал показывал иконки-фото редакторов рядом со страницей. Реализация — неаккуратная.

**Что не так:**
- В footer-history используется только handle (`@ivan`) — нет имени, нет ссылки.
- Иконки редакторов вообще пропали в новой итерации.

**Что сделать:**
1. Новый компонент `author-chip` (или `maintainer-badge`):
   - Аватар 24/32 px (rounded), имя (Ivan Boyarkin), handle (`@ivan`), линк на профиль (`/internal/team/people/ivan-boyarkin/`).
   - Hover → tooltip с дополнительной мета (role, contact).
   - Группа аватаров (`maintainer-stack`) — overlap с лимитом «+N more», как в Linear/GitHub.
2. В `footer-history` `@ivan` заменить на полноценный chip с именем и линком.
3. В `page-head` добавить опциональный блок `maintainers` — аватары авторов сверху страницы (как в Notion/Linear).
4. Источник данных: уже есть `data-maintainer-ids` на body. Завести JSON `mocks/maintainers.json` с реальными людьми (`ivan-boyarkin`, `kirill-neustroev`, …) — name, handle, avatar, role, profile-url.

**Критерии приёмки:**
- [ ] `components/author-chip.html` + `components/maintainer-stack.html` в showcase.
- [ ] Все вхождения `@ivan` в `docs-history` заменены на chip.
- [ ] Page-head на 3 doc-шаблонах (`article`, `howto`, `explanation`) показывает аватары редакторов вверху.
- [ ] Клик на аватар ведёт на `team/people/<slug>/`.

---

### Группа D — Example boundary clarity

**Baseline:** на всех showcase-страницах секция Example визуально сливается со следующими разделами (Variants/Markup). Пример: `components/footer-history.html`.

**Что сделать:**
1. Завести компонент-обёртку `example-frame` (БЭМ: `.docs-example`):
   - 1px рамка `var(--line)`, `border-radius: var(--radius-lg)`, `padding: var(--space-5)`.
   - Шапка: маленький eyebrow «Example» + опциональный caption.
   - Внизу — тонкий разделитель с «End of example» подписью (или просто шире gap до следующей секции).
2. Все 22 компонентные страницы прогнать через миграцию: завернуть содержимое каждой секции `<section aria-labelledby="…-ex">` в `.docs-example`.

**Критерии приёмки:**
- [ ] Между демо и следующим заголовком есть **минимум 32px** воздуха.
- [ ] Демо визуально «в рамке» — пользователь не путает его с описанием.
- [ ] Showcase `components/example-frame.html` существует и сам себя демонстрирует.

---

### Группа E — TOC system: hierarchy + auto-collapse + showcase

**Baseline:** правая колонка «On this page» (`docs-toc`) рендерится плоским списком, не сворачивается, нет своей showcase-страницы. На мобиле — toc-fab (отдельный компонент, OK).

**Что не так:**
- TOC не учитывает уровень заголовка — h2 и h3 выглядят одинаково.
- TOC не сворачивается, занимает место всегда.
- Нет `components/toc.html` showcase, хотя компонент используется во всех шаблонах.
- В реализации могут быть legacy-модалки TOC — проверить и снести.

**Что сделать:**
1. **Hierarchy:** TOC должен визуально различать h2/h3:
   - h2 = базовый уровень, normal size.
   - h3 = +12px отступ слева, fs-100, color: muted.
   - h4+ скрыть (не рендерить).
2. **Collapse:**
   - Кнопка-toggle справа от заголовка «On this page». Скрытое состояние — `data-collapsed="true"` на `aside.docs-toc`.
   - Когда свёрнут — `main` расширяется до правого края (грид-колонка 3 = 0). Реализовать через `body[data-toc-collapsed="true"] .docs-shell { grid-template-columns: var(--layout-sidebar) minmax(0, 1fr) 0 }`.
   - Состояние persist в `localStorage` (уже есть в `toc.js` — проверить, что таргетит body, не aside, чтобы main мог реагировать).
3. **Showcase:** создать `components/toc.html` (полный — Example, Variants, Markup, States, A11y, Tokens used). В Variants показать: expanded / collapsed / mobile-fab.
4. **Modal audit:** прогрепать репозиторий на `toc.*modal|modal.*toc`. Если нашлась legacy-модалка TOC — удалить, добавить запись в Removed-секцию CHANGELOG.
5. На странице doc-article на двух уровнях заголовков (`h2` + `h3` внутри `why`) убедиться, что иерархия корректно отображается в обоих TOC (right rail + mobile fab).

**Критерии приёмки:**
- [ ] `components/toc.html` существует со всеми каноническими секциями.
- [ ] На `doc-article.html` h3 под `why` отрисованы отступом, не как h2.
- [ ] Кнопка свёртки скрывает список и расширяет main на ширину TOC.
- [ ] `toc-fab` остаётся отдельным компонентом для мобилы — это паттерн «desktop rail / mobile fab».
- [ ] Поиск `toc.*modal` ничего не находит.

---

### Группа F — Rocket: real visual + scroll-to-top metaphor

**Baseline:** компонент `rocket` сейчас рендерит просто стрелочку вверх (SVG arrow). Должна быть **анимированная ракета** с пламенем при клике (запуск).

**Что не так:**
- `components/rocket.html` Example показывает emoji 🚀, без анимации.
- `rocket.js` на doc-страницах рисует обычную fab-стрелку — никакой «ракетности».
- Метафора «back-to-top как запуск» утеряна.

**Что сделать:**
1. `components/rocket.js` переписать:
   - Slot становится fixed-FAB кругом (как сейчас), но **внутри** — SVG-ракета (tail-fin силуэт, не emoji, чтобы тема-агностично).
   - При hover — лёгкое покачивание (idle bob, 3s loop).
   - При клике — анимация «boil & launch»: 200ms нарастающее пламя снизу → 400ms ракета уезжает за верх viewport (translateY(-200%)), параллельно `window.scrollTo({ top:0, behavior:'smooth' })`. После scrollY=0 — ракета «возвращается» (translateY обратно с small fade-in).
   - `prefers-reduced-motion` → мгновенный scrollTo без анимации.
2. Pixel-canvas / WebGL **не нужен** — обычный SVG + CSS keyframes.
3. На `components/rocket.html` Example запускает анимацию циклически (по таймеру в demo) — посетитель должен видеть, как это работает.

**Критерии приёмки:**
- [ ] Все doc-страницы показывают визуально опознаваемую ракету (силуэт, не стрелку, не emoji).
- [ ] Клик запускает анимацию запуска и плавный скролл наверх.
- [ ] Reduced-motion отключает анимацию, но скролл наверх работает.
- [ ] Showcase на `components/rocket.html` демонстрирует все три состояния: idle, hover, launch.

---

### Группа G — Status model (doc-explanation / ADR)

**Baseline:** старая ADR-реализация показывает статусную модель (badges: Proposed / Accepted / Superseded / Deprecated). В новом `doc-explanation.html` есть только пара `docs-pill` рядом с h1.

**Что не так:**
- Статусная модель — **продуктовый паттерн** ADR/RFC, а сейчас она представлена обычным пилем.
- Нет визуальной связи между текущим статусом и историей (Superseded → ссылка на наследника).

**Что сделать:**
1. Новый компонент `status-timeline`:
   - Горизонтальная цепочка: Proposed → Accepted → Active → (Superseded by ADR 0xxx) → (Deprecated).
   - Текущий статус подсвечен accent + glow. Прошлые — фоном `--bg-mute`. Будущие — outline.
   - Под цепочкой строка метаданных: Author, Decided-on, Supersedes, Superseded-by.
2. Внутри `doc-explanation.html` шаблона:
   - Заменить «Date / Status / Supersedes»-`<dl>` на `status-timeline`.
   - Status-pill в page-head — оставить только одну, как акцент.
3. Showcase `components/status-timeline.html` с состояниями: proposed, accepted, superseded.

**Критерии приёмки:**
- [ ] `components/status-timeline.html` в showcase.
- [ ] `doc-explanation.html` использует timeline, а не `<dl>`.
- [ ] Состояние Superseded подсвечивает ссылку на наследника как link-card, не plain `<a>`.

---

### Группа H — doc-reference polish

**Baseline:** `doc-reference.html` — самый «плотный» шаблон (API reference), но визуально он скучный: длинная таблица fields + куски кода друг за другом.

**Что сделать:**
1. **Endpoints как карточки.** Каждый эндпоинт (GET/POST/PATCH) — отдельный `endpoint-card`:
   - Цветной method-badge слева (GET зелёный, POST синий, PATCH оранжевый, DELETE красный).
   - Path рядом моноширинно.
   - Toggle «show example» — раскрывает request + response блоки.
2. **Fields-table улучшить:** sticky-head уже есть; добавить колонку Constraints (min/max/regex), цветной dot для Required (●) vs Optional (○).
3. **Errors-table:** статус-код как pill цветной (4xx — warn, 5xx — danger).
4. Завести компоненты: `endpoint-card`, `method-badge`, `field-row` — все идут в showcase.

**Критерии приёмки:**
- [ ] `doc-reference.html` использует `endpoint-card` минимум для 3 примеров.
- [ ] Все три компонента отдельно задокументированы.
- [ ] Method-badge цвета консистентны с tokens (не inline).

---

### Группа I — ops-cockpit functionality

**Baseline:** `ops-cockpit.html` — статичные карточки KPI + неработающие чипы-фильтры + 4 карточки задач.

**Что не так:**
- Фильтры не кликабельны (только визуал).
- Показан кусок функциональности — нет board / table / timeline переключателя в действии.
- Не видно, что cockpit может быть полноценным дашбордом.

**Что сделать:**
1. Расширить шаблон. Добавить функциональные блоки (хотя бы в showcase-режиме, с мок-JS):
   - **Filter-chips** реально фильтруют карточки на странице (data-attribute matching).
   - **View-switcher** Board / Table / Timeline — переключает layout (board = текущий card grid, table = `docs-table`, timeline = swimlane).
   - **Burnup-chart** компактный sparkline-блок наверху (SVG, без либ).
   - **Owner-stack** на каждой карточке (см. Группа C).
2. Новый компонент `view-switcher` — переиспользуемый блок-переключатель (Stripe-style segmented control).
3. Новый компонент `sparkline` — мини-чарт для KPI.

**Критерии приёмки:**
- [ ] Клик на фильтр-chip скрывает не подходящие карточки, обновляет URL hash.
- [ ] View-switcher переключает layout без перезагрузки.
- [ ] Sparkline отрисован SVG-only, без библиотек.
- [ ] Cockpit-шаблон выглядит как продукт уровня Linear/Height, не как mock.

---

### Группа J — Breadcrumbs dedup

**Baseline:** на всех doc-шаблонах хлебные крошки рендерятся **дважды**: один раз в topbar и второй раз в `<main>` над h1.

**Что не так:**
- Дублирование = шум.
- Эстетически грязно.

**Что сделать:**
1. Канон: **крошки только в topbar.** Из `<main>` блок `<nav class="docs-breadcrumbs">` убрать на всех 9 шаблонах.
2. На мобиле (≤760), где topbar-крошки `display:none`, показывать крошки **под** h1 как `eyebrow` — компактно, fs-100, muted.
3. Обновить page-head компонент: добавить опциональный slot `eyebrow-breadcrumbs` (показывается только на мобиле).

**Критерии приёмки:**
- [ ] Ни один doc-шаблон не содержит `<nav class="docs-breadcrumbs">` внутри `<main>`.
- [ ] На десктопе крошки только сверху.
- [ ] На мобиле крошки видны под h1.

---

### Группа K — Landing-portal: hero worth opening

**Baseline:** старый портал имел WebGL-flowfield на главной (`home-webgl.js`). В новой реализации этого нет — просто emoji 🚀 в сетке.

**Что не так:**
- Главная не вызывает «вау» — выглядит как landing-template, а не флагман.

**Что сделать:**
1. Восстановить WebGL-фон, но **переделать**:
   - Не повторяем старый flowfield 1:1 — новый shader, тоньше, благороднее (мягкий gradient mesh с micro-noise, как у Vercel-home).
   - Уважает `prefers-reduced-motion` (статичный gradient fallback).
   - Скрывается на ≤1024 (как baseline) — мобиле даём статический mesh.
2. Hero-блок переработать:
   - h1 крупнее, font-feature-settings включены (числовая стилистика).
   - Eyebrow-tag «Internal portal · v2» с accent-pulse-glow (CSS-only).
   - 2 CTA-кнопки + 3 status-pills, как сейчас, но в новой типографике.
3. Заменить emoji 🚀 на тот же SVG-rocket из группы F (idle bob) — но в крупном размере (hero-rocket variant).

**Критерии приёмки:**
- [ ] `home-webgl-v2.js` (или эквивалент) загружается лениво, инициализируется только на ≥1025.
- [ ] Reduced-motion → static gradient, никаких rAF.
- [ ] Hero визуально опознаётся как «не template», открывается в браузере и хочется фотографировать.

---

## 4. Сводная таблица файлов

| Группа | Создать | Изменить | Удалить |
|--------|---------|----------|---------|
| A | `pages/foundations/philosophy.html`, перенос 5 foundation-страниц | `nav-tree-uikit.json`, `nav-tree-internal.json` | дубли в `internal/front/foundations/` |
| B | `components/toast.html`, `components/toast.css/js` | `theme-toggle.js/css`, `components/theme-toggle.html` | — |
| C | `components/author-chip.html`, `components/maintainer-stack.html`, `mocks/maintainers.json` | все `docs-history` блоки, page-head | старые inline `@ivan` |
| D | `components/example-frame.html`, `components/docs-example.css` | 22 showcase-страницы | — |
| E | `components/toc.html` | `toc.js`, `toc.css`, `layout.css`, все 5 doc-шаблонов | legacy TOC-модалки |
| F | новый SVG-rocket asset | `components/rocket.js/css/.html`, `landing-portal.html` | старая стрелка scroll-top |
| G | `components/status-timeline.html` + CSS/JS | `doc-explanation.html` | старый `<dl>` блок |
| H | `components/endpoint-card.html`, `method-badge.html`, `field-row.html` | `doc-reference.html` | — |
| I | `components/view-switcher.html`, `components/sparkline.html` | `ops-cockpit.html` | non-functional chip-фильтры |
| J | — | 9 doc-шаблонов | `<nav class="docs-breadcrumbs">` из `<main>` |
| K | новый WebGL shader | `landing-portal.html`, `scene-bg.css` | дубль emoji-rocket |

---

## 5. Глобальные критерии приёмки

1. Sidebar и topbar нигде не меняются между шаблонами — единый shell.
2. Ни один компонент не использует inline-стили вне `<demo>`-блока (всё через токены и BEM).
3. `prefers-reduced-motion` уважается **везде**, где есть motion.
4. Поисковый индекс пересобран, нет 404 ни в одной nav-tree (4963+ ссылок продолжают резолвиться).
5. CHANGELOG обновлён: Added — 11 групп; Removed — TOC-modal, дубль-крошки, legacy 🚀-emoji.
6. `pre-commit` зелёный (h1-structure, asset-refs, html5-parse).

---

## 6. Статус групп (заполнять по мере работы)

- [x] **A.** Design philosophy section — `pages/foundations/philosophy.html` создан (коммит `f38fa66`, 2026-05-13 12:00–12:02). Foundation-перенос — частично.
- [ ] **B.** Theme toggle flashlight + toast
- [ ] **C.** Maintainer chips + author stack
- [ ] **D.** Example frame
- [ ] **E.** TOC hierarchy + collapse + showcase + modal audit
- [ ] **F.** Rocket SVG + launch animation
- [ ] **G.** Status timeline
- [ ] **H.** doc-reference polish (endpoint-card, method-badge, field-row)
- [ ] **I.** ops-cockpit functionality (filters, view-switcher, sparkline)
- [ ] **J.** Breadcrumbs dedup
- [ ] **K.** Landing-portal WebGL hero
