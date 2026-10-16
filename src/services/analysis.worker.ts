import { createAnalysisCache } from './dashboardAnalysis';
import type { AnalysisSelection } from './dashboardAnalysis';
import type { ObservationDataset } from './observationProvider';
let calculate: ReturnType<typeof createAnalysisCache> | undefined;
self.onmessage = (event: MessageEvent<{id:number; data?:ObservationDataset; selection:AnalysisSelection}>) => {
  const {id,data,selection}=event.data;
  try {if(data)calculate=createAnalysisCache(data);if(calculate)self.postMessage({id,result:calculate(selection)});}
  catch {self.postMessage({id,error:true});}
};
