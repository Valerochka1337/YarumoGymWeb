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
