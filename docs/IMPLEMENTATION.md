# Реализация и приёмка

Дата: 2026-09-14. Работа начата с пустого веб-репозитория.

Исходные ревизии:

- Android `4f74cd3bc2480ecf49efe20b3695de95a5104a38`.
- Backend `eaac6444bd3f5f29865aaf298e814fa0635b22c0` (`feat/live-coach-streaming`).
- В backend добавлены только браузерный контроллер/security chain и их тесты.

## Фактическая готовность

| Область | Реализовано | Ещё требуется |
|---|---|---|
| Основа | React, Router, CSS Modules оболочки, светлая/тёмная/системная темы, фирменные цвета/иконки, responsive navigation, manifest, SW, PNG иконки iPhone | Приёмка физического iPhone, миграция следующей версии БД и тест обновления установленной PWA |
| Аккаунт | Email login/register/verify/reset, Google GIS с nonce, список и отзыв сессий, logout, профиль; HttpOnly Secure SameSite cookie, Origin+CSRF; access только в памяти | Сквозная проверка на HTTPS, OAuth client ID/audience/origin, почта, отзыв аккаунта, Android guest claim/merge |
| Синхронизация | v3 headers, capabilities, каталог, UUID, baselines, exact-byte outbox replay, транзакционный ACK, непересекающиеся поля, явные конфликты, owner isolation; активная сессия блокирует обычный sync | Реальный сквозной цикл Android↔Web, политика новых/неподдерживаемых схем, полный набор удаления связанных объектов, сетевые гонки на production-подобном backend |
| Каталог | Поиск, создание/редактирование пользовательских упражнений; сохранение неизвестных полей; загрузка стандартного каталога | Полные редакторы карты мышц и оборудования упражнения, личные подсказки стандартных упражнений, архивированные каталожные ссылки |
| Программы и залы | Создание/редактирование/удаление с проверкой ссылок, подбор упражнений, запуск, список оборудования зала | Полный редактор плановых подходов/отдыха и связей с залами; перестановка в программе; расширенная проверка оборудования |
| Тренировка | Свободная/из программы, подходы, вес/повторы/длительность, заметка, завершение, история, перестановка секций кнопками, удаление секций, восстановление и таймер; один редактор между вкладками, опциональный wake lock | Скорость/уклон, типы подходов, аннотации подходов, удаление отдельного подхода, звуковой сигнал; полный Live Coach tool loop и подтверждение команд |
| Календарь | Разовые планы, еженедельные правила, отмены/переносы экземпляра, timezone, DST gap/overlap по Android, детерминированные ID исключений | Редактор/удаление всей серии, legacy migration/guest rules, полный набор CAL-01 fixtures |
| Аналитика | Выполненные силовые объёмы, число тренировок/подходов, история объёма, рекорды веса | Полный AnalyticsEngine: рабочие/эффективные подходы, нагрузки и баланс мышц, периоды, MET, тренды, streak, карты мышц и общие golden tests |
| Замеры | Ручное создание/редактирование/удаление основных замеров с сохранением остальных полей | UI всех остальных ручных полей, тренды замеров |
| InBody | Фото, серверное согласие на передачу AI, распознавание, редактируемый preview всех значений и сегментов, сохранение после подтверждения | Сквозная проверка с настроенным AI, shared fixture/parity, UX отзыва AI-согласия |
| AI | Упражнение и календарный draft; просмотр перед записью; проверка revision при сохранении упражнения; запросы не повторяются автоматически | Полный потоковый Live Coach, stale/error/interrupt fixtures, перенос Android tool schemas и мутаций |
| Тренеры | Каталоги coaches/clients с пагинацией, создание/принятие приглашения с явными scopes, отзыв связи, список/preview/approve/reject предложений; exact approval body сохранён для явного повтора | Создание/редактирование/отзыв предложения тренером, проекции календаря/истории клиента, интеграционные тесты и UX окончательно отклонённых pending approvals |
| Выпуск | Nginx same-origin конфигурация, SSE без буферизации, версионный архив | Адрес/SSH alias и путь сервера, DNS/TLS, OAuth, почта, AI; установка backend, smoke checks и проверенный rollback |

Исключения из исходного плана соблюдены: внешнего календаря, Xiaomi, APK обновлений, lock-screen управления, push и отдельного экрана «Здоровье» нет. Существующие серверные health ledger данные не изменяются; endpoint согласия используется только перед фото InBody.

## Проверки, выполненные в этой среде

- Production build TypeScript + Vite + PWA: проходит.
- Vitest: 13 тестов (merge, exact replay, edit during pending ACK, owner isolation, DB reopening, active sync deferral, Android snapshot volume, profile UUID, DST, missing snapshot preservation, storage failure UI).
- Playwright: 8 успешно, 1 явно пропущен. Chromium и Firefox: цикл дневника, две вкладки, SW offline restart. WebKit iPhone viewport: цикл дневника и две вкладки. Service Worker offline test в WebKit требует отдельной приёмки на устройстве.
- Kotlin compile: проходит.
- WebAuthControllerTest: 4 теста проходят (Origin, CSRF, cookie-only refresh secret, стабильный CSRF token).
- Полный backend suite: 47 тестов/инициализаций; 41 успешно, 6 integration suite initialization failures из-за отсутствия Docker/Testcontainers. Это **не** результат успешного интеграционного прогона.
- Веб `npm install`: аудит 0 уязвимостей при установке зафиксированного lockfile.
- Реальных входов, AI-запросов с личными данными и проверки физического iPhone не выполнялось. Предрелизный веб опубликован на `https://api.valerochkagym.tech/`; root/admin/health/SW/offline smoke проверены. Backend rollout пока не выполнен (см. `deploy/SERVER.md`).

## Ограничения текущей реализации

Массивы агрегатов при merge считаются атомарными. Непересекающиеся поля автоматически объединяются; два изменения внутри одного массива требуют выбора версии. Это сохраняет обе версии, но не повторяет все эвристики Android.

Передача гостевого дневника намеренно не выполняется до переноса правил Android: вход сохраняет независимые owner partitions. Синхронизация читает полный snapshot, а не постраничные changes. Это корректный поддерживаемый endpoint, но масштабирование больших аккаунтов ещё не проверено.

AI и тренерские endpoints написаны по актуальным контроллерам, однако запуск с реальным backend и настроенным провайдером обязателен. Наличие UI не считается подтверждением сквозной работоспособности этих сценариев.

## Выпуск после устранения незавершённых пунктов

1. Прогнать backend suite с Docker/PostgreSQL, проверить Android совместимость. Развернуть backend с `WEB_ORIGIN=https://api.valerochkagym.tech` и web OAuth audience.
2. Настроить публичный OAuth client ID на сборке, DNS/TLS и Nginx. Проверить реальную доставку письма и AI availability.
3. Выполнить `deploy/package-release.sh`, распаковать в `/srv/yarumo-web/releases/<version>` без перезаписи существующей версии.
4. Сохранить прежнюю цель `current`, атомарно переключить symlink на новую версию, проверить `nginx -t` перед reload конфигурации.
5. Проверить `/`, вложенный маршрут, `manifest.webmanifest`, `sw.js`, cookie flags, login, refresh, CSRF rejection и Android↔Web sync.
6. Проверить установленное приложение на iPhone: клавиатура, safe areas, перезапуск, offline, таймер, обновление при активной тренировке.
7. Для отката переключить `current` на прежний релиз; не откатывать разрушительно IndexedDB. Backend сохраняет старые Android endpoints.

Справочные документы, использованные для реализации: [Dexie React](https://dexie.org/docs/Tutorial/React), [Vite PWA update prompt](https://vite-pwa-org.netlify.app/guide/prompt-for-update.html), [Google GIS JavaScript API](https://developers.google.com/identity/gsi/web/reference/js-reference).
