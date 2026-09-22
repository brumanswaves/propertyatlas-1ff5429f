export const investigationClient={rpc:()=>({abortSignal:async signal=>({data:structuredClone(window.fixture.versionData),error:null})})};
export const requireInvestigationResult=r=>r.data;
export const requestInvestigationReview=()=>{throw Error('Provider calls forbidden')};
export async function readInvestigationAsset(scope,signal){
 window.fixture.previewCalls.push(scope);const mode=new URLSearchParams(location.search).get('case');
 await new Promise((resolve,reject)=>{const t=setTimeout(resolve,mode==='ready'?0:500);signal.addEventListener('abort',()=>{clearTimeout(t);reject(Error('Aborted'));},{once:true});if(mode==='timeout')clearTimeout(t);});
 if(mode==='image-failure')return new Blob(['invalid image'],{type:'image/png'});
 if(mode==='preview-failure')throw Error('Synthetic denied/unavailable preview');
 return new Blob(['<svg xmlns="http://www.w3.org/2000/svg" width="240" height="160"><rect width="240" height="160" fill="orange"/><text x="10" y="80">SYNTHETIC SG READY</text></svg>'],{type:'image/svg+xml'});
}
