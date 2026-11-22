// Local preview state ONLY. Not secure, not shared across users/devices.
import {bikes} from './data.js';
const KEY='ags-fleet-demo-v1';
const initial=()=>({models:bikes,units:[],requests:[]});
export function load(){try{const parsed=JSON.parse(localStorage.getItem(KEY));if(parsed?.models&&parsed?.units&&parsed?.requests)return parsed}catch{}return initial()}
export function save(data){localStorage.setItem(KEY,JSON.stringify(data));window.dispatchEvent(new Event('ags-store-update'))}
export function overlaps(a,b,c,d){return new Date(a)<new Date(d)&&new Date(c)<new Date(b)}
export function bookedIds(data,start,end){return new Set(data.requests.filter(r=>r.status==='confirmed'&&overlaps(r.start,r.end,start,end)).map(r=>r.unitId))}
export function availableUnits(data,modelId,location,start,end){const used=bookedIds(data,start,end);return data.units.filter(u=>u.modelId===modelId&&u.location===location&&u.active&&!used.has(u.id))}
export function requestBooking(data,req){return {...data,requests:[...data.requests,{...req,id:crypto.randomUUID(),status:'pending',createdAt:new Date().toISOString()}]}}
export function confirmRequest(data,id){const req=data.requests.find(r=>r.id===id);if(!req)throw Error('Request not found');const eligible=availableUnits(data,req.modelId,req.location,req.start,req.end);if(!eligible.length)throw Error('No physical unit available on these dates.');const unit=eligible[0];return {...data,requests:data.requests.map(r=>r.id===id?{...r,status:'confirmed',unitId:unit.id}:r)}}
