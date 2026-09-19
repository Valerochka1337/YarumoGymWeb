# Yarumo browser trial

Мобильный web-интерфейс публичной пробной тренировки. Структура программы неизменяема;
до явного входа результаты остаются только в локальном черновике браузера.

```bash
npm ci
npm run typecheck
npm test
npm run build
npm run test:e2e
```

Production размещается на `https://app.valerochkagym.tech`. Репозиторий проверяет каждый
PR и `main`; неизменяемый архив `dist/` собирает и устанавливает защищённый production job
репозитория backend вместе с конфигурацией `infra/nginx.conf`. Первичная установка требует
A-запись `app.valerochkagym.tech` на production VPS; installer атомарно переключает release,
получает отдельный сертификат Certbot при его отсутствии и проверяет локальный HTTPS listener.
