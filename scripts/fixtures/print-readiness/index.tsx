import React, {useState} from 'react';
import {createRoot} from 'react-dom/client';
import {DeliveredInvestigationReport} from '@/components/humanReview/DeliveredInvestigationReport';
import {reportPreviewAssembly} from '../report-preview-data';
import '@/styles.css';
const id=(n:number)=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const assembly=reportPreviewAssembly(true);
assembly.ring=[[24,-34],[24.001,-34],[24.001,-34.001],[24,-34.001],[24,-34]];
const asset={id:id(101),user_id:id(1),parcel_id:assembly.parcel.id,asset_category:'sg_diagram',asset_type:'image',source_label:'SYNTHETIC authorized preview',storage_bucket:'erf-files',storage_path:'synthetic/no-remote-file',original_file_name:'SYNTHETIC-SG.png',mime_type:'image/png',size_bytes:100,checksum_sha256:null,status:'ready',local_migration_fingerprint:null,created_at:'2026-09-20',updated_at:'2026-09-20',metadata:{}};
assembly.sg={...assembly.sg,emptyMessage:null,evidence:[{asset,readLabel:'Synthetic preview; provider integration pending',isParentContext:false,isUserConfirmed:true,summary:'Synthetic visual readiness test only.',findings:[]}]};
const brief={bottomLine:'SYNTHETIC: visual readiness regression only, not a property assessment.',known:['Synthetic parcel and controlled preview.'],potential:['Nothing established for a real property.'],risks:['No official evidence was acquired.'],unknowns:['Provider integration pending.'],nextSteps:['Obtain authorized professional evidence.']};
const w = window as typeof window & {
  fixture: {
    account: string | null;
    order: string;
    version: string;
    previewCalls: Array<{
      orderId: string;
      assetId: string;
      versionId?: string;
      preview?: boolean;
    }>;
    versionData: unknown;
  };
  change: (kind: string) => void;
};
w.fixture={account:id(1),order:id(2),version:id(3),previewCalls:[],versionData:{id:id(3),order_id:id(2),customer_id:id(1),parcel_id:assembly.parcel.id,evidence_revision:1,brief_revision:1,version_sequence:1,evidence_snapshot:{schemaVersion:1,parcelId:assembly.parcel.id,revision:1,userData:{},assets:[],siteProject:null},report_assembly:assembly,evidence_manifest:[],generated_brief:brief,edited_brief:brief,provider_model:'human-only',generated_at:'2026-09-20',approved_by:id(4),approved_reviewer_label:'Synthetic reviewer',approved_at:'2026-09-20',delivered_at:'2026-09-20',currentEvidenceRevision:1}};
function Fixture(){const[,render]=useState(0);w.change=(kind:string)=>{if(kind==='signout')w.fixture.account=null;if(kind==='account')w.fixture.account=id(5);if(kind==='order')w.fixture.order=id(6);if(kind==='version')w.fixture.version=id(7);render(n=>n+1);};return <main style={{maxWidth:1160,margin:'auto'}}><p>SYNTHETIC component regression. No backend, real map or provider calls.</p><DeliveredInvestigationReport orderId={w.fixture.order} versionId={w.fixture.version}/></main>}
createRoot(document.getElementById('root')!).render(<Fixture/>);
