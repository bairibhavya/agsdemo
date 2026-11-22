// Supabase Edge Function — deploy using `supabase functions deploy booking-request --no-verify-jwt`
// Public endpoint: validate, rate-limit and create a pending enquiry. Never reserve a unit here.
const base = Deno.env.get('SUPABASE_URL')?.replace(/\/$/, '');
const secret = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const salt = Deno.env.get('AGS_RATE_LIMIT_SALT');
// Public non-cookie endpoint: permit browser requests from localhost (any port), Vercel and future domains.
const corsHeaders = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'POST, OPTIONS',
  'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type',
  'access-control-max-age': '86400',
};
const json = (body: unknown, status = 200, origin = '') => new Response(JSON.stringify(body), {
  status,
  headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store',
    ...corsHeaders }
});
async function db(path: string, method = 'GET', body?: unknown): Promise<unknown> {
  if (!base || !secret) throw Error('Server database is not configured');
  const response = await fetch(`${base}/rest/v1/${path}`, { method,
    headers: { apikey: secret, Authorization: `Bearer ${secret}`, 'Content-Type': 'application/json', Prefer: 'return=representation' },
    body: body === undefined ? undefined : JSON.stringify(body) });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw Error(`Database request failed: ${response.status} ${JSON.stringify(data)}`);
  return data;
}
function validPhone(v: unknown): v is string { return typeof v === 'string' && /^[+0-9 ()-]{8,17}$/.test(v.trim()) }
async function hashIp(ip: string) {
  const bytes = new TextEncoder().encode(`${salt}:${ip}`);
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(hash)].map(b => b.toString(16).padStart(2, '0')).join('');
}
Deno.serve(async request => {
  const origin = (request.headers.get('origin') || '').replace(/\/$/, '');
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405, origin);
  if (!base || !secret || !salt || salt.length < 24) return json({ error: 'Booking service not configured' }, 503, origin);
  if (Number(request.headers.get('content-length') || 0) > 4096) return json({ error: 'Request too large' }, 413, origin);
  try {
    const raw = await request.text();
    if (raw.length > 4096) return json({ error: 'Request too large' }, 413, origin);
    const input = JSON.parse(raw);
    const { model_id, location, starts_at, ends_at, customer_name, customer_phone } = input;
    if (typeof model_id !== 'string' || !/^ags-[a-z0-9-]{2,64}$/.test(model_id) || !['Nellore', 'Ongole'].includes(location))
      return json({ error: 'Invalid vehicle or pickup location' }, 400, origin);
    if (typeof customer_name !== 'string' || customer_name.trim().length < 2 || customer_name.trim().length > 100 || !validPhone(customer_phone))
      return json({ error: 'Enter a valid name and contact number' }, 400, origin);
    if (typeof starts_at !== 'string' || typeof ends_at !== 'string' || !/Z$/.test(starts_at) || !/Z$/.test(ends_at))
      return json({ error: 'Invalid rental date format' }, 400, origin);
    const start = new Date(starts_at).getTime(), end = new Date(ends_at).getTime();
    const hours = (end - start) / 3600000;
    if (!Number.isFinite(hours) || start <= Date.now() || !Number.isFinite(end) || hours <= 0 || hours > 24 * 60)
      return json({ error: 'Choose future rental dates, up to 60 days' }, 400, origin);
    const models = await db(`vehicle_models?select=id,active,same_day_price,day_price&id=eq.${encodeURIComponent(model_id)}&active=eq.true&limit=1`) as Array<{id:string;active:boolean;same_day_price:number;day_price:number}>;
    const model = Array.isArray(models) ? models[0] : null;
    if (!model) return json({ error: 'Vehicle model not available' }, 404, origin);
    const count = await db('rpc/available_unit_count', 'POST', {p_model_id:model_id,p_location:location,p_start:starts_at,p_end:ends_at});
    // PostgREST scalar RPC returns a bare number; some setups may wrap it.
    const fleetCount = typeof count === 'number' ? count : Number(count ?? 0);
    // An enquiry may be saved even when stock is unavailable; only owner confirmation reserves a unit.
    // Keep availability unverified in this case and ask the owner to offer alternatives.
    const days = Math.ceil(hours / 24), sameDay = hours <= 14;
    const quotedPrice = sameDay ? model.same_day_price : (Math.floor(days / 7) * 6 + days % 7) * model.day_price;
    const ip = request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const ipHash = await hashIp(ip);
    // Atomic rate limit counter, stored as a salted hash. A second anti-bot layer is recommended before public launch.
    const allowedRequest = await db('rpc/ags_booking_rate_check', 'POST', {p_ip_hash:ipHash}) as boolean;
    if (!allowedRequest) return json({ error: 'Too many requests. Try again later.' }, 429, origin);
    const saved = await db('bookings', 'POST', [{model_id, location, starts_at, ends_at,
      customer_name: customer_name.trim(), customer_phone: customer_phone.trim(), quoted_price: quotedPrice, status: 'pending'}]) as Array<{id:string;quoted_price:number}>;
    if (!Array.isArray(saved) || !saved[0]?.id) throw Error('Booking insert returned no row');
    return json({ id:saved[0].id, status:'pending', quoted_price:quotedPrice, message: fleetCount > 0 ? 'AGS must confirm the booking.' : 'Vehicle availability not verified; AGS will suggest alternatives.' }, 201, origin);
  } catch (e) {
    console.error('AGS booking request failed:', e);
    return json({ error: 'Unable to submit request. Please contact AGS on WhatsApp.' }, 500, origin);
  }
});
