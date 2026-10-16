import { useEffect, useMemo, useRef, useState } from 'react';
import type { ObservationDataset } from '../services/observationProvider';
import { computeDashboard } from '../services/dashboardAnalysis';
import type { AnalysisSelection, DashboardAnalysis } from '../services/dashboardAnalysis';
const empty = computeDashboard({records:[],mode:'demo',years:[],notice:''},{region:'Indonesia',year:2025,month:null,layer:'Harmonized',highOnly:false});
export function useDashboardAnalysis(data: ObservationDataset|null, selection: AnalysisSelection) {
  const key = JSON.stringify(selection);
  const stable = useMemo(()=>selection,[key]);
  const worker = useRef<Worker|null>(null), sentData = useRef<ObservationDataset|null>(null), request = useRef(0);
  const [state,setState]=useState<{data:ObservationDataset|null;key:string;result:DashboardAnalysis;error:boolean}>({data:null,key:'',result:empty,error:false});
  useEffect(()=>{const w=new Worker(new URL('../services/analysis.worker.ts',import.meta.url),{type:'module'});worker.current=w;sentData.current=null;return()=>{w.terminate();worker.current=null;};},[]);
  useEffect(()=>{
    if(!data||!worker.current)return;
    const w=worker.current,id=++request.current;
    w.onmessage=e=>{if(e.data.id===id)setState({data,key,result:e.data.result??empty,error:!!e.data.error});};
    w.onerror=()=>setState({data,key,result:empty,error:true});
    // Boundaries and other UI-only fields never need cloning into the worker.
    const payload = sentData.current===data?undefined:{records:data.records,mode:data.mode,years:data.years,notice:data.notice,coverage:data.coverage,updatedAt:data.updatedAt};
    w.postMessage({id,data:payload,selection:stable});sentData.current=data;
  },[data,key,stable]);
  return {analysis:state.result,pending:!!data&&(state.data!==data||state.key!==key),analysisError:state.error};
}
