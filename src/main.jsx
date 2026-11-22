import React,{useEffect,useMemo,useState} from 'react';
import{createRoot}from'react-dom/client';
import {
  BrowserRouter,
  Link,
  NavLink,
  useNavigate,
  useParams,
  useSearchParams,
  useLocation,
  Routes as RouterRoutes,
  Route as RouterRoute
} from 'react-router-dom';
import{Bike,CalendarDays,Users,Fuel,Gauge,ArrowRight,MapPin,ShieldCheck,Clock3,Menu,X,MessageCircle,CheckCircle2,Search,SlidersHorizontal,ChevronRight,Star,Headphones,KeyRound,Route,PhoneCall,Check,AlertCircle}from'lucide-react';
import{business,bikes,money,waLink}from'./data';
import{cloudReady,getPublicModels,getAvailabilityDetail,submitPublicBooking}from'./cloud';
import CloudAdmin,{ResetPassword} from './CloudAdmin';
import{rentalQuote}from'./data';
import './style.css';

const today=()=>{const d=new Date();return`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`};
const formatDate=v=>{if(!v)return '';const d=new Date(v);if(Number.isNaN(d.getTime()))return '';const day=String(d.getDate()).padStart(2,'0'),month=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][d.getMonth()],year=String(d.getFullYear()).slice(2),hours=d.getHours(),min=String(d.getMinutes()).padStart(2,'0');return `${day}-${month}-${year} ${hours%12||12}:${min}${hours>=12?' PM':' AM'}`;};
const dtLocal=(date,hour='09:00')=>date?`${date}T${hour}`:'';

const pad=n=>String(n).padStart(2,'0');
const dateLocal=(d)=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
const defaultStart=()=>dateLocal(new Date(Date.now()+2*3600000));
const defaultEnd=()=>dateLocal(new Date(Date.now()+26*3600000));
function useModels(){const [models,setModels]=useState(bikes);useEffect(()=>{if(!cloudReady)return;let ignore=false;getPublicModels().then(data=>{if(!ignore&&Array.isArray(data)){setModels(data.map(x=>{const original=bikes.find(b=>b.id===x.id);const type=x.category;const sameDay=Number(x.same_day_price),day=Number(x.day_price);return {...(original||{}),id:x.id,name:x.name,type,variant:original?.variant||(type==='Scooter'?'Automatic Scooter':'Self-drive Motorcycle'),transmission:original?.transmission||(type==='Scooter'?'Automatic':'Manual'),seats:2,fuel:'Petrol',description:original?.description||`${x.name} self-drive rental in Nellore and Ongole.`,sameDay,day,self:{h12:sameDay,h24:day},image:x.photo_url||'',extraHour:70,extraKm:4,km12:140,km24:140}}))}}).catch(err=>console.warn('AGS model sync:',err.message));return()=>{ignore=true}},[]);return models}
function useLiveAvailability(modelId,location,start,end){
 const [state,setState]=useState({loading:true,count:null,total:null,bookedUntil:null,error:null});
 useEffect(()=>{
  if(!cloudReady||!modelId||!start||!end){setState({loading:false,count:null,total:null,bookedUntil:null,error:!cloudReady?'Live availability not configured':null});return}
  let active=true,request=0;
  const refresh=()=>{
   const id=++request;
   setState(s=>({...s,loading:true,error:null}));
   getAvailabilityDetail(modelId,location,start,end).then(result=>{
    if(active&&id===request)setState({loading:false,count:result.available,total:result.total,bookedUntil:result.booked_until,error:null});
   }).catch(err=>{
    if(active&&id===request)setState({loading:false,count:null,total:null,bookedUntil:null,error:err.message});
   });
  };
  const onVisible=()=>{if(document.visibilityState==='visible')refresh()};
  refresh();window.addEventListener('focus',refresh);document.addEventListener('visibilitychange',onVisible);
  return()=>{active=false;window.removeEventListener('focus',refresh);document.removeEventListener('visibilitychange',onVisible)};
 },[modelId,location,start,end]);return state;
}
function BikePhoto({car,...props}){return car.image?<img src={car.image} alt={`${car.name} vehicle image`} loading="lazy" {...props} onError={e=>{e.currentTarget.style.display='none';e.currentTarget.parentElement?.classList.add('ags-no-photo')}}/>:<div className="ags-no-photo"><Bike size={58}/><span>Photo coming soon</span></div>}
function GuidedDateTimes({start,end,onStart,onEnd}){
 const [step,setStep]=useState(null),[draft,setDraft]=useState('');
 const dateLabel=value=>{if(!value)return 'Choose date';const [y,m,d]=value.slice(0,10).split('-');const months=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];return `${d}-${months[Number(m)-1]}-${y.slice(-2)}`};
 const timeLabel=value=>{if(!value)return 'Choose time';const [h,m]=value.slice(11,16).split(':').map(Number);return `${h%12||12}:${String(m).padStart(2,'0')}${h>=12?' PM':' AM'}`};
 function open(which){setStep(which);setDraft(which==='pickup'?start:end)}
 function done(){if(!draft||!Number.isFinite(new Date(draft).getTime()))return;if(step==='pickup'){if(new Date(draft)<=new Date())return;onStart(draft);const next=new Date(end)<=new Date(draft)?dateLocal(new Date(new Date(draft).getTime()+86400000)):end;if(next!==end)onEnd(next);setDraft(next);setStep('return')}else{if(new Date(draft)<=new Date(start))return;onEnd(draft);setStep(null)}}
 return <><div className="ags-date-row">
  <label>Pickup Date<button type="button" className="ags-date-control" onClick={()=>open('pickup')}>{dateLabel(start)}</button></label>
  <label>Pickup Time<button type="button" className="ags-date-control" onClick={()=>open('pickup')}>{timeLabel(start)}</button></label>
  <label>Return Date<button type="button" className="ags-date-control" onClick={()=>open('return')}>{dateLabel(end)}</button></label>
  <label>Return Time<button type="button" className="ags-date-control" onClick={()=>open('return')}>{timeLabel(end)}</button></label>
 </div>{step&&<div className="ags-date-dialog-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)setStep(null)}}><div className="ags-date-dialog" role="dialog" aria-modal="true"><div className="ags-date-dialog-head"><h3>{step==='pickup'?'Pickup date & time':'Return date & time'}</h3><button type="button" aria-label="Close" onClick={()=>setStep(null)}>×</button></div><label>Date<input type="date" min={step==='pickup'?today():start.slice(0,10)} value={draft.slice(0,10)} onChange={e=>setDraft(`${e.target.value}T${draft.slice(11,16)||'09:00'}`)}/></label><label>Time<input type="time" value={draft.slice(11,16)} onChange={e=>setDraft(`${draft.slice(0,10)}T${e.target.value}`)}/></label><button type="button" className="btn btn-primary" onClick={done} disabled={!draft||(step==='pickup'?new Date(draft)<=new Date():new Date(draft)<=new Date(start))}>OK <ArrowRight size={16}/></button>{step==='pickup'&&<small>Return selection opens automatically after OK.</small>}</div></div>}</>;
}
function Chat({label='Chat on WhatsApp',message='Hello, I would like to enquire about scooter and motorcycle rentals.',outline=false}){return <a className={outline?'btn btn-outline':'btn btn-green'} href={waLink(message)} target="_blank" rel="noreferrer"><MessageCircle size={18}/>{label}</a>}
function Header(){const[open,setOpen]=useState(false);const links=[['/','Home'],['/bikes','Find Bikes'],['/about','About Us'],['/terms','Rental Terms'],['/ourlocation','Our Location'],['/contact','Contact'],['/admin','Owner Login']];return <header className="site-header"><div className="nav-wrap container"><Link className="brand" to="/" onClick={()=>setOpen(false)}><span className="brand-icon"><img className="ags-brandmark" src="/images/ags-digital-logo.svg" alt="AGS"/></span><span><strong>{business.name}</strong><small>{business.subtitle}</small></span></Link><nav className={open?'nav-links open':'nav-links'}>{links.map(([to,label])=><NavLink onClick={()=>setOpen(false)} key={to} end={to==='/'} to={to} className={({isActive})=>isActive?'active':''}>{label}</NavLink>)}<span className="mobile-only"><Chat label="WhatsApp Enquiry"/></span></nav><div className="nav-action"><Chat/><button aria-label="Toggle navigation" className="menu-button" onClick={()=>setOpen(!open)}>{open?<X/>:<Menu/>}</button></div></div></header>}
function Footer(){return <footer className="footer"><div className="container footer-grid"><div><div className="footer-brand"><Bike/>{business.name}</div><p>Self-drive scooters and motorcycles across Nellore and Ongole. Operated by Fectsy Private Limited.</p><Chat label="Enquire on WhatsApp"/></div><div><h4>Explore</h4><Link to="/bikes">Find Bikes</Link><Link to="/about">About Us</Link><Link to="/ourlocation">Our Location</Link></div><div><h4>Helpful links</h4><Link to="/terms">Rental Terms</Link><Link to="/contact">Contact</Link><Link to="/booking">Book a Bike</Link></div><div><h4>Location</h4><p><MapPin size={17}/>{business.location}</p><p>Same-day and 24-hour self-ride packages</p></div></div><div className="footer-bottom container"><span>© {new Date().getFullYear()} {business.name}. All rights reserved.</span><span>Ride with confidence.</span></div></footer>}
function Title({eyebrow,title,subtitle,light=false}){return <div className={light?'section-title light':'section-title'}>{eyebrow&&<div className="eyebrow">{eyebrow}</div>}<h2>{title}</h2>{subtitle&&<p>{subtitle}</p>}</div>}
function PriceGrid({car}) {
  return <div className="pricing-grid">
    <div className="price-col"><div className="price-heading">12 Hours</div><div className="price-line"><span>{car.km12} km included</span><b>{money(car.self.h12)}</b></div></div>
    <div className="price-col"><div className="price-heading">24 Hours</div><div className="price-line"><span>{car.km24} km included</span><b>{money(car.self.h24)}</b></div></div>
  </div>;
}
function CarCard({car,location='Nellore',start,end}){
 const live=useLiveAvailability(car.id,location,start,end);
 const otherLocation=location==='Nellore'?'Ongole':'Nellore';
 const other=useLiveAvailability(car.id,otherLocation,start,end);
 const booked=cloudReady&&!live.loading&&!live.error&&live.total>0&&live.count===0;
 const ready=cloudReady&&!live.loading&&!live.error&&live.count>0;
 const otherAvailable=!other.loading&&!other.error&&other.count>0;
 const query=new URLSearchParams({car:car.id,location,start,end}).toString();
 const otherQuery=new URLSearchParams({car:car.id,location:otherLocation,start,end}).toString();
 return <div className="car-card glass"><div className="car-media">
  <BikePhoto car={car}/>
  <span className={booked?'status booked':ready?'status available':'status pending'}>{booked?`BOOKED · ${location.toUpperCase()}`:ready?`AVAILABLE`:'AVAILABILITY PENDING'}</span></div><div className="car-info"><p className="vehicle-type">{car.type} · {car.variant}</p><h3>{car.name}</h3><div className="specs"><span><Users size={15}/>2 riders</span><span><Fuel size={15}/>Petrol</span><span><ShieldCheck size={15}/>No Deposit</span></div><PriceGrid car={car}/><p className="extra-line"><Clock3 size={15}/> Extra hour {money(car.extraHour)} · Extra km {money(car.extraKm)}</p>
  
  {/* <p className={`ags-stock-line ${booked?'is-unavailable':''}`}>
    {live.loading?'Checking availability…':live.error?'Live availability not verified':live.total===0?
    `No bike registered in ${location}`:booked?`BOOKED in ${location}${live.bookedUntil?' until '+formatDate(live.bookedUntil):''}
    `:`AVAILABLE in ${location}`}{booked&&otherAvailable&&<span className="ags-alternate-branch">AVAILABLE in {otherLocation} for these dates</span>}</p> */}
    
{booked ? (
  otherAvailable && (
    <p className="ags-stock-line">
      <span style={{ color: "#078955" }}>
        AVAILABLE IN {otherLocation.toUpperCase()}
      </span>
    </p>
  )
) : (
  <p className="ags-stock-line">
    {live.loading
      ? "Checking availability…"
      : live.error
      ? "Live availability not verified"
      : live.total === 0
      ? `No bike registered in ${location}`
      : `AVAILABLE IN ${location.toUpperCase()}`}
  </p>
)}

    
    
    <div className="car-actions">{booked?(otherAvailable?<Link className="btn btn-primary" to={`/booking?${otherQuery}`}>Book in {otherLocation} <ArrowRight size={16}/></Link>:<span className="btn btn-primary ags-disabled">BOOKED — Change Dates</span>):ready?<Link className="btn btn-primary" to={`/booking?${query}`}>Book Now <ArrowRight size={16}/></Link>:<span className="btn btn-primary ags-disabled">Availability pending</span>}<Link className="btn btn-outline" to={`/bikes/${car.id}`}>View Details</Link></div></div></div>
}
function SearchBox({compact=false}){
 const navigate=useNavigate(),[location,setLocation]=useState('Nellore'),[start,setStart]=useState(defaultStart()),[end,setEnd]=useState(defaultEnd());
 return <form className={compact?'search-box glass compact':'search-box glass'} onSubmit={e=>{e.preventDefault();navigate(`/bikes?${new URLSearchParams({location,start,end})}`)}}><label>Pickup Location<select value={location} onChange={e=>setLocation(e.target.value)}><option>Nellore</option><option>Ongole</option></select></label><GuidedDateTimes start={start} end={end} onStart={setStart} onEnd={setEnd}/><button className="btn btn-primary" type="submit"><Search size={18}/> Find Bikes</button></form>
}
function Home(){const models=useModels();const start=defaultStart(),end=defaultEnd();return <>
 <section className="hero"><div className="hero-shine"/><div className="container hero-inner"><div className="hero-copy"><div className="hero-kicker"><span/> SCOOTERS • MOTORCYCLES • SELF-RIDE</div><h1>Your city. <em>Your ride.</em></h1><p>Explore easy-to-ride scooters, commuter bikes and powerful weekend motorcycles. Choose Nellore or Ongole, compare rental prices, and send your enquiry through WhatsApp.</p><div className="hero-buttons"><Link className="btn btn-white" to="/bikes">Explore Bikes <ArrowRight size={18}/></Link><Chat label="Ask on WhatsApp" outline/></div></div><div className="hero-search"><SearchBox/></div></div></section>
 <section className="benefits"><div className="container benefits-grid"><span><Bike/> Scooters & Motorcycles</span><span><CalendarDays/> Same-Day & 24 Hour Plans</span><span><KeyRound/> Automatic & Geared</span><span><ShieldCheck/> Transparent Pricing</span></div></section>
 <section className="section container"><div className="section-row"><Title eyebrow="THE FLEET" title="Pick your kind of ride" subtitle="Everyday scooters, quick commuters and bikes built for a longer ride."/><Link className="text-link" to="/bikes">See All Bikes <ArrowRight size={18}/></Link></div><div className="cards-grid">{models.slice(0,3).map(car=><CarCard key={car.id} car={car} location="Nellore" start={start} end={end}/>)}</div></section>
 <section className="section section-soft"><div className="container"><Title eyebrow="RENTING MADE SIMPLE" title="A simpler way to ride" subtitle="Choose the bike that matches your plans and get rental details without the back-and-forth."/><div className="features-grid"><Feature icon={<Search/>} title="Compare variants" copy="Explore scooters, geared bikes, transmission types and included kilometres."/><Feature icon={<CalendarDays/>} title="Choose dates" copy="Check your preferred 12-hour or 24-hour slot before sending a request."/><Feature icon={<MessageCircle/>} title="WhatsApp support" copy="Ask about pickup, licence, helmets and deposits directly."/></div></div></section>
 <section className="section container"><div className="promo glass"><div><span className="eyebrow">YOUR NEXT RIDE STARTS HERE</span><h2>Ready to take the scenic route?</h2><p>Choose a scooter for the city or a motorcycle for the highway.</p><Link className="btn btn-primary" to="/bikes">Find Your Ride <ArrowRight size={17}/></Link></div><div className="promo-icon"><Bike size={124} strokeWidth={1}/></div></div></section>
 </>}
function Feature({icon,title,copy}){return <div className="feature glass"><div className="feature-icon">{icon}</div><h3>{title}</h3><p>{copy}</p></div>}
function PageHero({tag,title,copy}){return <div className="page-hero"><div className="container"><p className="eyebrow">{tag}</p><h1>{title}</h1>{copy&&<p>{copy}</p>}</div></div>}
function Cars(){
 const [params,setParams]=useSearchParams();const models=useModels();
 const location=params.get('location')||'Nellore',start=params.get('start')||defaultStart(),end=params.get('end')||defaultEnd(),type=params.get('type')||'all';
 const filtered=models.filter(b=>type==='all'||b.type===type);
 const setFilter=(key,value)=>setParams(prev=>{const next=new URLSearchParams(prev);next.set(key,value);return next});
 return <><PageHero tag="EXPLORE THE FLEET" title="Find your ideal bike" copy="Choose a branch and rental dates. Check real bike availability before booking."/><section className="section container">
 <div className="listing-filter glass ags-unified-filters"><label>Pickup Location<select value={location} onChange={e=>setFilter('location',e.target.value)}><option>Nellore</option><option>Ongole</option></select></label><label>Category<select value={type} onChange={e=>setFilter('type',e.target.value)}><option value="all">All Bikes & Scooties</option>{[...new Set(models.map(b=>b.type))].map(t=><option key={t} value={t}>{t}</option>)}</select></label><GuidedDateTimes start={start} end={end} onStart={v=>setFilter('start',v)} onEnd={v=>setFilter('end',v)}/></div>
 <div className="results-title"><h2>{filtered.length} bikes to explore</h2><p>{location} · Availability for selected dates. Confirmed bookings block a bike only for overlapping periods.</p></div><div className="cards-grid">{filtered.map(car=><CarCard key={car.id} car={car} location={location} start={start} end={end}/>)}</div>{!filtered.length&&<div className="notice">No bikes match those filters.</div>}</section></>;
}
function CarDetails(){
 const {id}=useParams(),models=useModels(),car=models.find(x=>x.id===id);
 if(!car)return <NotFound/>;
 return <><PageHero tag="RIDE DETAILS" title={car.name} copy={`${car.type} · ${car.variant} · ${car.transmission}`}/>
  <section className="section container detail-layout">
    <div><div className="detail-image glass"><BikePhoto car={car}/></div>
     <div className="glass detail-panel"><h2>Your ride, your route</h2><p>{car.description}</p><div className="detail-specs"><span><Users/>{car.seats} riders</span><span><Fuel/>{car.fuel}</span><span><Gauge/>{car.transmission}</span><span><Bike/>{car.variant}</span></div></div>
    </div>
    <aside className="glass detail-aside"><p className="eyebrow">CLEAR PACKAGE PRICING</p><h2>Choose your rental</h2><PriceGrid car={car}/>
      <div className="charges"><p><Clock3 size={18}/> Extra hour <strong>{money(car.extraHour)}/hour</strong></p><p><Route size={18}/> Extra kilometre <strong>{money(car.extraKm)}/km</strong></p></div>
      <p className="mini-note">Same-day package is up to 14 hours. Daily allowance is 140 km. Valid licence required; helmets provided and no security deposit as stated in AGS policy.</p>
      <Link className="btn btn-primary btn-full" to={`/booking?car=${car.id}`}>Check Dates & Book <ArrowRight size={17}/></Link>
      <Chat label="Ask about this bike" outline message={`Hello, I would like to know more about the ${car.name} rental.`}/>
    </aside>
  </section></>;
}
function Booking(){const [params]=useSearchParams(),navigate=useNavigate(),models=useModels();const [carId,setCarId]=useState(params.get('car')||bikes[0].id),[location,setLocation]=useState(params.get('location')||'Nellore'),[start,setStart]=useState(params.get('start')||defaultStart()),[end,setEnd]=useState(params.get('end')||defaultEnd()),[name,setName]=useState(''),[phone,setPhone]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[submitted,setSubmitted]=useState(false);const car=models.find(x=>x.id===carId)||models[0];const quote=rentalQuote(car,start,end),live=useLiveAvailability(carId,location,start,end);const otherLocation=location==='Nellore'?'Ongole':'Nellore',other=useLiveAvailability(carId,otherLocation,start,end);const booked=cloudReady&&!live.loading&&!live.error&&live.total>0&&live.count===0;const available=cloudReady&&!live.loading&&!live.error&&live.count>0;const otherAvailable=!other.loading&&!other.error&&other.count>0;
 function message(price=quote?.base){return `*AGS SELF DRIVE WHEELS*\n*BIKE RENTAL ENQUIRY*\n\n *Bike:* ${car.name}\n *Location:* ${location}\n *Pickup:* ${formatDate(start)}\n*Return:* ${formatDate(end)}\n *Rental:* ${quote?.category}\n *Estimated price:* ${money(price)}\n *Name:* ${name.trim()}\n *Phone:* ${phone.trim()}\n\nPlease confirm my availability. Booking is subject to AGS confirmation.`}
 async function submit(e){e.preventDefault();setError('');if(!available){setError('Availability has not been verified for these dates. Choose another slot or contact AGS.');return}if(!quote||new Date(start)<=new Date()){setError('Choose valid future rental dates.');return}if(name.trim().length<2||!/^[+0-9 ()-]{8,17}$/.test(phone.trim())){setError('Enter a valid name and phone number.');return}setBusy(true);let popup=null;try{popup=window.open('about:blank','_blank')}catch{}try{const result=await submitPublicBooking({model_id:carId,location,starts_at:new Date(start).toISOString(),ends_at:new Date(end).toISOString(),customer_name:name.trim(),customer_phone:phone.trim()});setSubmitted(true);const url=waLink(message(result.quoted_price));if(popup)popup.location.href=url;else window.location.assign(url)}catch(err){if(popup&&!popup.closed)popup.close();setError(err.message||'Could not save enquiry. Please try again.')}finally{setBusy(false)}}
 return <><PageHero tag="BOOK YOUR RIDE" title="Reserve your bike" copy="Choose a bike, branch and dates. AGS confirms every booking through WhatsApp."/><section className="section container booking-layout"><div className="glass booking-form"><h2>Rental details</h2>{submitted?<div className="success-box" role="status"><h3>Thank you for your enquiry!</h3><p>Your request for {car.name} has been saved. Please press <strong>Send</strong> in WhatsApp to contact our team. We will get back to you after checking and confirming your booking.</p><p><strong>Please wait for confirmation.</strong></p><button type="button" className="btn btn-outline" onClick={()=>setSubmitted(false)}>New enquiry</button></div>:<form onSubmit={submit}><div className="form-row"><label>Choose bike<select value={carId} onChange={e=>setCarId(e.target.value)}>{models.map(b=><option value={b.id} key={b.id}>{b.name}</option>)}</select></label><label>Pickup location<select value={location} onChange={e=>setLocation(e.target.value)}><option>Nellore</option><option>Ongole</option></select></label></div><GuidedDateTimes start={start} end={end} onStart={setStart} onEnd={setEnd}/><div className="form-row"><label>Your name<input type="text" required minLength={2} maxLength={100} placeholder="Enter your name" value={name} onChange={e=>setName(e.target.value)}/></label><label>WhatsApp / contact number<input type="tel" required minLength={8} maxLength={17} placeholder="Your contact number" value={phone} onChange={e=>setPhone(e.target.value)}/></label></div><div className={booked?'ags-booked-callout':available?'availability-message':'availability-message pending'}>{booked?<><strong>BOOKED — UNAVAILABLE</strong><span>{live.bookedUntil?`Booked in ${location} until ${formatDate(live.bookedUntil)}`:`Booked in ${location} for this rental period.`}</span>{otherAvailable&&<button type="button" className="ags-other-branch-button" onClick={()=>setLocation(otherLocation)}>Available in {otherLocation} — switch branch</button>}</>:live.loading?'Checking real availability…':live.error?'Could not verify availability':live.total===0?'No bikes registered at this branch yet':'Your selected bike is available for this period. Owner confirmation required.'}</div>{error&&<div className="notice danger"><AlertCircle size={18}/>{error}</div>}{!booked&&<button className="btn btn-primary btn-full ags-wa" type="submit" disabled={!available||busy}>{busy?'Preparing WhatsApp…':<><MessageCircle size={19}/> BOOK VIA WHATSAPP <ArrowRight size={17}/></>}</button>}<p className="mini-note">Press Send in WhatsApp. A pending request is saved to the owner dashboard before the message opens. Only owner confirmation reserves a physical bike.</p></form>}</div><aside className="booking-summary glass"><BikePhoto car={car}/><div className="summary-content"><p className="eyebrow">YOUR SELECTION</p><h3>{car.name}</h3><p>{location} · {car.variant}</p><div className="summary-item"><span>Duration</span><strong>{quote?.category||'Choose valid dates'}</strong></div><div className="summary-item"><span>Included distance</span><strong>{quote?`${quote.includedKm} km`:'—'}</strong></div><div className="summary-item"><span>Extra kilometre</span><strong>₹4/km</strong></div><div className="summary-item"><span>Pickup</span><strong>{formatDate(start)}</strong></div><div className="summary-item"><span>Return</span><strong>{formatDate(end)}</strong></div><div className="summary-total"><span>Estimated price</span><strong>{money(quote?.base)}</strong></div><p className="mini-note">Seven days for six days' payment. No deposit; helmet provided. Confirm all rental terms with AGS.</p></div></aside></section></>}
function About(){return <><PageHero tag="ABOUT US" title="Two wheels. More freedom." copy="Straightforward scooter and motorcycle rentals for everyday rides and travel."/><section className="section container about-grid"><div><Title eyebrow="OUR APPROACH" title="Simple choices, clear terms"/><p>At {business.name}, browse by bike type, variant, and rental duration. Review the included kilometres and extra charges before sending a booking request.</p><p>Choose a comfortable automatic scooter or a geared motorcycle suited to your route. Our team can help with ride details, document requirements, helmets and pickup information.</p><Link className="btn btn-primary" to="/bikes">Explore Our Fleet <ArrowRight size={16}/></Link></div><div className="about-photo glass"/></section><section className="section section-soft"><div className="container features-grid"><Feature icon={<ShieldCheck/>} title="Clear rental terms" copy="Know the distance allowance and additional usage costs in advance."/><Feature icon={<Bike/>} title="Different ride styles" copy="Pick from scooters, commuter bikes, street bikes and cruisers."/><Feature icon={<Headphones/>} title="Direct support" copy="Send a quick enquiry through WhatsApp."/></div></section></>}
function Terms(){const terms=[
 ['Booking and availability','Availability depends on the selected bike, rental date and start time. A request is subject to rental-provider confirmation.'],
 ['Rental duration','Choose a same-day or 24-hour rental package. The rental clock begins at the selected start time.'],
 ['Included distance','The daily kilometre limit is 140 km as stated in the AGS rate chart.'],
 ['Additional usage','Additional kilometres cost ₹4/km. Late return after the 24-hour period costs ₹70/hour (up to three hours); confirm any further extension with AGS.'],
 ['Rider requirements','Riders must have a valid driving licence suitable for the selected two-wheeler and comply with applicable age and road safety requirements.'],
 ['Helmets and safety','Ask the rental business about included helmets, passenger helmets, damage policies, and any riding gear. Wear a helmet while riding.'],
 ['Fuel, tolls and parking','Confirm fuel arrangements, tolls, parking and other expenses before taking the bike.'],
 ['Changes and cancellations','Contact the rental team to confirm cancellation, refund, and schedule-change policies.'],
 ['Bike handover','Valid licence, identification and vehicle inspection are required. AGS advertises no security deposit and provides helmets.']
 ];return <><PageHero tag="RENTAL INFORMATION" title="Rental terms" copy="Everything to clarify before you ride."/><section className="section container terms-layout"><div className="glass terms-card">{terms.map(([title,body],i)=><div key={title} className="term"><span className="term-number">{String(i+1).padStart(2,'0')}</span><div><h3>{title}</h3><p>{body}</p></div></div>)}</div><div className="terms-side glass"><h3>Questions before you ride?</h3><p>Ask the team about licences, helmets, deposits, mileage and pickup.</p><Chat label="Ask on WhatsApp"/></div></section></>}
function Reviews() {
  const locations=[
    {name:'Nellore',map:'https://www.google.com/maps?q=Nellore%2C%20Andhra%20Pradesh%2C%20India&output=embed',link:'https://www.google.com/maps/search/?api=1&query=Nellore%2C%20Andhra%20Pradesh%2C%20India'},
    {name:'Ongole',map:'https://www.google.com/maps?q=Ongole%2C%20Andhra%20Pradesh%2C%20India&output=embed',link:'https://www.google.com/maps/search/?api=1&query=Ongole%2C%20Andhra%20Pradesh%2C%20India'}
  ];
  return <>
    <PageHero tag="FIND US" title="Our Rental Locations" copy="Choose Nellore or Ongole; confirm the exact AGS pickup point via WhatsApp."/>
    <section className="section container">
      <div className="ags-location-grid">
        {locations.map(place=><div className="reviews-panel glass" key={place.name}>
          <h2>{place.name}</h2>
          <p>{place.name}, Andhra Pradesh</p>
          <iframe title={`${place.name} location map`} src={place.map} width="100%" height="350" style={{border:0}} loading="lazy" referrerPolicy="no-referrer-when-downgrade"/>
          <a className="btn btn-primary" href={place.link} target="_blank" rel="noopener noreferrer">Open in Google Maps <ArrowRight size={17}/></a>
        </div>)}
      </div>
    </section>
  </>;
}
function Contact(){return <><PageHero tag="GET IN TOUCH" title="We're here to help" copy="Have a question about a bike, package or upcoming journey? Reach us directly."/><section className="section container contact-grid"><div className="contact-card glass"><div className="feature-icon"><MessageCircle/></div><h2>WhatsApp support</h2><p>Get assistance with bike selection, packages, availability and rental conditions.</p><Chat label="Message on WhatsApp"/></div><div className="contact-card glass"><div className="feature-icon"><MapPin/></div><h2>Our business location</h2><p>{business.location}</p><Link className="btn btn-outline" to="/ourlocation">View Business Location <ArrowRight size={17}/></Link><div className="location-surface"><MapPin size={42}/><span>Business location</span></div></div></section></>}
function NotFound(){return <div className="section container missing"><h1>Page not found</h1><p>We couldn't find that page.</p><Link to="/" className="btn btn-primary">Back to Home</Link></div>}
function Pages() {
  return (
    <RouterRoutes>
      <RouterRoute path="/" element={<Home />} />
      <RouterRoute path="/bikes" element={<Cars />} />
      <RouterRoute path="/bikes/:id" element={<CarDetails />} />
      <RouterRoute path="/booking" element={<Booking />} />
      <RouterRoute path="/about" element={<About />} />
      <RouterRoute path="/terms" element={<Terms />} />
      <RouterRoute path="/ourlocation" element={<Reviews />} />
      <RouterRoute path="/contact" element={<Contact />} />
      <RouterRoute path="/admin" element={<div className="ags-owner-route"><CloudAdmin/></div>} />
      <RouterRoute path="/reset-password" element={<ResetPassword />} />
      <RouterRoute path="*" element={<NotFound />} />
    </RouterRoutes>
  );
}

function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
}


function Root() {
  const location=useLocation();
  const ownerRoute=location.pathname==="/admin"||location.pathname==="/reset-password";
  return (
    <>
      <ScrollToTop />
      {!ownerRoute&&<Header />}
      <main>
        <Pages />
      </main>
      {!ownerRoute&&<Footer />}
      {!ownerRoute&&<a
        className="floating-wa"
        href={waLink('Hello, I would like to enquire about renting a bike.')}
        target="_blank"
        rel="noreferrer"
        aria-label="Chat on WhatsApp"
      >
        <MessageCircle size={24} />
      </a>}
    </>
  );
}
createRoot(document.getElementById('root')).render(<BrowserRouter future={{v7_startTransition:true,v7_relativeSplatPath:true}}><Root/></BrowserRouter>);
