// Evidence attribution: which Microsoft IQ system a citation came from, and how to
// present it. SourceIds are the platform's context-source identifiers (ADR-0009).

export interface SourceSystem {
  id: string;
  label: string;
  tagType: "blue" | "cyan" | "warm-gray" | "gray";
  description: string;
}

const SYSTEMS: Record<string, SourceSystem> = {
  FoundryIQ: {
    id: "FoundryIQ",
    label: "Foundry IQ · knowledge",
    tagType: "blue",
    description: "Policy, procedure and regulatory documents retrieved from the governed knowledge base (Azure AI Search).",
  },
  FabricIQ: {
    id: "FabricIQ",
    label: "Fabric IQ · semantic",
    tagType: "cyan",
    description: "Entity history, similarity and portfolio lookups answered by the Fabric semantic layer over the lakehouse.",
  },
  WorkIQ: {
    id: "WorkIQ",
    label: "Work IQ · collaboration",
    tagType: "warm-gray",
    description: "Human collaboration context: the team threads and notes relevant to this subject.",
  },
};

export function sourceSystem(sourceId?: string | null): SourceSystem {
  return (
    SYSTEMS[sourceId ?? ""] ?? {
      id: sourceId ?? "unknown",
      label: sourceId ?? "unknown source",
      tagType: "gray",
      description: "",
    }
  );
}

export function shortDocId(docId: string): string {
  // "POLICYHOLDER_HISTORY/PH-476168" reads better as "POLICYHOLDER_HISTORY PH-476168".
  return docId.replace("/", " · ");
}

export function ontologyLabel(binding: string): string {
  // "acl:Coverage" -> "Coverage" (the namespace is noise on screen; the record page keeps it).
  const i = binding.indexOf(":");
  return i > 0 ? binding.slice(i + 1) : binding;
}
