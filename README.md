# Yarumo coach Web

React / TypeScript / Vite PWA для существующего Yarumo backend. Основной интерфейс сохраняет
локальный дневник, календарь и анализ; маршрут `/r/{token}` проводит неизменяемую пробную
тренировку по публичной ссылке. До явного входа её результаты остаются только в локальном
черновике браузера.

## Запуск

Требуется Node.js 22.12+ (проверено на 24.13.1).

```sh
npm ci
npm run dev
```

Приложение открывается по адресу `http://127.0.0.1:5173`. Для общих аккаунтов запустите
существующий backend и настройте `API_PROXY_TARGET`. Защищённые cookie требуют HTTPS;
не отключайте `Secure` ради локального теста.

В production все API-запросы идут на `/v1` своего origin. Секреты и AI-ключи в сборку не
включаются. Публичный Google Web client ID загружается с
`/v1/web/auth/google/config`, поэтому production-сборка использует ту же OAuth-конфигурацию,
что и backend; `VITE_GOOGLE_CLIENT_ID` остаётся только необязательным локальным fallback.

## Проверки

```sh
npm run typecheck
npm test
npm run build
npx playwright install chromium firefox webkit
npm run test:e2e
```

Playwright проверяет основной дневник и пробную тренировку, включая мобильный viewport и
исключение `/r` и `/v1` из Service Worker cache. Это не заменяет приёмку на физическом iPhone.

## Размещение

Production размещается на существующем `https://api.valerochkagym.tech/`. Backend CI собирает
проверенный `dist/`, атомарно переключает `/srv/yarumo-web/current` и обновляет маршруты Nginx.
Отдельный домен, DNS-запись и сертификат для Web не требуются. Backend использует
`WEB_ORIGIN=https://api.valerochkagym.tech`.

Подробности первоначального Web-релиза и отката сохранены в [deploy/SERVER.md](deploy/SERVER.md).
