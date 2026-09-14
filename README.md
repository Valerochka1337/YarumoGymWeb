# Yarumo coach Web

React / TypeScript / Vite PWA для существующего Yarumo backend. Интерфейс и локальный дневник работают; это **предрелизная реализация, а не завершение всех пяти этапов плана**. Полная таблица готовности и оставшихся работ: [docs/IMPLEMENTATION.md](docs/IMPLEMENTATION.md).

## Запуск

Требуется Node.js 22.12+ (проверено на 24.13.1).

```sh
npm ci
npm run dev
```

Приложение открывается по адресу `http://127.0.0.1:5173`. Гостевой дневник работает без backend. Для общих аккаунтов запустите существующий backend с браузерным адаптером и настройте `API_PROXY_TARGET`. Защищённые cookie для сквозной проверки авторизации требуют HTTPS. Не отключайте Secure ради локального теста: используйте локальный HTTPS reverse proxy и соответствующий `WEB_ORIGIN`.

`.env.example` описывает публичный Google OAuth client ID и dev proxy. В production все API-запросы идут на `/v1` своего origin. Секреты и AI-ключи не включаются в веб-сборку.

## Проверки

```sh
npm test
npm run build
npx playwright install chromium firefox webkit
npm run test:e2e
```

Если браузеры установлены в отдельный каталог, передайте `PLAYWRIGHT_BROWSERS_PATH`. Playwright сам запускает production preview на порту 4173. Сначала выполните сборку. WebKit проверяет мобильный viewport iPhone; это не заменяет физический iPhone и установку PWA.

## Backend

Проверенный адаптер и unit-тесты сохранены в `backend-adapter/`; такие же файлы добавлены в соседний `ValerochkaGymBackend`. Он использует существующие аккаунты и `AuthService`, не меняет Android endpoints или схему БД. Настройка `WEB_ORIGIN` соответствует Spring property `web.origin` и по умолчанию равна `https://app.valerochkagym.tech`.

`backend-work/` — игнорируемая локальная копия для проверки, не исходник поставки. Она может быть удалена после завершения работ. Для другой рабочей копии перенесите `WebAuthController.kt` в `src/main/kotlin/tech/valerochkagym/controller/auth/`, тест — в аналогичный test-каталог.

## Данные

IndexedDB хранит агрегаты Android, исходную версию, dirty-флаг, точное тело исходящего пакета и обе версии конфликта. Все записи и очереди имеют владельца. Гостевой перенос в аккаунт ещё не реализован; вход не присваивает гостевые записи другому владельцу. При выходе локальный дневник аккаунта сохраняется для повторного входа. Очистка доступна только явно; резервную копию можно скачать из профиля.

Обычная синхронизация откладывается во время тренировки. Web Locks защищают sync, refresh и единственного редактора тренировки. Ответы API не попадают в Service Worker cache. Активная тренировка и абсолютный срок отдыха переживают перезапуск. Обновление PWA предлагается пользователю и проверяет отсутствие активных тренировок.

## Размещение

`deploy/nginx.conf` включается в существующий HTTPS server block. `deploy/package-release.sh` собирает версионный архив. Для согласованного первого выпуска используется `https://api.valerochkagym.tech/` и полный конфиг `deploy/api-domain.conf`; backend требует `WEB_ORIGIN=https://api.valerochkagym.tech`. Проверки публикации фиксируются в `deploy/SERVER.md`. Перед выпуском завершите пункты [docs/IMPLEMENTATION.md](docs/IMPLEMENTATION.md), backend integration tests и приёмку на iPhone.

Брендовые SVG/PNG взяты из `ValerochkaGym/docs/branding/yarumo-coach` на зафиксированной ревизии Android. API сверялся с Kotlin-контроллерами, а не сохранённой OpenAPI.
