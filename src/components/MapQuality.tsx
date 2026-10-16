import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { createPerformanceMonitor } from '../utils/performanceMonitor';
export type Quality = 'high'|'low';
export const qualityDisplay = (quality:Quality) => ({animated:quality!=='low',detail:quality!=='low',maxDpr:quality==='low'?1:2,exaggeration:quality==='low'?1:1.5});
const Context=createContext({quality:'high' as Quality,preference:null as Quality|null,setQuality:(_q:Quality)=>{}});
export function QualityProvider({children}:{children:ReactNode}) {
  const [preference,setPreference]=useState<Quality|null>(()=>{try{const v=localStorage.getItem('siagaapi:quality');return v==='high'||v==='low'?v:null;}catch{return null;}});
  const value=useMemo(()=>({quality:preference??'high',preference,setQuality:(q:Quality)=>{setPreference(q);try{localStorage.setItem('siagaapi:quality',q);}catch{/* Private browsing remains usable. */}}}),[preference]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export const useMapQuality=()=>useContext(Context);
export function QualityControl(){const {quality,setQuality}=useMapQuality();return <div className="quality-control"><button aria-pressed={quality==='low'} onClick={()=>setQuality(quality==='low'?'high':'low')}>Mode Ringan</button><small>Tampilan disederhanakan agar lebih lancar. Data dan angka tidak berubah.</small></div>;}
let dismissedInMemory=false;
export function MapPerformance({active,animating}:{active:boolean;animating:boolean}) {
  const {quality,setQuality}=useMapQuality();
  const [suggest,setSuggest]=useState(false);
  const dismissed=useRef(dismissedInMemory);
  useEffect(()=>{try{dismissed.current ||= sessionStorage.getItem('siagaapi:lag-dismissed')==='1';}catch{}},[]);
  useEffect(()=>{
    if(!active||quality==='low')return;
    const monitor=createPerformanceMonitor();let frame=0,until=0,moving=false;
    const tick=(time:number)=>{
      frame=0;
      const running=!document.hidden && (animating||moving||time<until);
      const result=monitor.sample(time,running);
      if(result.notify&&!dismissed.current)setSuggest(true);
      if(running)frame=requestAnimationFrame(tick);
    };
    const start=()=>{until=performance.now()+3500;if(!frame&&!document.hidden)frame=requestAnimationFrame(tick);};
    const motion=(event:Event)=>{moving=!!(event as CustomEvent).detail;start();};
    const visibility=()=>{cancelAnimationFrame(frame);frame=0;monitor.sample(performance.now(),false);if(!document.hidden&&(animating||moving))start();};
    const map=document.querySelector('.atlas-map');
    map?.addEventListener('pointerdown',start);map?.addEventListener('wheel',start);map?.addEventListener('siaga-map-motion',motion);
    document.addEventListener('visibilitychange',visibility);
    if(animating)start();
    return()=>{cancelAnimationFrame(frame);map?.removeEventListener('pointerdown',start);map?.removeEventListener('wheel',start);map?.removeEventListener('siaga-map-motion',motion);document.removeEventListener('visibilitychange',visibility);};
  },[active,animating,quality]);
  if(!active||quality==='low'||!suggest||dismissed.current)return null;
  return <aside className="lag-banner" role="status"><p>Perangkat Anda tampak lambat. Aktifkan Mode Ringan?</p><button onClick={()=>{setQuality('low');setSuggest(false);}}>Aktifkan</button><button onClick={()=>{dismissed.current=dismissedInMemory=true;setSuggest(false);try{sessionStorage.setItem('siagaapi:lag-dismissed','1');}catch{}}}>Tidak, terima kasih</button></aside>;
}
