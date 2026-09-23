import React, { useEffect } from "react";
import { InvestigationSaveNotice } from "@/components/workbench/InvestigationSaveNotice";
import { buildSelectedOfficialParcelId } from "@/lib/parcels/officialParcelId";
import { useAuth } from "./auth.jsx";
export const selection = (i) => ({
  source: "CSG",
  layer: "csg-parcels",
  properties: { ID: `synthetic-${i}`, PARCEL_NO: i },
  lngLat: [25, -34],
  geometry: {
    type: "Polygon",
    coordinates: [
      [
        [25, -34],
        [25.001, -34],
        [25.001, -34.001],
        [25, -34],
      ],
    ],
  },
});
export function MapCanvas(props) {
  window.fixture.mapProps = props;
  useEffect(() => {
    if (props.officialReopenRequest) {
      const i = Number(props.officialReopenRequest.id.split("-").at(-1));
      props.onSelectOfficial(selection(i));
    }
  }, [props.officialReopenRequest]);
  return (
    <nav>
      {Array.from({ length: 9 }, (_, i) => (
        <button key={i} onClick={() => props.onSelectOfficial(selection(i + 1))}>
          Select {i + 1}
        </button>
      ))}
      <button onClick={() => props.onSelectOfficial(null)}>Deselect</button>
    </nav>
  );
}
export const StaffAccessProvider = ({ children }) => children;
export const SearchBar = () => null;
export const LayerSwitcher = () => null;
export const DEFAULT_LAYERS = {};
export const DEMO_LAYERS = {};
export const TopNav = () => null;
export const Toaster = () => null;
export const PropertyPanel = () => null;
export function OfficialParcelPanel({ selection: value }) {
  const { user } = useAuth();
  const parcelId = buildSelectedOfficialParcelId(value);
  return (
    <section>
      <h2 data-selected={parcelId}>Selected {parcelId}</h2>
      <InvestigationSaveNotice parcelId={parcelId} userId={user?.id ?? null} />
    </section>
  );
}
