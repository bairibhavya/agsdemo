// Supabase REST client without added dependencies. Configured with public anon key ONLY.
const rawUrl=(import.meta.env.VITE_SUPABASE_URL||'').trim();
const base=/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(rawUrl)?rawUrl.replace(/\/$/,''):'';
const anon=(import.meta.env.VITE_SUPABASE_ANON_KEY||'').trim();
export const cloudReady=Boolean(base&&anon);
const SESSION_KEY='ags-supabase-session';
const readSession=()=>{try{return JSON.parse(sessionStorage.getItem(SESSION_KEY)||'null')}catch{return null}};
export const currentSession=()=>readSession();
function headers(token,prefer){return {'apikey':anon,'Authorization':`Bearer ${token||anon}`,'Content-Type':'application/json',...(prefer?{'Prefer':prefer}:{})}};
async function call(path,{method='GET',body,token,prefer}={}){
 if(!cloudReady)throw Error('Supabase config invalid. VITE_SUPABASE_URL must be https://PROJECT.supabase.co and VITE_SUPABASE_ANON_KEY must be a public key.');
 const res=await fetch(`${base}${path}`,{method,headers:headers(token,prefer),body:body===undefined?undefined:JSON.stringify(body)});
 const data=await res.json().catch(()=>null);
 if(!res.ok)throw Error(data?.message||data?.error_description||data?.hint||`Supabase returned HTTP ${res.status}`);
 return data;
}
export async function login(email,password){const data=await call('/auth/v1/token?grant_type=password',{method:'POST',body:{email,password}});sessionStorage.setItem(SESSION_KEY,JSON.stringify({access_token:data.access_token,refresh_token:data.refresh_token,expires_at:Date.now()+data.expires_in*1000,email}));return data}
export async function logout(){const s=readSession();if(s)await call('/auth/v1/logout',{method:'POST',token:s.access_token}).catch(()=>{});sessionStorage.removeItem(SESSION_KEY)}
export async function token(){let s=readSession();if(!s)throw Error('Please sign in as an AGS administrator.');if(s.expires_at>Date.now()+60000)return s.access_token;const fresh=await call('/auth/v1/token?grant_type=refresh_token',{method:'POST',body:{refresh_token:s.refresh_token}});s={...s,access_token:fresh.access_token,refresh_token:fresh.refresh_token,expires_at:Date.now()+fresh.expires_in*1000};sessionStorage.setItem(SESSION_KEY,JSON.stringify(s));return s.access_token}
async function getAllBookings(t){
 const all=[];const pageSize=500;
 for(let offset=0;;offset+=pageSize){
  const rows=await call(`/rest/v1/bookings?select=*&order=created_at.desc&limit=${pageSize}&offset=${offset}`,{token:t});
  all.push(...rows);
  if(rows.length<pageSize)break;
 }
 return all;
}
export async function getFleet(){const t=await token();const [models,units,bookings]=await Promise.all([call('/rest/v1/vehicle_models?select=*&order=name',{token:t}),call('/rest/v1/vehicle_units?select=*&order=created_at.desc',{token:t}),getAllBookings(t)]);return {models,units,bookings}}
export async function addUnit({model_id,location,unit_code}){return call('/rest/v1/vehicle_units',{method:'POST',token:await token(),prefer:'return=representation',body:{model_id,location,unit_code}})}
export async function setUnitActive(id,active){return call(`/rest/v1/vehicle_units?id=eq.${encodeURIComponent(id)}`,{method:'PATCH',token:await token(),body:{active}})}
export async function updateModel(id,updates){return call(`/rest/v1/vehicle_models?id=eq.${encodeURIComponent(id)}`,{method:'PATCH',token:await token(),body:updates})}
export async function updateBooking(id,status){return call('/rest/v1/rpc/ags_update_booking',{method:'POST',token:await token(),body:{p_booking_id:id,p_status:status}})}
export async function deleteBooking(id){const rows=await call(`/rest/v1/bookings?id=eq.${encodeURIComponent(id)}&select=id`,{method:'DELETE',token:await token(),prefer:'return=representation'});if(!Array.isArray(rows)||rows.length!==1)throw Error('Booking was not deleted. Check administrator permissions.');return rows[0];}
export async function extendBooking(id,newEnd){return call('/rest/v1/rpc/ags_extend_booking',{method:'POST',token:await token(),body:{p_booking_id:id,p_new_end:new Date(newEnd).toISOString()}})}
export async function createVehicleModel({name,category,same_day_price,day_price}){const id=`ags-custom-${crypto.randomUUID()}`;return call('/rest/v1/vehicle_models',{method:'POST',token:await token(),prefer:'return=representation',body:{id,name:name.trim(),category,same_day_price:Number(same_day_price),day_price:Number(day_price),active:true}})}
export async function getPublicModels(){return call('/rest/v1/vehicle_models?select=id,name,category,same_day_price,day_price,photo_url&active=eq.true&order=name')}
export async function getAvailability(model_id,location,start,end){return call('/rest/v1/rpc/available_unit_count',{method:'POST',body:{p_model_id:model_id,p_location:location,p_start:new Date(start).toISOString(),p_end:new Date(end).toISOString()}})}

// Public requests use a protected Supabase Edge Function, never direct inserts into bookings.
export async function submitPublicBooking(payload){
 if(!cloudReady) throw Error('Supabase is not configured.');
 const res=await fetch(`${base}/functions/v1/booking-request`,{method:'POST',headers:{'apikey':anon,'Content-Type':'application/json'},body:JSON.stringify(payload)});
 const data=await res.json().catch(()=>null);
 if(!res.ok) throw Error(data?.error||`Booking request could not be submitted (${res.status}).`);
 return data;
}

export async function resetPasswordEmail(email){return call('/auth/v1/recover?redirect_to='+encodeURIComponent(window.location.origin+'/reset-password'),{method:'POST',body:{email}})}
export async function changePassword(password,overrideToken){const t=overrideToken||await token();return call('/auth/v1/user',{method:'PUT',token:t,body:{password}})}
export async function totalUnits(model_id,location){return call('/rest/v1/rpc/ags_total_units',{method:'POST',body:{p_model_id:model_id,p_location:location}})}
export async function uploadModelPhoto(modelId,file){
 if(!file.type.startsWith('image/')||file.size>3*1024*1024)throw Error('Choose a JPG/PNG/WebP under 3 MB.');
 const name=`${modelId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${file.type==='image/png'?'png':file.type==='image/webp'?'webp':'jpg'}`;
 const t=await token();const res=await fetch(`${base}/storage/v1/object/vehicle-photos/${name}`,{method:'POST',headers:{apikey:anon,Authorization:`Bearer ${t}`,'Content-Type':file.type,'x-upsert':'false'},body:file});
 const body=await res.json().catch(()=>({}));if(!res.ok)throw Error(body.message||body.error||`Upload failed: ${res.status}`);
 const url=`${base}/storage/v1/object/public/vehicle-photos/${name}`;await updateModel(modelId,{photo_url:url});return url;
}

export async function getAvailabilityDetail(model_id,location,start,end){
 const values={p_model_id:model_id,p_location:location,p_start:new Date(start).toISOString(),p_end:new Date(end).toISOString()};
 const [raw,total]=await Promise.all([call('/rest/v1/rpc/ags_availability_detail',{method:'POST',body:values}),totalUnits(model_id,location)]);
 const data=Array.isArray(raw)?raw[0]:raw;
 return {available:Number(data?.available??0),total:Number(total),booked_until:data?.booked_until||null};
}
export async function addUnitsBulk({model_id,location,quantity}){
 const qty=Number(quantity);if(!Number.isInteger(qty)||qty<1||qty>50)throw Error('Enter a quantity from 1 to 50.');
 const prefix=location==='Nellore'?'NL':'ON';
 const body=Array.from({length:qty},()=>({model_id,location,unit_code:`${prefix}-${model_id.toUpperCase()}-${crypto.randomUUID().slice(0,8).toUpperCase()}`}));
 return call('/rest/v1/vehicle_units',{method:'POST',token:await token(),prefer:'return=representation',body});
}
