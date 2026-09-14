# Сервер выпуска

Проверено 2026-09-14 по SSH, без изменения production.

```sh
ssh -l valerochka 62.84.122.55
```

- Hostname: `valerochka-vm`; SSH и `sudo -n` доступны.
- Nginx: `/etc/nginx/sites-available/api.valerochkagym.tech`, подключён через `sites-enabled`; `nginx -t` проходит.
- Backend: контейнер `valerochka-gym-backend-1`, upstream `127.0.0.1:18080` → container `8080`; readiness возвращает `UP`.
- PostgreSQL: контейнер `valerochka-gym-postgres-1`, образ `postgres:17-alpine`.
- Предлагаемый каталог веб-релизов: `/srv/yarumo-web/releases`; активный релиз: `/srv/yarumo-web/current`. Эти каталоги ещё не создавались.
- `app.valerochkagym.tech`: A и AAAA возвращают `NXDOMAIN`. DNS зоны обслуживает Timeweb (`ns1.timeweb.ru`). Нужна запись A `app` → `62.84.122.55`.
- Каталог сертификата `/etc/letsencrypt/live/app.valerochkagym.tech` отсутствует. После DNS нужно выпустить сертификат для веб-домена.

`nginx.conf` использует проверенный порт 18080. Он предназначен для включения в отдельный HTTPS server block веб-домена и не заменяет существующий API server block.

Публикация, изменение контейнеров, Nginx и сертификатов пока не выполнялись. Перед выпуском остаются незавершённые пункты `docs/IMPLEMENTATION.md`, сквозная проверка адаптера авторизации, OAuth и приёмка на iPhone.

## Согласованный первый выпуск

Пользователь выбрал `https://api.valerochkagym.tech/` вместо отдельного app-домена. Используется существующий TLS-сертификат. Полная конфигурация — `api-domain.conf`, API/admin/health маршруты сохраняются, Service Worker исключает серверные маршруты. Backend настраивается через `WEB_ORIGIN=https://api.valerochkagym.tech`.

## Фактическая публикация 2026-09-14

- URL: `https://api.valerochkagym.tech/`.
- Выпущенная сборка: `0.1.0-5cc44aa`, исходный commit веба `5cc44aa`.
- Архив SHA-256: `0ff561f46381cac6498e10a0c9fd1812308eae3b57038cc060b9049b2ad0c59c`.
- Активная папка: `/srv/yarumo-web/releases/0.1.0-5cc44aa`, symlink `/srv/yarumo-web/current`.
- Резервная копия Nginx до публикации: `/etc/nginx/sites-available/api.valerochkagym.tech.pre-web-5cc44aa`.
- Проверено: Nginx syntax, HTTP 200 и TLS на главной, admin и health, Service Worker и offline reload в Chromium. SW не перехватывает admin/health.
- Backend-контейнер не изменён. Веб-вход и облачные функции ожидают отдельного разрешения на production-развёртывание нового адаптера: автоматическая проверка отклонила запуск такого развёртывания до merge-review без явного подтверждения.
- PR: https://github.com/Valerochka1337/YarumoGymWeb/pull/1 и https://github.com/Valerochka1337/YarumoGymBackend/pull/17.

Для повторной проверки опубликованного веба: `npm run test:production` (установленный Chromium Playwright; при необходимости `PLAYWRIGHT_BROWSERS_PATH`). Проверка использует отдельный чистый браузерный контекст и не входит в личный аккаунт.

Откат веб-конфигурации: восстановить указанную резервную копию поверх `/etc/nginx/sites-available/api.valerochkagym.tech`, выполнить `sudo nginx -t`, затем `sudo systemctl reload nginx`. Это возвращает прежнее проксирование корня в backend; данные браузеров и БД не удаляются.
