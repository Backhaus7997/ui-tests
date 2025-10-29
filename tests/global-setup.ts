import { chromium, request } from '@playwright/test';
import 'dotenv/config';

function pickTokenLike(obj: any): string | null {
  if (!obj || typeof obj !== 'object') return null;
  const candidates = ['token','accessToken','jwt','id_token','data.token','data.accessToken'];
  for (const key of candidates) {
    const val = key.includes('.') ? key.split('.').reduce((a,k)=>a?.[k], obj) : (obj as any)[key];
    if (val && typeof val === 'string' && val.length > 10) return val;
  }
  const s = JSON.stringify(obj);
  const m = s.match(/eyJ[A-Za-z0-9_\-]+?\.[A-Za-z0-9_\-]+?\.[A-Za-z0-9_\-]+/);
  return m ? m[0] : null;
}

export default async () => {
  const BASE_URL = (process.env.BASE_URL || '').trim();
  const AUTH_API_URL = (process.env.AUTH_API_URL || '').trim();
  const EMAIL = (process.env.ADMIN_EMAIL || '').trim();
  const PASS  = (process.env.ADMIN_PASSWORD || '').trim();
  const CT    = (process.env.AUTH_CONTENT_TYPE || 'application/json').trim();
  const TOKEN_KEY = (process.env.AUTH_TOKEN_JSON_KEY || '').trim();
  const LS_KEY    = (process.env.AUTH_LS_KEY || 'accessToken').trim();

  if (!BASE_URL || !AUTH_API_URL || !EMAIL || !PASS) {
    throw new Error('Faltan BASE_URL / AUTH_API_URL / ADMIN_EMAIL / ADMIN_PASSWORD en .env');
  }

  // 1) POST de login a la API
  const req = await request.newContext();
  const opts: any = { headers: { 'Content-Type': CT } };
  if (CT.includes('json'))  opts.data = { email: EMAIL, password: PASS };
  else                      opts.data = `email=${encodeURIComponent(EMAIL)}&password=${encodeURIComponent(PASS)}`;

  const resp = await req.post(AUTH_API_URL, opts);
  if (!resp.ok()) {
    const body = await resp.text();
    throw new Error(`Login API falló: ${resp.status()} ${resp.statusText()} — body: ${body.slice(0,300)}`);
  }

  // 2) Sacar el token del JSON
  let data: any = null;
  try { data = await resp.json(); } catch {}
  let token: string | null = TOKEN_KEY ? data?.[TOKEN_KEY] ?? null : null;
  if (!token) token = pickTokenLike(data);
  if (!token) throw new Error('No encontré token en la respuesta. Ajustá AUTH_TOKEN_JSON_KEY o mandá captura de Network → Response.');

  // 3) Guardar token en localStorage antes de abrir la app y persistir session
  const browser = await chromium.launch();
  const context = await browser.newContext();
  await context.addInitScript(([k, v]) => localStorage.setItem(k, v), [LS_KEY, token]);
  const page = await context.newPage();
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' }).catch(()=>{});
  await context.storageState({ path: 'storageState.json' });
  await browser.close();
};
