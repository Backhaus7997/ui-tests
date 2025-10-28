# UI Tests (Playwright)

Proyecto base para tests E2E con Playwright.

## Requisitos
- Node 20 o superior
- `npm`
- (Opcional) Docker si tu app/DB se levanta en contenedores

## Empezar
1. Instalá dependencias:
   ```bash
   npm install
   npx playwright install
   ```

2. Copiá `.env.example` a `.env` y completá valores:
   ```bash
   cp .env.example .env
   # Editar BASE_URL, ADMIN_EMAIL y ADMIN_PASSWORD si aplica
   ```

3. Corré el smoke test:
   ```bash
   npm run test:e2e
   npm run report   # abre el reporte HTML
   ```

> Si tu app necesita levantarse, podés descomentar `webServer` en `playwright.config.ts`
> y ajustar `command` para que Playwright la arranque antes de testear.

## Estructura
```text
tests/
  global-setup.ts        # guarda sesión (login) en storageState.json
  smoke.spec.ts          # prueba mínima
  pages/                 # Page Objects
    login.page.ts
    dashboard.page.ts
playwright.config.ts     # config, reportes, baseURL, etc.
```

## Selectores estables
Usá `data-testid` en tu app para elementos críticos. Ejemplo:
```html
<button data-testid="login-submit">Ingresar</button>
```
En tests:
```ts
await page.getByTestId('login-submit').click();
```

## Reset de base de datos (opcional)
Si necesitás limpiar datos entre corridas, agregá tu SQL a `scripts/reset-db.sql`
y un script en `package.json`, por ejemplo:
```json
{ "scripts": { "db:reset:test": "psql \"$DATABASE_URL\" -f scripts/reset-db.sql" } }
```
Luego: `"test:e2e": "npm run db:reset:test && playwright test"`

## CI (GitHub Actions)
Workflow listo en `.github/workflows/e2e.yml`.