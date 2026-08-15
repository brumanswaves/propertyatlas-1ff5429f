import { createFileRoute } from "@tanstack/react-router";
import { LegalPage, LegalSection, LegalList, LegalCallout } from "@/components/layout/LegalPage";

export const Route = createFileRoute("/data-sources")({
  head: () => ({
    meta: [
      { title: "Data Sources | Easy Erf" },
      {
        name: "description",
        content:
          "How Easy Erf uses cadastral, municipal, uploaded, provider and derived evidence, and how source confidence is kept visible.",
      },
    ],
  }),
  component: DataSourcesPage,
});

function DataSourcesPage() {
  return (
    <LegalPage
      title="Data Sources and Evidence"
      intro="Easy Erf combines different kinds of property evidence. The important rule is not that every source is equally authoritative. The product should show what a source can support, what it cannot support, and how confidently it is connected to the selected property."
    >
      <LegalSection title="Evidence Easy Erf May Use">
        <LegalList
          items={[
            "official cadastral and Surveyor-General information",
            "municipal planning documents, zoning plans and public GIS records",
            "public geospatial and environmental datasets",
            "uploaded SG diagrams, title documents, plans, certificates and other property files",
            "optional third-party provider reports such as Lightstone or WinDeed when supplied",
            "listing URLs and Market Evidence saved by the user",
            "user-entered facts, confirmations and assumptions",
            "deterministic calculations and clearly labelled derived analysis",
            "AI-assisted document interpretation and explanation where configured",
          ]}
        />
      </LegalSection>

      <LegalSection title="Property Binding Matters">
        <p>
          A readable document is not automatically evidence for the selected erf. Easy Erf uses cadastral identifiers, erf and portion details, location context and user confirmation to determine whether material belongs to the current property file.
        </p>
        <p>
          Administrative geography such as town, suburb, district or registration region can support confidence, but it should not by itself reject a readable document. Strong cadastral contradictions remain the clearest reason to treat evidence as a mismatch.
        </p>
      </LegalSection>

      <LegalSection title="Verified, Working, Assumed and Missing">
        <p>Easy Erf should preserve the difference between:</p>
        <LegalList
          items={[
            "official or document-supported evidence",
            "a user-confirmed working conclusion",
            "a published general rule that has not been proved as a parcel-specific right",
            "an explicit user or system assumption",
            "AI interpretation or derived analysis",
            "missing, unresolved or conflicting evidence",
          ]}
        />
        <LegalCallout>
          A stronger-looking interface does not make weak evidence stronger. Confidence and provenance must travel with the conclusion.
        </LegalCallout>
      </LegalSection>

      <LegalSection title="Planning Sources">
        <p>
          Planning coverage varies by municipality. A municipality-wide land use scheme or town zoning map can be a credible official source without automatically proving the zoning of one parcel. Easy Erf only claims automatic parcel zoning detection where a reviewed, verified property-specific method exists.
        </p>
        <p>
          Kouga and the St Francis area are the deepest current planning pilot. The reviewed registry includes verified official source artifacts, while parcel-specific correlation and rule citations continue to be improved cautiously.
        </p>
      </LegalSection>

      <LegalSection title="Paid Provider Evidence">
        <p>
          Third-party reports may add ownership, deed, valuation, transfer, bond or comparable information depending on the provider and report purchased. Easy Erf should preserve the provider report as evidence rather than silently converting it into an unsupported platform claim.
        </p>
        <p>
          A live Easy Erf in-app payment checkout for these reports is not currently offered. Provider fees and availability remain separate unless a real payment integration is explicitly shown in the product.
        </p>
      </LegalSection>

      <LegalSection title="Calculations and AI">
        <p>
          Strategy outputs are derived from deterministic formulas and the inputs available to the property scenario. A calculation may be mathematically correct while one or more inputs remain assumptions, so the source and status of material inputs still matter.
        </p>
        <p>
          AI can help extract, explain and compare information, but AI output is not official evidence. Easy Erf should identify uncertainty, preserve source links where available and avoid inventing missing facts.
        </p>
      </LegalSection>

      <LegalSection title="Coverage and Freshness">
        <p>
          Source availability, update cadence and completeness vary by municipality, provider and property. Easy Erf does not guarantee that every public record or professional document has been retrieved, or that a source has not changed since it was last reviewed.
        </p>
        <LegalCallout>
          Material decisions should still be checked against the relevant current official source or qualified professional when formal confirmation is required.
        </LegalCallout>
      </LegalSection>
    </LegalPage>
  );
}
