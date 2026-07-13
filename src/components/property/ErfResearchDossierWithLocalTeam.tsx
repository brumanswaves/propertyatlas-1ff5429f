import type { NormalizedOfficialParcel } from "@/lib/parcels/officialParcelId";
import {
  ErfResearchDossier as BaseErfResearchDossier,
  type DossierView,
} from "@/components/property/ErfResearchDossier";
import { LocalPropertyTeam } from "./dossier/LocalPropertyTeam";

interface Props {
  parcel: NormalizedOfficialParcel;
  view?: DossierView;
  onSelectView?: (view: DossierView) => void;
}

export type { DossierView };

export function ErfResearchDossier(props: Props) {
  if (props.view !== "stoep-report") {
    return <BaseErfResearchDossier {...props} />;
  }

  return (
    <div className="space-y-5">
      <BaseErfResearchDossier {...props} />
      <LocalPropertyTeam parcel={props.parcel} />
    </div>
  );
}
