// Avisos por Telegram aunque la app esté cerrada.
//   - Cada día (pg_cron, ver supabase/avisos-cron.sql): revisa todos los perfiles que
//     tengan Telegram vinculado y manda lo que vence hoy, mañana o ya venció.
//   - Desde la app, con la sesión de la persona: { accion: 'vincular', codigo } y { accion: 'probar' }.
// Secretos: TELEGRAM_BOT_TOKEN, CRON_SECRET. Se despliega con --no-verify-jwt: la función
// valida a mano el secreto del cron o la sesión de quien llama.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { avisosDeHoy, mensajeDe, hoyEnBogota } from './vencimientos.js';

const BOT = Deno.env.get('TELEGRAM_BOT_TOKEN') ?? '';
const CRON = Deno.env.get('CRON_SECRET') ?? '';
const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'content-type': 'application/json' } });

async function telegram(metodo: string, cuerpo: Record<string, unknown>) {
  const r = await fetch(`https://api.telegram.org/bot${BOT}/${metodo}`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(cuerpo),
  });
  return r.json();
}

Deno.serve(async (req) => {
  if (!BOT) return json({ error: 'Falta TELEGRAM_BOT_TOKEN' }, 500);

  if (CRON && req.headers.get('x-cron-secret') === CRON) {
    const hoy = hoyEnBogota();
    const { data, error } = await admin.from('perfiles').select('data');
    if (error) return json({ error: error.message }, 500);
    let enviados = 0;
    for (const { data: p } of data ?? []) {
      const chat = p?.avisos?.telegram;
      if (!chat) continue;
      const texto = mensajeDe(avisosDeHoy(p.recurrentes, p.movs, hoy));
      if (!texto) continue;
      const r = await telegram('sendMessage', { chat_id: chat, text: texto });
      if (r.ok) enviados += 1;
    }
    return json({ ok: true, enviados });
  }

  const token = (req.headers.get('authorization') ?? '').replace(/^Bearer /i, '');
  const { data: u } = await admin.auth.getUser(token);
  if (!u?.user) return json({ error: 'Sin sesión' }, 401);
  const { accion, codigo } = await req.json().catch(() => ({}));

  if (accion === 'vincular') {
    // la persona abrió t.me/<bot>?start=<codigo>: el mensaje "/start <codigo>" trae su chat
    if (!/^[A-Za-z0-9]{8,32}$/.test(String(codigo ?? ''))) return json({ error: 'Código inválido' }, 400);
    const r = await telegram('getUpdates', { allowed_updates: ['message'], limit: 100 });
    const msg = (r.result ?? []).map((x: any) => x.message).filter(Boolean).reverse()
      .find((m: any) => m.text === `/start ${codigo}`);
    if (!msg) return json({ error: 'Todavía no llegó. Abre Telegram, toca Iniciar y vuelve a intentar.' }, 404);
    await telegram('sendMessage', { chat_id: msg.chat.id, text: '✅ Listo: aquí te aviso cuando venza un pago.' });
    return json({ chatId: String(msg.chat.id) });
  }

  if (accion === 'probar') {
    const { data } = await admin.from('perfiles').select('data').eq('user_id', u.user.id).maybeSingle();
    const chat = data?.data?.avisos?.telegram;
    if (!chat) return json({ error: 'Aún no hay Telegram vinculado (o no se ha sincronizado).' }, 400);
    const texto = mensajeDe(avisosDeHoy(data.data.recurrentes, data.data.movs, hoyEnBogota()));
    const r = await telegram('sendMessage', { chat_id: chat, text: texto || '👍 Prueba: no tienes pagos por vencer hoy ni mañana.' });
    return json({ ok: !!r.ok });
  }
  return json({ error: 'Acción desconocida' }, 400);
});
