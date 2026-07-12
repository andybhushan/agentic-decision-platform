// AUTO-GENERATED from the Insurance Claims Process export. Do not edit by hand.
// Regenerate: node scripts/buildClaimsModel.mjs <path-to-source-json>
/* eslint-disable */

export interface AgentMeta {
  agentMode?: string;
  agentRole?: string;
  assertionLevel?: string;
  scope?: string;
  runtime?: string;
  toolInvocation?: string;
  orchestrator?: string;
  hosting?: string;
  knowledgeRetrieval?: string;
  confidenceThreshold?: number;
  escalationPath?: string;
  memoryScope?: string;
  decisionBoundary?: string;
  narrative?: string;
}

export interface ModelControls {
  authRequired?: boolean;
  dataSensitivity?: string;
  auditLogging?: boolean;
  regulatoryTags?: string[];
}

export interface ModelNode {
  id: string;
  name: string;
  stepType: string;
  description?: string;
  capability?: string;
  primaryActor?: string;
  architectureRole?: string;
  channelType?: string;
  scope?: string;
  customerImpact?: string;
  pillar?: string;
  constraintsAssumptions?: string;
  purpose?: string;
  dataIn?: string[];
  dataOut?: string[];
  technologies?: string[];
  supportingSystems?: string[];
  integrations?: string[];
  referencedTechnologies?: string[];
  controls?: ModelControls;
  agent?: AgentMeta;
}

export interface SubflowEdge {
  source: string;
  target: string;
  label?: string;
}

export interface Subflow {
  parentId: string;
  rootId: string;
  nodes: ModelNode[];
  edges: SubflowEdge[];
}

export const modelNodes: Record<string, ModelNode> = {
  "A": {
    "id": "A",
    "name": "Start Claim",
    "stepType": "human_task",
    "description": "Customer contacts insurance company to raise a claim against something they believe is covered (i.e. car accident, accidental damage etc.)",
    "primaryActor": "Policy Holder",
    "scope": "customer",
    "constraintsAssumptions": "Claimant has valid policy\nIs able to access provided channels",
    "purpose": "Customer initiates claim",
    "dataIn": [
      "PII Details + Policy Information"
    ],
    "dataOut": [
      "Claim ID"
    ],
    "controls": {
      "authRequired": true,
      "dataSensitivity": "pii",
      "auditLogging": true
    }
  },
  "N1": {
    "id": "N1",
    "name": "Selects Channel",
    "stepType": "human_task",
    "description": "Policy holder contacts insurance org using their proffered method of contact",
    "capability": "Initiate Claims Notification",
    "primaryActor": "Policy Holder",
    "scope": "customer",
    "constraintsAssumptions": "Customer may not have policy details available",
    "purpose": "Customer indicates a loss has occurred and starts the claims journey",
    "dataIn": [
      "Loss Occurrence"
    ],
    "dataOut": [
      "Claim package"
    ],
    "controls": {
      "authRequired": true,
      "dataSensitivity": "pii",
      "auditLogging": true
    }
  },
  "N2": {
    "id": "N2",
    "name": "Web Intake",
    "stepType": "channel_interaction",
    "description": "Policyholder uses the website to raise their claim",
    "capability": "Claim Capture",
    "primaryActor": "Policy Holder",
    "architectureRole": "system_of_engagement",
    "channelType": "web",
    "scope": "customer",
    "customerImpact": "Reduced Friction",
    "pillar": "Reinvent customer engagement",
    "purpose": "Policy holder raises claim via Web Portal",
    "dataIn": [
      "Documentation (PDF)",
      "Email",
      "SMS",
      "Chat / Transcript",
      "Voice",
      "Images",
      "Witness details",
      "Police / Incident Reference"
    ],
    "dataOut": [
      "Claim Package"
    ],
    "technologies": [
      "Agent365"
    ],
    "supportingSystems": [
      "Client Portal"
    ],
    "referencedTechnologies": [
      "Copilot Studio",
      "Microsoft Foundry Model",
      "Azure Logic Apps",
      "Azure API Management",
      "Microsoft Fabric",
      "Agent365",
      "Visual Studio Code",
      "Application Insights",
      "IBM Process Mining"
    ],
    "controls": {
      "authRequired": true,
      "dataSensitivity": "pii",
      "auditLogging": true
    }
  },
  "N3": {
    "id": "N3",
    "name": "Mobile Intake",
    "stepType": "channel_interaction",
    "description": "Policyholder uses the mobile app to raise their claim",
    "capability": "Claim Capture",
    "primaryActor": "Policy Holder",
    "architectureRole": "system_of_engagement",
    "channelType": "mobile",
    "scope": "customer",
    "customerImpact": "Reduced Friction",
    "pillar": "Reinvent customer engagement",
    "purpose": "Policyholder raises claim via Mobile App",
    "dataIn": [
      "Documentation (PDF)",
      "Email",
      "SMS",
      "Chat / Transcript",
      "Voice",
      "Images",
      "Witness details",
      "Police / Incident Reference"
    ],
    "dataOut": [
      "Claim Package"
    ],
    "technologies": [
      "Agent365"
    ],
    "referencedTechnologies": [
      "Copilot Studio",
      "Microsoft Foundry Model",
      "Azure Logic Apps",
      "Azure API Management",
      "Microsoft Fabric",
      "Agent365",
      "Visual Studio Code",
      "Application Insights",
      "IBM Process Mining"
    ],
    "controls": {
      "authRequired": true,
      "dataSensitivity": "pii",
      "auditLogging": true
    }
  },
  "N4": {
    "id": "N4",
    "name": "Call Centre",
    "stepType": "channel_interaction",
    "description": "Policy calls into the contact centre to raise a claim",
    "capability": "Claim Capture",
    "primaryActor": "Policy Holder",
    "architectureRole": "system_of_engagement",
    "channelType": "voice",
    "scope": "customer",
    "customerImpact": "Reduced Friction",
    "pillar": "Reinvent customer engagement",
    "purpose": "Policy holder raises claim via Web Portal",
    "dataIn": [
      "Email",
      "Documents (PDF)",
      "Voice / Transcript",
      "Images"
    ],
    "dataOut": [
      "Claims Package"
    ],
    "technologies": [
      "Custom Agent"
    ],
    "referencedTechnologies": [
      "Copilot Studio",
      "Microsoft Foundry Model",
      "Azure Logic Apps",
      "Azure API Management",
      "FabricIQ",
      "Agent365",
      "Microsoft Entra ID",
      "Microsoft Purview",
      "Visual Studio Code",
      "Application Insights",
      "IBM Process Mining"
    ],
    "controls": {
      "authRequired": true,
      "dataSensitivity": "pii",
      "auditLogging": true
    },
    "agent": {
      "agentMode": "assistive",
      "agentRole": "specialist",
      "knowledgeRetrieval": "rag_internal",
      "confidenceThreshold": 0.85,
      "escalationPath": "Claims Handler",
      "memoryScope": "stateless"
    }
  },
  "N5": {
    "id": "N5",
    "name": "Branch",
    "stepType": "channel_interaction",
    "description": "Policy holder initiates their claim in person via a branch based CSR",
    "capability": "Claim Capture",
    "primaryActor": "Policy Holder",
    "architectureRole": "system_of_engagement",
    "channelType": "in_person",
    "scope": "customer",
    "pillar": "Enrich employee experiences",
    "purpose": "Claim initiation",
    "dataIn": [
      "Physical Documentation",
      "Physical Images"
    ],
    "dataOut": [
      "Claim Package"
    ],
    "referencedTechnologies": [
      "Copilot Studio",
      "Microsoft Foundry Model",
      "Azure Logic Apps",
      "Azure API Management",
      "Microsoft Fabric",
      "Agent365",
      "Microsoft Entra ID",
      "Microsoft Purview",
      "Visual Studio Code",
      "Application Insights",
      "IBM Process Mining"
    ],
    "controls": {
      "authRequired": true,
      "dataSensitivity": "pii",
      "auditLogging": true
    }
  },
  "N6": {
    "id": "N6",
    "name": "System of Record",
    "stepType": "data_operation",
    "description": "Core claims platform that stores and governs claim records, decisions, and payment status.",
    "capability": "Claims System",
    "primaryActor": "System",
    "architectureRole": "system_of_record",
    "scope": "Underlying system which maintains Claims/Customer Information",
    "dataIn": [
      "Claim updates",
      "Policy reference",
      "Customer reference"
    ],
    "dataOut": [
      "Claim record",
      "Claim status",
      "Audit events"
    ],
    "referencedTechnologies": [
      "IBM Instana"
    ],
    "controls": {
      "authRequired": true,
      "dataSensitivity": "pii",
      "auditLogging": true
    }
  },
  "N8": {
    "id": "N8",
    "name": "Doc Review Digital Worker",
    "stepType": "orchestrator",
    "description": "Coordinates multiple tasks and tool calls to complete 'Doc Review Digital Worker' safely and consistently. Decisions are automated but final approval remains external. Clear human override and appeal paths are available where required. Outputs are optimised for adjuster usability and fast comprehension.",
    "capability": "Evidence Collection",
    "primaryActor": "Agent",
    "architectureRole": "agentic_orchestrator",
    "scope": "agent",
    "customerImpact": "Faster Resolution",
    "pillar": "Reshape business processes",
    "dataIn": [
      "Claim package",
      "Evidence documents",
      "Images"
    ],
    "dataOut": [
      "Extracted fields",
      "Confidence scores"
    ],
    "technologies": [
      "Custom Agent",
      "Agent365"
    ],
    "referencedTechnologies": [
      "Copilot Studio",
      "Microsoft Foundry Model",
      "Azure Logic Apps",
      "FabricIQ",
      "Agent365",
      "Microsoft Entra ID",
      "Visual Studio Code",
      "Application Insights",
      "IBM Process Mining",
      "Confluent"
    ],
    "controls": {
      "authRequired": true,
      "dataSensitivity": "confidential",
      "auditLogging": true,
      "regulatoryTags": [
        "GLBA Safeguards Rule",
        "NAIC Unfair Claims Settlement Practices Act",
        "State DOI Market Conduct",
        "NAIC AI/ML Model Bulletin (2023-3)",
        "NIST AI RMF",
        "FCRA (consumer report data)",
        "GLBA Privacy Rule",
        "State records-retention statutes"
      ]
    },
    "agent": {
      "agentMode": "autonomous",
      "agentRole": "orchestrator",
      "assertionLevel": "advisory",
      "runtime": "Managed agent runtime",
      "toolInvocation": "MCP",
      "orchestrator": "Custom Agent",
      "hosting": "Azure",
      "knowledgeRetrieval": "rag_internal",
      "confidenceThreshold": 0.85,
      "escalationPath": "Claims Handler",
      "memoryScope": "stateless",
      "decisionBoundary": "May orchestrate extraction and classification of evidence; may not determine coverage or the claim outcome."
    }
  },
  "N11": {
    "id": "N11",
    "name": "Low Confidence Review",
    "stepType": "human_task",
    "description": "A human operator performs 'Low Confidence Review' as part of the claims process. Outputs are optimised for adjuster usability and fast comprehension.",
    "capability": "Evidence Collection",
    "primaryActor": "Claims Handler",
    "architectureRole": "supporting_service",
    "scope": "adjuster",
    "customerImpact": "Faster Resolution",
    "pillar": "Enrich employee experiences",
    "dataIn": [
      "Work queue item",
      "Claim summary",
      "Supporting evidence"
    ],
    "dataOut": [
      "Decision outcome",
      "Case notes"
    ],
    "referencedTechnologies": [
      "Copilot Studio",
      "Azure Logic Apps",
      "Microsoft Foundry Model",
      "Granite",
      "Agent365",
      "Microsoft Entra ID",
      "Application Insights"
    ]
  },
  "N12": {
    "id": "N12",
    "name": "Fraud Digital Worker",
    "stepType": "orchestrator",
    "description": "Coordinates multiple tasks and tool calls to complete 'Fraud Digital Worker' safely and consistently. Decisions are automated but final approval remains external. Clear human override and appeal paths are available where required.",
    "capability": "Fraud Assessment",
    "primaryActor": "Agent",
    "scope": "agent",
    "dataIn": [
      "Claim package",
      "Evidence metadata"
    ],
    "dataOut": [
      "Fraud signals"
    ],
    "referencedTechnologies": [
      "Copilot Studio",
      "Custom Agent",
      "Microsoft Foundry Model",
      "Granite",
      "Azure Logic Apps",
      "Confluent",
      "FabricIQ",
      "Microsoft Fabric",
      "Agent365",
      "Microsoft Entra ID",
      "Visual Studio Code",
      "Application Insights",
      "IBM Process Mining"
    ],
    "controls": {
      "authRequired": true,
      "dataSensitivity": "pii",
      "auditLogging": true,
      "regulatoryTags": [
        "GLBA Safeguards Rule",
        "NAIC Unfair Claims Settlement Practices Act",
        "State DOI Market Conduct",
        "NAIC AI/ML Model Bulletin (2023-3)",
        "NIST AI RMF",
        "NAIC Insurance Fraud reporting",
        "State Insurance Fraud Bureau referral",
        "FCRA adverse-action reason codes",
        "ECOA / Reg B (no prohibited-basis discrimination)",
        "Colorado SB21-169 algorithmic fairness"
      ]
    },
    "agent": {
      "agentMode": "autonomous",
      "agentRole": "orchestrator",
      "assertionLevel": "advisory",
      "runtime": "Managed agent runtime",
      "toolInvocation": "MCP",
      "orchestrator": "Custom Agent",
      "hosting": "Azure",
      "knowledgeRetrieval": "rag_internal",
      "confidenceThreshold": 0.85,
      "escalationPath": "Claims Handler",
      "memoryScope": "case_scoped",
      "decisionBoundary": "May orchestrate fraud analytics and produce a risk assessment; may not deny a claim or refer to SIU without human review."
    }
  },
  "N13": {
    "id": "N13",
    "name": "Rules Engine",
    "stepType": "decision_rules",
    "description": "Evaluates fraud or eligibility rules and produces rule-based signals.",
    "capability": "Fraud Assessment",
    "primaryActor": "System",
    "architectureRole": "supporting_service",
    "scope": "system",
    "dataIn": [
      "Policy schedule",
      "Claim context"
    ],
    "dataOut": [
      "Coverage determination",
      "Policy exceptions",
      "Confidence scores"
    ],
    "referencedTechnologies": [
      "Azure API Management",
      "Microsoft Entra ID",
      "Visual Studio Code",
      "IBM Instana"
    ],
    "controls": {
      "dataSensitivity": "internal"
    },
    "agent": {
      "hosting": "Azure",
      "knowledgeRetrieval": "rag"
    }
  },
  "N14": {
    "id": "N14",
    "name": "Fraud Score",
    "stepType": "agent_task",
    "description": "Executes a focused task 'Fraud Score' and returns structured outputs and confidence signals. Clear human override and appeal paths are available where required.",
    "capability": "Fraud Assessment",
    "primaryActor": "Agent",
    "scope": "agent",
    "customerImpact": "Faster Resolution",
    "pillar": "Reshape business processes",
    "dataIn": [
      "Claim package",
      "Evidence metadata"
    ],
    "dataOut": [
      "Fraud signals"
    ],
    "referencedTechnologies": [
      "Copilot Studio",
      "Custom Agent",
      "Microsoft Foundry Model",
      "Granite",
      "Azure Logic Apps",
      "Microsoft Fabric",
      "Agent365",
      "Microsoft Entra ID",
      "Microsoft Purview"
    ],
    "controls": {
      "authRequired": true,
      "dataSensitivity": "confidential",
      "auditLogging": true,
      "regulatoryTags": [
        "GLBA Safeguards Rule",
        "NAIC Unfair Claims Settlement Practices Act",
        "State DOI Market Conduct",
        "NAIC AI/ML Model Bulletin (2023-3)",
        "NIST AI RMF",
        "NAIC Insurance Fraud reporting",
        "State Insurance Fraud Bureau referral",
        "FCRA adverse-action reason codes",
        "ECOA / Reg B (no prohibited-basis discrimination)",
        "Colorado SB21-169 algorithmic fairness"
      ]
    },
    "agent": {
      "agentMode": "semi_autonomous",
      "agentRole": "specialist",
      "assertionLevel": "signal",
      "runtime": "Managed agent runtime",
      "toolInvocation": "MCP",
      "orchestrator": "Copilot Studio",
      "hosting": "Azure",
      "knowledgeRetrieval": "rag_internal",
      "confidenceThreshold": 0.85,
      "escalationPath": "Claims Handler",
      "memoryScope": "case_scoped",
      "decisionBoundary": "Produces an advisory fraud score; never auto-denies a claim."
    }
  },
  "N15": {
    "id": "N15",
    "name": "Network Analysis",
    "stepType": "agent_task",
    "description": "Executes a focused task 'Network Analysis' and returns structured outputs and confidence signals. Clear human override and appeal paths are available where required.",
    "capability": "Fraud Assessment",
    "primaryActor": "Agent",
    "scope": "agent",
    "customerImpact": "Faster Resolution",
    "pillar": "Reshape business processes",
    "dataIn": [
      "Claim parties",
      "Historical claims graph",
      "External identifiers"
    ],
    "dataOut": [
      "Network links",
      "Ring indicators",
      "Confidence scores"
    ],
    "referencedTechnologies": [
      "Copilot Studio",
      "Custom Agent",
      "Microsoft Foundry Model",
      "Granite",
      "Azure Logic Apps",
      "Microsoft Fabric",
      "Agent365",
      "Microsoft Entra ID",
      "Microsoft Purview"
    ],
    "controls": {
      "authRequired": true,
      "dataSensitivity": "confidential",
      "auditLogging": true,
      "regulatoryTags": [
        "GLBA Safeguards Rule",
        "NAIC Unfair Claims Settlement Practices Act",
        "State DOI Market Conduct",
        "NAIC AI/ML Model Bulletin (2023-3)",
        "NIST AI RMF",
        "NAIC Insurance Fraud reporting",
        "State Insurance Fraud Bureau referral",
        "FCRA adverse-action reason codes",
        "ECOA / Reg B (no prohibited-basis discrimination)",
        "Colorado SB21-169 algorithmic fairness"
      ]
    },
    "agent": {
      "agentMode": "semi_autonomous",
      "agentRole": "specialist",
      "assertionLevel": "signal",
      "runtime": "Managed agent runtime",
      "toolInvocation": "MCP",
      "orchestrator": "Copilot Studio",
      "hosting": "Azure",
      "knowledgeRetrieval": "rag_internal",
      "confidenceThreshold": 0.85,
      "escalationPath": "Claims Handler",
      "memoryScope": "stateless",
      "decisionBoundary": "Surfaces network and link signals for review; advisory only, no claim decision."
    }
  },
  "N16": {
    "id": "N16",
    "name": "External Data Checks",
    "stepType": "agent_task",
    "description": "Executes a focused task 'External Data Checks' and returns structured outputs and confidence signals. Clear human override and appeal paths are available where required.",
    "capability": "Fraud Assessment",
    "primaryActor": "Agent",
    "scope": "agent",
    "customerImpact": "Faster Resolution",
    "pillar": "Reshape business processes",
    "dataIn": [
      "Claim parties",
      "Policy reference"
    ],
    "dataOut": [
      "External check results",
      "Adverse-action reason codes",
      "Confidence scores"
    ],
    "referencedTechnologies": [
      "Copilot Studio",
      "Custom Agent",
      "Microsoft Foundry Model",
      "Granite",
      "Azure Logic Apps",
      "Microsoft Fabric",
      "Agent365",
      "Microsoft Entra ID",
      "Microsoft Purview"
    ],
    "controls": {
      "authRequired": true,
      "dataSensitivity": "confidential",
      "auditLogging": true,
      "regulatoryTags": [
        "GLBA Safeguards Rule",
        "NAIC Unfair Claims Settlement Practices Act",
        "State DOI Market Conduct",
        "NAIC AI/ML Model Bulletin (2023-3)",
        "NIST AI RMF",
        "NAIC Insurance Fraud reporting",
        "State Insurance Fraud Bureau referral",
        "FCRA adverse-action reason codes",
        "ECOA / Reg B (no prohibited-basis discrimination)",
        "Colorado SB21-169 algorithmic fairness"
      ]
    },
    "agent": {
      "agentMode": "semi_autonomous",
      "agentRole": "specialist",
      "assertionLevel": "signal",
      "runtime": "Managed agent runtime",
      "toolInvocation": "MCP",
      "orchestrator": "Copilot Studio",
      "hosting": "Azure",
      "knowledgeRetrieval": "rag_internal",
      "confidenceThreshold": 0.85,
      "escalationPath": "Claims Handler",
      "memoryScope": "stateless",
      "decisionBoundary": "Runs external data checks; advisory; adverse data triggers FCRA reason codes."
    }
  },
  "N17": {
    "id": "N17",
    "name": "Fraud Ranking",
    "stepType": "agent_task",
    "description": "Executes a focused task 'Fraud Ranking' and returns structured outputs and confidence signals. Clear human override and appeal paths are available where required.",
    "capability": "Fraud Assessment",
    "primaryActor": "Agent",
    "scope": "agent",
    "customerImpact": "Faster Resolution",
    "pillar": "Reshape business processes",
    "dataIn": [
      "Claim package",
      "Evidence metadata"
    ],
    "dataOut": [
      "Fraud signals"
    ],
    "referencedTechnologies": [
      "Copilot Studio",
      "Custom Agent",
      "Microsoft Foundry Model",
      "Granite",
      "Azure Logic Apps",
      "Microsoft Fabric",
      "Agent365",
      "Microsoft Entra ID",
      "Microsoft Purview"
    ],
    "controls": {
      "authRequired": true,
      "dataSensitivity": "confidential",
      "auditLogging": true,
      "regulatoryTags": [
        "GLBA Safeguards Rule",
        "NAIC Unfair Claims Settlement Practices Act",
        "State DOI Market Conduct",
        "NAIC AI/ML Model Bulletin (2023-3)",
        "NIST AI RMF",
        "NAIC Insurance Fraud reporting",
        "State Insurance Fraud Bureau referral",
        "FCRA adverse-action reason codes",
        "ECOA / Reg B (no prohibited-basis discrimination)",
        "Colorado SB21-169 algorithmic fairness"
      ]
    },
    "agent": {
      "agentMode": "semi_autonomous",
      "agentRole": "specialist",
      "assertionLevel": "signal",
      "runtime": "Managed agent runtime",
      "toolInvocation": "MCP",
      "orchestrator": "Copilot Studio",
      "hosting": "Azure",
      "knowledgeRetrieval": "rag_internal",
      "confidenceThreshold": 0.85,
      "escalationPath": "Claims Handler",
      "memoryScope": "case_scoped",
      "decisionBoundary": "Ranks fraud risk for triage; advisory; makes no claim decision."
    }
  },
  "N20": {
    "id": "N20",
    "name": "Policy Digital Worker",
    "stepType": "orchestrator",
    "description": "Coordinates multiple tasks and tool calls to complete 'Policy Digital Worker' safely and consistently. Decisions are automated but final approval remains external. Clear human override and appeal paths are available where required.",
    "capability": "Case Review",
    "primaryActor": "Agent",
    "scope": "agent",
    "customerImpact": "Increased NPS Score",
    "pillar": "Reshape business processes",
    "dataIn": [
      "Policy reference",
      "Claim context"
    ],
    "dataOut": [
      "Coverage determination"
    ],
    "referencedTechnologies": [
      "Copilot Studio",
      "Custom Agent",
      "Microsoft Foundry Model",
      "Granite",
      "Azure Logic Apps",
      "Confluent",
      "FabricIQ",
      "Microsoft Fabric",
      "Agent365",
      "Microsoft Entra ID",
      "Visual Studio Code",
      "Application Insights",
      "IBM Process Mining"
    ],
    "controls": {
      "authRequired": true,
      "dataSensitivity": "pii",
      "auditLogging": true,
      "regulatoryTags": [
        "GLBA Safeguards Rule",
        "NAIC Unfair Claims Settlement Practices Act",
        "State DOI Market Conduct",
        "NAIC AI/ML Model Bulletin (2023-3)",
        "NIST AI RMF",
        "State DOI Unfair Claims Settlement Practices",
        "NAIC Market Conduct",
        "ERISA (group policies, where applicable)"
      ]
    },
    "agent": {
      "agentMode": "autonomous",
      "agentRole": "orchestrator",
      "assertionLevel": "advisory",
      "runtime": "Managed agent runtime",
      "toolInvocation": "MCP",
      "orchestrator": "Custom Agent",
      "hosting": "Azure",
      "knowledgeRetrieval": "rag_internal",
      "confidenceThreshold": 0.85,
      "escalationPath": "Claims Handler",
      "memoryScope": "case_scoped",
      "decisionBoundary": "May orchestrate coverage review; final denial or limit decisions require human adjuster approval."
    }
  },
  "N21": {
    "id": "N21",
    "name": "Policy Review",
    "stepType": "agent_task",
    "description": "Executes a focused task 'Policy Review' and returns structured outputs and confidence signals. Clear human override and appeal paths are available where required. Outputs are optimised for adjuster usability and fast comprehension.",
    "capability": "Case Review",
    "primaryActor": "Agent",
    "scope": "agent",
    "customerImpact": "Faster Resolution",
    "pillar": "Reshape business processes",
    "dataIn": [
      "Policy reference",
      "Claim context"
    ],
    "dataOut": [
      "Coverage determination"
    ],
    "referencedTechnologies": [
      "Copilot Studio",
      "Custom Agent",
      "Microsoft Foundry Model",
      "Granite",
      "Azure Logic Apps",
      "Microsoft Fabric",
      "Agent365",
      "Microsoft Entra ID",
      "Microsoft Purview"
    ],
    "controls": {
      "authRequired": true,
      "dataSensitivity": "confidential",
      "auditLogging": true,
      "regulatoryTags": [
        "GLBA Safeguards Rule",
        "NAIC Unfair Claims Settlement Practices Act",
        "State DOI Market Conduct",
        "NAIC AI/ML Model Bulletin (2023-3)",
        "NIST AI RMF",
        "State DOI Unfair Claims Settlement Practices",
        "NAIC Market Conduct",
        "ERISA (group policies, where applicable)"
      ]
    },
    "agent": {
      "agentMode": "semi_autonomous",
      "agentRole": "specialist",
      "assertionLevel": "signal",
      "runtime": "Managed agent runtime",
      "toolInvocation": "MCP",
      "orchestrator": "Copilot Studio",
      "hosting": "Azure",
      "knowledgeRetrieval": "rag_internal",
      "confidenceThreshold": 0.85,
      "escalationPath": "Claims Handler",
      "memoryScope": "case_scoped",
      "decisionBoundary": "Recommends a coverage position with citations; a human approves any denial."
    }
  },
  "N23": {
    "id": "N23",
    "name": "Reasoning Engine",
    "stepType": "agent_task",
    "description": "Executes a focused task 'Reasoning Engine' and returns structured outputs and confidence signals. Clear human override and appeal paths are available where required. This step represents a formal decision boundary in the end to end claim lifecycle.",
    "capability": "Case Review",
    "primaryActor": "Agent",
    "scope": "agent",
    "customerImpact": "Faster Resolution",
    "pillar": "Reshape business processes",
    "dataIn": [
      "Policy reference",
      "Claim context",
      "Coverage recommendation"
    ],
    "dataOut": [
      "Reasoned position",
      "Rule trace"
    ],
    "referencedTechnologies": [
      "Copilot Studio",
      "Custom Agent",
      "Microsoft Foundry Model",
      "Granite",
      "Azure Logic Apps",
      "Microsoft Fabric",
      "Agent365",
      "Microsoft Entra ID",
      "Microsoft Purview"
    ],
    "controls": {
      "authRequired": true,
      "dataSensitivity": "confidential",
      "auditLogging": true,
      "regulatoryTags": [
        "GLBA Safeguards Rule",
        "NAIC Unfair Claims Settlement Practices Act",
        "State DOI Market Conduct",
        "NAIC AI/ML Model Bulletin (2023-3)",
        "NIST AI RMF",
        "State DOI Unfair Claims Settlement Practices",
        "NAIC Market Conduct",
        "ERISA (group policies, where applicable)"
      ]
    },
    "agent": {
      "agentMode": "semi_autonomous",
      "agentRole": "specialist",
      "assertionLevel": "signal",
      "runtime": "Managed agent runtime",
      "toolInvocation": "MCP",
      "orchestrator": "Copilot Studio",
      "hosting": "Azure",
      "knowledgeRetrieval": "rag_internal",
      "confidenceThreshold": 0.85,
      "escalationPath": "Claims Handler",
      "memoryScope": "stateless",
      "decisionBoundary": "Applies policy rules to produce a reasoned coverage position; advisory to the adjuster."
    }
  },
  "N24": {
    "id": "N24",
    "name": "Explainer Agent",
    "stepType": "agent_task",
    "description": "Executes a focused task 'Explainer Agent' and returns structured outputs and confidence signals. Clear human override and appeal paths are available where required.",
    "capability": "Case Review",
    "primaryActor": "Agent",
    "scope": "agent",
    "customerImpact": "Faster Resolution",
    "pillar": "Reshape business processes",
    "dataIn": [
      "Reasoned position",
      "Policy citations"
    ],
    "dataOut": [
      "Customer-facing explanation",
      "Adjuster rationale"
    ],
    "referencedTechnologies": [
      "Copilot Studio",
      "Custom Agent",
      "Microsoft Foundry Model",
      "Granite",
      "Azure Logic Apps",
      "Microsoft Fabric",
      "Agent365",
      "Microsoft Entra ID",
      "Microsoft Purview"
    ],
    "controls": {
      "authRequired": true,
      "dataSensitivity": "confidential",
      "auditLogging": true,
      "regulatoryTags": [
        "GLBA Safeguards Rule",
        "NAIC Unfair Claims Settlement Practices Act",
        "State DOI Market Conduct",
        "NAIC AI/ML Model Bulletin (2023-3)",
        "NIST AI RMF",
        "State DOI Unfair Claims Settlement Practices",
        "NAIC Market Conduct",
        "ERISA (group policies, where applicable)"
      ]
    },
    "agent": {
      "agentMode": "semi_autonomous",
      "agentRole": "explainer",
      "assertionLevel": "signal",
      "runtime": "Managed agent runtime",
      "toolInvocation": "MCP",
      "orchestrator": "Copilot Studio",
      "hosting": "Azure",
      "knowledgeRetrieval": "rag_internal",
      "confidenceThreshold": 0.85,
      "escalationPath": "Claims Handler",
      "memoryScope": "stateless",
      "decisionBoundary": "Generates plain-language explanations of the coverage decision; holds no decision authority."
    }
  },
  "N25": {
    "id": "N25",
    "name": "Escalation",
    "stepType": "human_task",
    "description": "A human operator performs 'Escalation' as part of the claims process.",
    "capability": "Case Review",
    "primaryActor": "Claims Handler",
    "architectureRole": "supporting_service",
    "scope": "adjuster",
    "customerImpact": "Faster Resolution",
    "pillar": "Enrich employee experiences",
    "dataIn": [
      "Work queue item",
      "Claim summary",
      "Supporting evidence"
    ],
    "dataOut": [
      "Decision outcome",
      "Case notes"
    ],
    "referencedTechnologies": [
      "Copilot Studio",
      "Azure Logic Apps",
      "Microsoft Foundry Model",
      "Granite",
      "Agent365",
      "Microsoft Entra ID",
      "Application Insights"
    ]
  },
  "N27": {
    "id": "N27",
    "name": "Outreach",
    "stepType": "agent_task",
    "description": "Executes a focused task 'Outreach' and returns structured outputs and confidence signals. Clear human override and appeal paths are available where required.",
    "capability": "Investigation",
    "primaryActor": "Agent",
    "scope": "agent",
    "customerImpact": "Faster Resolution",
    "pillar": "Reshape business processes",
    "dataIn": [
      "Case context",
      "Customer contact details",
      "Consent register"
    ],
    "dataOut": [
      "Outreach log",
      "Scheduled actions",
      "Customer responses"
    ],
    "referencedTechnologies": [
      "Copilot Studio",
      "Custom Agent",
      "Microsoft Foundry Model",
      "Granite",
      "Azure Logic Apps",
      "Microsoft Fabric",
      "Agent365",
      "Microsoft Entra ID",
      "Microsoft Purview"
    ],
    "controls": {
      "authRequired": true,
      "dataSensitivity": "confidential",
      "auditLogging": true,
      "regulatoryTags": [
        "GLBA Safeguards Rule",
        "NAIC Unfair Claims Settlement Practices Act",
        "State DOI Market Conduct",
        "NAIC AI/ML Model Bulletin (2023-3)",
        "NIST AI RMF",
        "TCPA (outbound contact consent)",
        "FDCPA (recovery contact)",
        "State fair-contact rules",
        "GLBA"
      ]
    },
    "agent": {
      "agentMode": "semi_autonomous",
      "agentRole": "specialist",
      "assertionLevel": "signal",
      "runtime": "Managed agent runtime",
      "toolInvocation": "MCP",
      "orchestrator": "Copilot Studio",
      "hosting": "Azure",
      "knowledgeRetrieval": "rag_internal",
      "confidenceThreshold": 0.85,
      "escalationPath": "Claims Handler",
      "memoryScope": "stateless",
      "decisionBoundary": "May contact claimants within consent rules; cannot make settlement commitments."
    }
  },
  "N28": {
    "id": "N28",
    "name": "Settlement",
    "stepType": "orchestrator",
    "description": "Coordinates multiple tasks and tool calls to complete 'Settlement' safely and consistently. Clear human override and appeal paths are available where required.",
    "capability": "Settlement",
    "primaryActor": "Agent",
    "scope": "agent",
    "pillar": "Reshape business processes",
    "dataIn": [
      "Approved claim",
      "Settlement amount"
    ],
    "dataOut": [
      "Settlement decision"
    ],
    "referencedTechnologies": [
      "Copilot Studio",
      "Custom Agent",
      "Microsoft Foundry Model",
      "Granite",
      "Azure Logic Apps",
      "Confluent",
      "FabricIQ",
      "Microsoft Fabric",
      "Agent365",
      "Microsoft Entra ID",
      "Visual Studio Code",
      "Application Insights",
      "IBM Process Mining"
    ],
    "controls": {
      "authRequired": true,
      "dataSensitivity": "pii",
      "auditLogging": true,
      "regulatoryTags": [
        "GLBA Safeguards Rule",
        "NAIC Unfair Claims Settlement Practices Act",
        "State DOI Market Conduct",
        "NAIC AI/ML Model Bulletin (2023-3)",
        "NIST AI RMF",
        "OFAC sanctions screening",
        "AML / BSA",
        "State prompt-payment statutes",
        "IRS 1099-MISC reporting",
        "Unclaimed property / escheatment"
      ]
    },
    "agent": {
      "agentMode": "autonomous",
      "agentRole": "orchestrator",
      "assertionLevel": "authoritative",
      "runtime": "Managed agent runtime",
      "toolInvocation": "MCP",
      "orchestrator": "Custom Agent",
      "hosting": "Azure",
      "knowledgeRetrieval": "rag_internal",
      "confidenceThreshold": 0.9,
      "escalationPath": "Claims Handler",
      "memoryScope": "case_scoped",
      "decisionBoundary": "May orchestrate settlement within the authority matrix and after an OFAC clear; payments above the threshold need human authorization."
    }
  },
  "N29": {
    "id": "N29",
    "name": "Deep Fraud Review",
    "stepType": "human_task",
    "description": "A human operator performs 'Deep Fraud Review' as part of the claims process. Outputs are optimised for adjuster usability and fast comprehension.",
    "capability": "Fraud Assessment",
    "primaryActor": "Claims Handler",
    "architectureRole": "supporting_service",
    "scope": "adjuster",
    "customerImpact": "Faster Resolution",
    "pillar": "Enrich employee experiences",
    "dataIn": [
      "Claim package",
      "Evidence metadata"
    ],
    "dataOut": [
      "Fraud signals"
    ],
    "referencedTechnologies": [
      "Copilot Studio",
      "Azure Logic Apps",
      "Microsoft Foundry Model",
      "Granite",
      "Agent365",
      "Microsoft Entra ID",
      "Application Insights"
    ]
  },
  "N31": {
    "id": "N31",
    "name": "Settlement Calculation",
    "stepType": "agent_task",
    "description": "Executes a focused task 'Settlement Calculation' and returns structured outputs and confidence signals. Clear human override and appeal paths are available where required.",
    "capability": "Settlement",
    "primaryActor": "Agent",
    "scope": "agent",
    "customerImpact": "Faster Resolution",
    "pillar": "Reshape business processes",
    "dataIn": [
      "Approved claim",
      "Settlement amount"
    ],
    "dataOut": [
      "Settlement decision"
    ],
    "referencedTechnologies": [
      "Copilot Studio",
      "Custom Agent",
      "Microsoft Foundry Model",
      "Granite",
      "Azure Logic Apps",
      "Microsoft Fabric",
      "Agent365",
      "Microsoft Entra ID",
      "Microsoft Purview"
    ],
    "controls": {
      "authRequired": true,
      "dataSensitivity": "confidential",
      "auditLogging": true,
      "regulatoryTags": [
        "GLBA Safeguards Rule",
        "NAIC Unfair Claims Settlement Practices Act",
        "State DOI Market Conduct",
        "NAIC AI/ML Model Bulletin (2023-3)",
        "NIST AI RMF",
        "OFAC sanctions screening",
        "AML / BSA",
        "State prompt-payment statutes",
        "IRS 1099-MISC reporting",
        "Unclaimed property / escheatment"
      ]
    },
    "agent": {
      "agentMode": "semi_autonomous",
      "agentRole": "specialist",
      "assertionLevel": "signal",
      "runtime": "Managed agent runtime",
      "toolInvocation": "MCP",
      "orchestrator": "Copilot Studio",
      "hosting": "Azure",
      "knowledgeRetrieval": "rag_internal",
      "confidenceThreshold": 0.9,
      "escalationPath": "Claims Handler",
      "memoryScope": "case_scoped",
      "decisionBoundary": "Calculates settlement quantum within policy limits; cannot release payment."
    }
  },
  "N32": {
    "id": "N32",
    "name": "Negotiation",
    "stepType": "human_task",
    "description": "A human operator performs 'Negotiation' as part of the claims process.",
    "capability": "Settlement",
    "primaryActor": "Claims Handler",
    "architectureRole": "supporting_service",
    "scope": "adjuster",
    "customerImpact": "Faster Resolution",
    "pillar": "Enrich employee experiences",
    "dataIn": [
      "Work queue item",
      "Claim summary",
      "Supporting evidence"
    ],
    "dataOut": [
      "Decision outcome",
      "Case notes"
    ],
    "referencedTechnologies": [
      "Copilot Studio",
      "Azure Logic Apps",
      "Microsoft Foundry Model",
      "Granite",
      "Agent365",
      "Microsoft Entra ID",
      "Application Insights"
    ]
  },
  "N33": {
    "id": "N33",
    "name": "Sanctions / AML",
    "stepType": "agent_task",
    "description": "Executes a focused task 'Sanctions / AML' and returns structured outputs and confidence signals. Clear human override and appeal paths are available where required.",
    "capability": "Settlement",
    "primaryActor": "Agent",
    "scope": "regulatory",
    "customerImpact": "Faster Resolution",
    "pillar": "Reshape business processes",
    "dataIn": [
      "Closed claim record",
      "Decision trail",
      "Payment details"
    ],
    "dataOut": [
      "Compliance findings",
      "Recommendations"
    ],
    "referencedTechnologies": [
      "Copilot Studio",
      "Custom Agent",
      "Microsoft Foundry Model",
      "Granite",
      "Azure Logic Apps",
      "Microsoft Fabric",
      "Agent365",
      "Microsoft Entra ID",
      "Microsoft Purview"
    ],
    "controls": {
      "authRequired": true,
      "dataSensitivity": "confidential",
      "auditLogging": true,
      "regulatoryTags": [
        "GLBA Safeguards Rule",
        "NAIC Unfair Claims Settlement Practices Act",
        "State DOI Market Conduct",
        "NAIC AI/ML Model Bulletin (2023-3)",
        "NIST AI RMF",
        "OFAC sanctions screening",
        "AML / BSA",
        "State prompt-payment statutes",
        "IRS 1099-MISC reporting",
        "Unclaimed property / escheatment",
        "OFAC SDN / Consolidated screening",
        "FinCEN BSA / SAR filing",
        "USA PATRIOT Act CIP",
        "State AML"
      ]
    },
    "agent": {
      "agentMode": "semi_autonomous",
      "agentRole": "evaluator",
      "assertionLevel": "signal",
      "runtime": "Managed agent runtime",
      "toolInvocation": "MCP",
      "orchestrator": "Copilot Studio",
      "hosting": "Azure",
      "knowledgeRetrieval": "rag_internal",
      "confidenceThreshold": 0.85,
      "escalationPath": "Claims Handler",
      "memoryScope": "stateless",
      "decisionBoundary": "Screens payees and beneficiaries for sanctions and AML risk; may block a payment; cannot clear a confirmed hit (human only)."
    }
  },
  "N34": {
    "id": "N34",
    "name": "Payment",
    "stepType": "agent_task",
    "description": "Executes a focused task 'Payment' and returns structured outputs and confidence signals. Execution is authoritative but bounded by predefined thresholds and human override.",
    "capability": "Settlement",
    "primaryActor": "Agent",
    "scope": "agent",
    "customerImpact": "Faster Resolution",
    "pillar": "Reshape business processes",
    "dataIn": [
      "Approved claim",
      "Settlement amount"
    ],
    "dataOut": [
      "Payment instruction"
    ],
    "referencedTechnologies": [
      "Copilot Studio",
      "Custom Agent",
      "Microsoft Foundry Model",
      "Granite",
      "Azure Logic Apps",
      "Microsoft Fabric",
      "Agent365",
      "Microsoft Entra ID",
      "Microsoft Purview"
    ],
    "controls": {
      "authRequired": true,
      "dataSensitivity": "confidential",
      "auditLogging": true,
      "regulatoryTags": [
        "GLBA Safeguards Rule",
        "NAIC Unfair Claims Settlement Practices Act",
        "State DOI Market Conduct",
        "NAIC AI/ML Model Bulletin (2023-3)",
        "NIST AI RMF",
        "OFAC sanctions screening",
        "AML / BSA",
        "State prompt-payment statutes",
        "IRS 1099-MISC reporting",
        "Unclaimed property / escheatment"
      ]
    },
    "agent": {
      "agentMode": "semi_autonomous",
      "agentRole": "specialist",
      "assertionLevel": "authoritative",
      "runtime": "Managed agent runtime",
      "toolInvocation": "MCP",
      "orchestrator": "Copilot Studio",
      "hosting": "Azure",
      "knowledgeRetrieval": "rag_internal",
      "confidenceThreshold": 0.9,
      "escalationPath": "Claims Handler",
      "memoryScope": "stateless",
      "decisionBoundary": "Executes an approved payment after an OFAC clear and dual control; cannot exceed the authorized amount."
    }
  },
  "N35": {
    "id": "N35",
    "name": "Closure & Indexing",
    "stepType": "agent_task",
    "description": "Executes a focused task 'Closure & Indexing' and returns structured outputs and confidence signals. Execution is authoritative but bounded by predefined thresholds and human override.",
    "capability": "Settlement",
    "primaryActor": "Agent",
    "scope": "agent",
    "customerImpact": "Faster Resolution",
    "pillar": "Reshape business processes",
    "dataIn": [
      "Closed claim record",
      "Decision trail",
      "Payment details"
    ],
    "dataOut": [
      "Compliance findings",
      "Recommendations"
    ],
    "referencedTechnologies": [
      "Copilot Studio",
      "Custom Agent",
      "Microsoft Foundry Model",
      "Granite",
      "Azure Logic Apps",
      "Microsoft Fabric",
      "Agent365",
      "Microsoft Entra ID",
      "Microsoft Purview"
    ],
    "controls": {
      "authRequired": true,
      "dataSensitivity": "confidential",
      "auditLogging": true,
      "regulatoryTags": [
        "GLBA Safeguards Rule",
        "NAIC Unfair Claims Settlement Practices Act",
        "State DOI Market Conduct",
        "NAIC AI/ML Model Bulletin (2023-3)",
        "NIST AI RMF",
        "OFAC sanctions screening",
        "AML / BSA",
        "State prompt-payment statutes",
        "IRS 1099-MISC reporting",
        "Unclaimed property / escheatment"
      ]
    },
    "agent": {
      "agentMode": "semi_autonomous",
      "agentRole": "specialist",
      "assertionLevel": "authoritative",
      "runtime": "Managed agent runtime",
      "toolInvocation": "MCP",
      "orchestrator": "Copilot Studio",
      "hosting": "Azure",
      "knowledgeRetrieval": "rag_internal",
      "confidenceThreshold": 0.85,
      "escalationPath": "Claims Handler",
      "memoryScope": "stateless",
      "decisionBoundary": "Closes and indexes settled claims; cannot reopen or alter prior decisions."
    }
  },
  "N37": {
    "id": "N37",
    "name": "Telemetry",
    "stepType": "agent_task",
    "description": "Executes a focused task 'Telemetry' and returns structured outputs and confidence signals. Clear human override and appeal paths are available where required.",
    "capability": "Compliance",
    "scope": "regulatory",
    "dataIn": [
      "Process events",
      "Agent traces"
    ],
    "dataOut": [
      "Telemetry metrics",
      "KPI snapshots"
    ],
    "controls": {
      "authRequired": true,
      "dataSensitivity": "internal",
      "auditLogging": true,
      "regulatoryTags": [
        "GLBA Safeguards Rule",
        "NAIC Unfair Claims Settlement Practices Act",
        "State DOI Market Conduct",
        "NAIC AI/ML Model Bulletin (2023-3)",
        "NIST AI RMF",
        "NAIC Model Audit Rule",
        "State DOI Market Conduct Annual Statement",
        "SOX 404 (if publicly held)",
        "Records-retention statutes"
      ]
    },
    "agent": {
      "agentMode": "semi_autonomous",
      "agentRole": "specialist",
      "assertionLevel": "signal",
      "runtime": "Managed agent runtime",
      "toolInvocation": "MCP",
      "orchestrator": "Copilot Studio",
      "hosting": "Azure",
      "knowledgeRetrieval": "rag_internal",
      "confidenceThreshold": 0.85,
      "escalationPath": "Claims Handler",
      "memoryScope": "case_scoped",
      "decisionBoundary": "Emits telemetry and operational metrics; holds no decision authority."
    }
  },
  "N38": {
    "id": "N38",
    "name": "Anomaly Detection",
    "stepType": "agent_task",
    "description": "Executes a focused task 'Anomaly Detection' and returns structured outputs and confidence signals. Clear human override and appeal paths are available where required.",
    "capability": "Compliance",
    "primaryActor": "Agent",
    "scope": "regulatory",
    "customerImpact": "Faster Resolution",
    "pillar": "Reshape business processes",
    "dataIn": [
      "Claim package",
      "Evidence metadata",
      "Customer profile"
    ],
    "dataOut": [
      "Fraud signals",
      "Fraud ranking",
      "Confidence scores"
    ],
    "referencedTechnologies": [
      "Copilot Studio",
      "Custom Agent",
      "Microsoft Foundry Model",
      "Granite",
      "Azure Logic Apps",
      "Microsoft Fabric",
      "Agent365",
      "Microsoft Entra ID",
      "Microsoft Purview"
    ],
    "controls": {
      "authRequired": true,
      "dataSensitivity": "confidential",
      "auditLogging": true,
      "regulatoryTags": [
        "GLBA Safeguards Rule",
        "NAIC Unfair Claims Settlement Practices Act",
        "State DOI Market Conduct",
        "NAIC AI/ML Model Bulletin (2023-3)",
        "NIST AI RMF",
        "NAIC Model Audit Rule",
        "State DOI Market Conduct Annual Statement",
        "SOX 404 (if publicly held)",
        "Records-retention statutes"
      ]
    },
    "agent": {
      "agentMode": "semi_autonomous",
      "agentRole": "specialist",
      "assertionLevel": "signal",
      "runtime": "Managed agent runtime",
      "toolInvocation": "MCP",
      "orchestrator": "Copilot Studio",
      "hosting": "Azure",
      "knowledgeRetrieval": "rag_internal",
      "confidenceThreshold": 0.85,
      "escalationPath": "Claims Handler",
      "memoryScope": "stateless",
      "decisionBoundary": "Detects anomalies in claim and process data for review; advisory only."
    }
  },
  "N39": {
    "id": "N39",
    "name": "Sampling Agent",
    "stepType": "agent_task",
    "description": "Executes a focused task 'Sampling Agent' and returns structured outputs and confidence signals. Clear human override and appeal paths are available where required.",
    "capability": "Compliance",
    "primaryActor": "Agent",
    "scope": "regulatory",
    "customerImpact": "Faster Resolution",
    "pillar": "Reshape business processes",
    "dataIn": [
      "Closed claim population",
      "Risk weighting"
    ],
    "dataOut": [
      "Audit sample",
      "Sampling rationale"
    ],
    "referencedTechnologies": [
      "Copilot Studio",
      "Custom Agent",
      "Microsoft Foundry Model",
      "Granite",
      "Azure Logic Apps",
      "Microsoft Fabric",
      "Agent365",
      "Microsoft Entra ID",
      "Microsoft Purview"
    ],
    "controls": {
      "authRequired": true,
      "dataSensitivity": "confidential",
      "auditLogging": true,
      "regulatoryTags": [
        "GLBA Safeguards Rule",
        "NAIC Unfair Claims Settlement Practices Act",
        "State DOI Market Conduct",
        "NAIC AI/ML Model Bulletin (2023-3)",
        "NIST AI RMF",
        "NAIC Model Audit Rule",
        "State DOI Market Conduct Annual Statement",
        "SOX 404 (if publicly held)",
        "Records-retention statutes"
      ]
    },
    "agent": {
      "agentMode": "semi_autonomous",
      "agentRole": "specialist",
      "assertionLevel": "signal",
      "runtime": "Managed agent runtime",
      "toolInvocation": "MCP",
      "orchestrator": "Copilot Studio",
      "hosting": "Azure",
      "knowledgeRetrieval": "rag_internal",
      "confidenceThreshold": 0.85,
      "escalationPath": "Claims Handler",
      "memoryScope": "stateless",
      "decisionBoundary": "Selects audit samples using documented statistical methods; holds no claim authority."
    }
  },
  "N40": {
    "id": "N40",
    "name": "Evidence Packs",
    "stepType": "agent_task",
    "description": "Executes a focused task 'Evidence Packs' and returns structured outputs and confidence signals. Clear human override and appeal paths are available where required. Supports multimodal inputs including structured data, documents, and images with confidence signalling.",
    "capability": "Compliance",
    "primaryActor": "Agent",
    "scope": "regulatory",
    "customerImpact": "Faster Resolution",
    "pillar": "Reshape business processes",
    "dataIn": [
      "Claim package",
      "Evidence documents",
      "Images"
    ],
    "dataOut": [
      "Extracted fields",
      "Confidence scores"
    ],
    "referencedTechnologies": [
      "Copilot Studio",
      "Custom Agent",
      "Microsoft Foundry Model",
      "Granite",
      "Azure Logic Apps",
      "Microsoft Fabric",
      "Agent365",
      "Microsoft Entra ID",
      "Microsoft Purview"
    ],
    "controls": {
      "authRequired": true,
      "dataSensitivity": "confidential",
      "auditLogging": true,
      "regulatoryTags": [
        "GLBA Safeguards Rule",
        "NAIC Unfair Claims Settlement Practices Act",
        "State DOI Market Conduct",
        "NAIC AI/ML Model Bulletin (2023-3)",
        "NIST AI RMF",
        "NAIC Model Audit Rule",
        "State DOI Market Conduct Annual Statement",
        "SOX 404 (if publicly held)",
        "Records-retention statutes"
      ]
    },
    "agent": {
      "agentMode": "semi_autonomous",
      "agentRole": "specialist",
      "assertionLevel": "signal",
      "runtime": "Managed agent runtime",
      "toolInvocation": "MCP",
      "orchestrator": "Copilot Studio",
      "hosting": "Azure",
      "knowledgeRetrieval": "rag_internal",
      "confidenceThreshold": 0.85,
      "escalationPath": "Claims Handler",
      "memoryScope": "stateless",
      "decisionBoundary": "Assembles evidence packs for audit and regulatory inspection; read-only."
    }
  },
  "N41": {
    "id": "N41",
    "name": "Compliance Checker",
    "stepType": "agent_task",
    "description": "Executes a focused task 'Compliance Checker' and returns structured outputs and confidence signals. Clear human override and appeal paths are available where required. All actions and outcomes are logged for regulatory inspection and audit replay.",
    "capability": "Compliance",
    "primaryActor": "Agent",
    "scope": "regulatory",
    "customerImpact": "Faster Resolution",
    "pillar": "Reshape business processes",
    "dataIn": [
      "Closed claim",
      "Decision trail"
    ],
    "dataOut": [
      "Compliance findings"
    ],
    "referencedTechnologies": [
      "Copilot Studio",
      "Custom Agent",
      "Microsoft Foundry Model",
      "Granite",
      "Azure Logic Apps",
      "Microsoft Fabric",
      "Agent365",
      "Microsoft Entra ID",
      "Microsoft Purview"
    ],
    "controls": {
      "authRequired": true,
      "dataSensitivity": "confidential",
      "auditLogging": true,
      "regulatoryTags": [
        "GLBA Safeguards Rule",
        "NAIC Unfair Claims Settlement Practices Act",
        "State DOI Market Conduct",
        "NAIC AI/ML Model Bulletin (2023-3)",
        "NIST AI RMF",
        "NAIC Model Audit Rule",
        "State DOI Market Conduct Annual Statement",
        "SOX 404 (if publicly held)",
        "Records-retention statutes"
      ]
    },
    "agent": {
      "agentMode": "semi_autonomous",
      "agentRole": "evaluator",
      "assertionLevel": "signal",
      "runtime": "Managed agent runtime",
      "toolInvocation": "MCP",
      "orchestrator": "Copilot Studio",
      "hosting": "Azure",
      "knowledgeRetrieval": "rag_internal",
      "confidenceThreshold": 0.85,
      "escalationPath": "Claims Handler",
      "memoryScope": "stateless",
      "decisionBoundary": "Checks operational controls against the regulatory catalog and flags gaps; cannot remediate autonomously."
    }
  },
  "N42": {
    "id": "N42",
    "name": "Improvements",
    "stepType": "agent_task",
    "description": "Executes a focused task 'Improvements' and returns structured outputs and confidence signals. Clear human override and appeal paths are available where required.",
    "capability": "Compliance",
    "primaryActor": "Agent",
    "scope": "regulatory",
    "customerImpact": "Faster Resolution",
    "pillar": "Reshape business processes",
    "dataIn": [
      "Compliance findings",
      "Process metrics",
      "Anomaly findings"
    ],
    "dataOut": [
      "Improvement recommendations",
      "Prioritised backlog"
    ],
    "referencedTechnologies": [
      "Copilot Studio",
      "Custom Agent",
      "Microsoft Foundry Model",
      "Granite",
      "Azure Logic Apps",
      "Microsoft Fabric",
      "Agent365",
      "Microsoft Entra ID",
      "Microsoft Purview"
    ],
    "controls": {
      "authRequired": true,
      "dataSensitivity": "confidential",
      "auditLogging": true,
      "regulatoryTags": [
        "GLBA Safeguards Rule",
        "NAIC Unfair Claims Settlement Practices Act",
        "State DOI Market Conduct",
        "NAIC AI/ML Model Bulletin (2023-3)",
        "NIST AI RMF",
        "NAIC Model Audit Rule",
        "State DOI Market Conduct Annual Statement",
        "SOX 404 (if publicly held)",
        "Records-retention statutes"
      ]
    },
    "agent": {
      "agentMode": "semi_autonomous",
      "agentRole": "specialist",
      "assertionLevel": "signal",
      "runtime": "Managed agent runtime",
      "toolInvocation": "MCP",
      "orchestrator": "Copilot Studio",
      "hosting": "Azure",
      "knowledgeRetrieval": "rag_internal",
      "confidenceThreshold": 0.85,
      "escalationPath": "Claims Handler",
      "memoryScope": "stateless",
      "decisionBoundary": "Recommends process improvements; advisory, with no authority to change production."
    }
  },
  "N18": {
    "id": "N18",
    "name": "Investigation",
    "stepType": "human_task",
    "description": "A human operator performs 'Investigation' as part of the claims process. Outputs are optimised for adjuster usability and fast comprehension.",
    "capability": "Investigation",
    "primaryActor": "Claims Handler",
    "architectureRole": "supporting_service",
    "scope": "adjuster",
    "customerImpact": "Faster Resolution",
    "pillar": "Enrich employee experiences",
    "dataIn": [
      "Work queue item",
      "Claim summary",
      "Supporting evidence"
    ],
    "dataOut": [
      "Decision outcome",
      "Case notes"
    ],
    "referencedTechnologies": [
      "Copilot Studio",
      "Azure Logic Apps",
      "Microsoft Foundry Model",
      "Granite",
      "Agent365",
      "Microsoft Entra ID",
      "Application Insights"
    ]
  },
  "N9": {
    "id": "N9",
    "name": "Data Extraction",
    "stepType": "agent_task",
    "description": "Executes a focused task 'Data Extraction' and returns structured outputs and confidence signals. Clear human override and appeal paths are available where required.",
    "capability": "Evidence Collection",
    "primaryActor": "Agent",
    "scope": "agent",
    "pillar": "Reshape business processes",
    "dataIn": [
      "Claim package",
      "Evidence documents",
      "Images"
    ],
    "dataOut": [
      "Extracted fields",
      "Confidence scores"
    ],
    "referencedTechnologies": [
      "Custom Agent",
      "Microsoft Foundry Model",
      "Azure API Management",
      "Microsoft Fabric",
      "FabricIQ",
      "Agent365",
      "Microsoft Entra ID",
      "Microsoft Purview",
      "Visual Studio Code",
      "Application Insights",
      "IBM Process Mining"
    ],
    "controls": {
      "authRequired": true,
      "dataSensitivity": "confidential",
      "auditLogging": true,
      "regulatoryTags": [
        "GLBA Safeguards Rule",
        "NAIC Unfair Claims Settlement Practices Act",
        "State DOI Market Conduct",
        "NAIC AI/ML Model Bulletin (2023-3)",
        "NIST AI RMF",
        "FCRA (consumer report data)",
        "GLBA Privacy Rule",
        "State records-retention statutes"
      ]
    },
    "agent": {
      "agentMode": "semi_autonomous",
      "agentRole": "specialist",
      "assertionLevel": "signal",
      "runtime": "Managed agent runtime",
      "toolInvocation": "MCP",
      "orchestrator": "Custom Agent",
      "hosting": "Azure",
      "knowledgeRetrieval": "rag_internal",
      "confidenceThreshold": 0.8,
      "escalationPath": "Claims Handler",
      "memoryScope": "stateless",
      "decisionBoundary": "May extract structured fields from evidence; may not alter source documents or decide claim validity."
    }
  },
  "N19": {
    "id": "N19",
    "name": "Data Validation",
    "stepType": "agent_task",
    "description": "Executes a focused task 'Data Validation' and returns structured outputs and confidence signals. Clear human override and appeal paths are available where required.",
    "capability": "Evidence Collection",
    "scope": "agent",
    "customerImpact": "Faster Resolution",
    "pillar": "Reshape business processes",
    "dataIn": [
      "Claim package",
      "Evidence documents"
    ],
    "dataOut": [
      "Validation results",
      "Exceptions list",
      "Confidence scores"
    ],
    "referencedTechnologies": [
      "Copilot Studio",
      "Custom Agent",
      "Microsoft Foundry Model",
      "Granite",
      "Azure Logic Apps",
      "Microsoft Fabric",
      "Agent365",
      "Microsoft Entra ID",
      "Microsoft Purview"
    ],
    "controls": {
      "authRequired": true,
      "dataSensitivity": "confidential",
      "auditLogging": true,
      "regulatoryTags": [
        "GLBA Safeguards Rule",
        "NAIC Unfair Claims Settlement Practices Act",
        "State DOI Market Conduct",
        "NAIC AI/ML Model Bulletin (2023-3)",
        "NIST AI RMF",
        "FCRA (consumer report data)",
        "GLBA Privacy Rule",
        "State records-retention statutes"
      ]
    },
    "agent": {
      "agentMode": "semi_autonomous",
      "agentRole": "evaluator",
      "assertionLevel": "signal",
      "runtime": "Managed agent runtime",
      "toolInvocation": "MCP",
      "orchestrator": "Copilot Studio",
      "hosting": "Azure",
      "knowledgeRetrieval": "rag_internal",
      "confidenceThreshold": 0.8,
      "escalationPath": "Claims Handler",
      "memoryScope": "stateless",
      "decisionBoundary": "May validate completeness and consistency and flag exceptions; may not approve or reject the claim."
    }
  },
  "N7": {
    "id": "N7",
    "name": "Claim Digital Worker",
    "stepType": "orchestrator",
    "description": "Coordinates multiple tasks and tool calls to complete 'Claim Digital Worker' safely and consistently. Clear human override and appeal paths are available where required.",
    "capability": "Claims Processing",
    "primaryActor": "Agent",
    "architectureRole": "agentic_orchestrator",
    "scope": "agent",
    "pillar": "Reshape business processes",
    "dataIn": [
      "Customer Information",
      "Claim Information",
      "Document Evidence",
      "Photographic Evidence",
      "Voice / Transcript",
      "Basic Validation Information"
    ],
    "dataOut": [
      "Claims Package"
    ],
    "technologies": [
      "Agent365"
    ],
    "integrations": [
      "Agent --> SOR --> Agent"
    ],
    "referencedTechnologies": [
      "Agent365",
      "Microsoft Foundry Model",
      "Azure Logic Apps",
      "Microsoft Fabric",
      "Microsoft Entra ID",
      "Watsonx.governance",
      "IBM Instana",
      "IBM Process Mining",
      "Visual Studio Code",
      "Confluent"
    ],
    "controls": {
      "authRequired": true,
      "dataSensitivity": "pii",
      "auditLogging": true,
      "regulatoryTags": [
        "GLBA Safeguards Rule",
        "NAIC Unfair Claims Settlement Practices Act",
        "State DOI Market Conduct",
        "NAIC AI/ML Model Bulletin (2023-3)",
        "NIST AI RMF",
        "FTC Red Flags Rule",
        "GLBA Privacy Rule",
        "TCPA (customer contact)"
      ]
    },
    "agent": {
      "agentMode": "autonomous",
      "agentRole": "orchestrator",
      "assertionLevel": "authoritative",
      "runtime": "Managed agent runtime",
      "toolInvocation": "MCP",
      "orchestrator": "Custom Agent",
      "hosting": "Azure",
      "knowledgeRetrieval": "case_history",
      "confidenceThreshold": 0.85,
      "escalationPath": "Claims Handler",
      "memoryScope": "case_scoped",
      "decisionBoundary": "Orchestrates all post-intake digital workers; may not approve coverage, deny a claim, or authorise payment — those require downstream agents and human sign-off."
    }
  },
  "N10": {
    "id": "N10",
    "name": "Data Classifier",
    "stepType": "agent_task",
    "description": "Executes a focused task 'Data Classifier' and returns structured outputs and confidence signals. Clear human override and appeal paths are available where required.",
    "capability": "Evidence Collection",
    "primaryActor": "Agent",
    "scope": "agent",
    "pillar": "Reshape business processes",
    "dataIn": [
      "Claim package",
      "Evidence documents",
      "Images"
    ],
    "dataOut": [
      "Extracted fields",
      "Confidence scores"
    ],
    "referencedTechnologies": [
      "Copilot Studio",
      "Microsoft Foundry Model",
      "Granite",
      "Azure Logic Apps",
      "Microsoft Fabric",
      "Agent365",
      "Microsoft Entra ID",
      "Microsoft Purview"
    ],
    "controls": {
      "authRequired": true,
      "dataSensitivity": "confidential",
      "auditLogging": true,
      "regulatoryTags": [
        "GLBA Safeguards Rule",
        "NAIC Unfair Claims Settlement Practices Act",
        "State DOI Market Conduct",
        "NAIC AI/ML Model Bulletin (2023-3)",
        "NIST AI RMF",
        "FCRA (consumer report data)",
        "GLBA Privacy Rule",
        "State records-retention statutes"
      ]
    },
    "agent": {
      "agentMode": "semi_autonomous",
      "agentRole": "evaluator",
      "assertionLevel": "signal",
      "runtime": "Managed agent runtime",
      "toolInvocation": "MCP",
      "orchestrator": "Custom Agent",
      "hosting": "Azure",
      "knowledgeRetrieval": "rag_internal",
      "confidenceThreshold": 0.8,
      "escalationPath": "Claims Handler",
      "memoryScope": "stateless",
      "decisionBoundary": "May classify document types and route evidence; may not reject evidence — low-confidence items are escalated."
    }
  },
  "N22": {
    "id": "N22",
    "name": "Compliance Agent",
    "stepType": "orchestrator",
    "description": "Coordinates multiple tasks and tool calls to complete 'Compliance Agent' safely and consistently. Clear human override and appeal paths are available where required. All actions and outcomes are logged for regulatory inspection and audit replay.",
    "capability": "Compliance",
    "primaryActor": "Agent",
    "scope": "regulatory",
    "pillar": "Reshape business processes",
    "dataIn": [
      "Closed claim",
      "Decision trail"
    ],
    "dataOut": [
      "Compliance findings"
    ],
    "referencedTechnologies": [
      "Copilot Studio",
      "Custom Agent",
      "Microsoft Foundry Model",
      "Granite",
      "Azure Logic Apps",
      "Confluent",
      "FabricIQ",
      "Microsoft Fabric",
      "Agent365",
      "Microsoft Entra ID",
      "Visual Studio Code",
      "Application Insights",
      "IBM Process Mining"
    ],
    "controls": {
      "authRequired": true,
      "dataSensitivity": "pii",
      "auditLogging": true,
      "regulatoryTags": [
        "GLBA Safeguards Rule",
        "NAIC Unfair Claims Settlement Practices Act",
        "State DOI Market Conduct",
        "NAIC AI/ML Model Bulletin (2023-3)",
        "NIST AI RMF",
        "NAIC Model Audit Rule",
        "State DOI Market Conduct Annual Statement",
        "SOX 404 (if publicly held)",
        "Records-retention statutes"
      ]
    },
    "agent": {
      "agentMode": "autonomous",
      "agentRole": "orchestrator",
      "assertionLevel": "authoritative",
      "runtime": "Managed agent runtime",
      "toolInvocation": "MCP",
      "orchestrator": "Custom Agent",
      "hosting": "Azure",
      "knowledgeRetrieval": "rag_internal",
      "confidenceThreshold": 0.85,
      "escalationPath": "Claims Handler",
      "memoryScope": "stateless",
      "decisionBoundary": "May orchestrate post-closure compliance review (read-only); cannot modify claims; escalates findings to the Compliance Officer."
    }
  }
};

export const topEdges: SubflowEdge[] = [
  {
    "source": "N1",
    "target": "N2"
  },
  {
    "source": "N1",
    "target": "N3"
  },
  {
    "source": "N1",
    "target": "N4"
  },
  {
    "source": "N1",
    "target": "N5"
  },
  {
    "source": "N3",
    "target": "N7"
  },
  {
    "source": "N4",
    "target": "N7"
  },
  {
    "source": "N5",
    "target": "N6"
  },
  {
    "source": "N2",
    "target": "N7"
  },
  {
    "source": "N7",
    "target": "N6"
  },
  {
    "source": "N7",
    "target": "N8"
  },
  {
    "source": "N10",
    "target": "N11"
  },
  {
    "source": "N7",
    "target": "N12"
  },
  {
    "source": "N12",
    "target": "N13"
  },
  {
    "source": "N12",
    "target": "N14"
  },
  {
    "source": "N12",
    "target": "N15"
  },
  {
    "source": "N12",
    "target": "N16"
  },
  {
    "source": "N13",
    "target": "N17"
  },
  {
    "source": "N14",
    "target": "N17"
  },
  {
    "source": "N15",
    "target": "N17"
  },
  {
    "source": "N16",
    "target": "N17"
  },
  {
    "source": "N7",
    "target": "N20"
  },
  {
    "source": "N20",
    "target": "N21"
  },
  {
    "source": "N23",
    "target": "N25"
  },
  {
    "source": "N24",
    "target": "N28"
  },
  {
    "source": "N17",
    "target": "N29"
  },
  {
    "source": "N32",
    "target": "N33"
  },
  {
    "source": "N33",
    "target": "N34"
  },
  {
    "source": "N34",
    "target": "N35"
  },
  {
    "source": "A",
    "target": "N1"
  },
  {
    "source": "N11",
    "target": "N18"
  },
  {
    "source": "N18",
    "target": "N27"
  },
  {
    "source": "N8",
    "target": "N10"
  },
  {
    "source": "N8",
    "target": "N9"
  },
  {
    "source": "N9",
    "target": "N11"
  },
  {
    "source": "N8",
    "target": "N19"
  },
  {
    "source": "N19",
    "target": "N11"
  },
  {
    "source": "N25",
    "target": "N28"
  },
  {
    "source": "N31",
    "target": "N33"
  },
  {
    "source": "N20",
    "target": "N23"
  },
  {
    "source": "N20",
    "target": "N24"
  },
  {
    "source": "N21",
    "target": "N25"
  },
  {
    "source": "N24",
    "target": "N25"
  },
  {
    "source": "N35",
    "target": "N22"
  },
  {
    "source": "N22",
    "target": "N38"
  },
  {
    "source": "N22",
    "target": "N37"
  },
  {
    "source": "N22",
    "target": "N40"
  },
  {
    "source": "N22",
    "target": "N41"
  },
  {
    "source": "N22",
    "target": "N39"
  },
  {
    "source": "N38",
    "target": "N42"
  },
  {
    "source": "N37",
    "target": "N42"
  },
  {
    "source": "N40",
    "target": "N42"
  },
  {
    "source": "N41",
    "target": "N42"
  },
  {
    "source": "N39",
    "target": "N42"
  },
  {
    "source": "N31",
    "target": "N32"
  },
  {
    "source": "N28",
    "target": "N31"
  },
  {
    "source": "N7",
    "target": "A"
  }
];

export const subflows: Record<string, Subflow> = {
  "N2": {
    "parentId": "N2",
    "rootId": "A",
    "nodes": [
      {
        "id": "N1",
        "name": "Web Intake Assistant",
        "stepType": "orchestrator",
        "description": "Chat bot style agent which will communicate with the user and guide them on creating a new claim",
        "capability": "Claim Capture",
        "primaryActor": "Agent",
        "scope": "Collects all required information to create a claim",
        "pillar": "Reinvent customer engagement",
        "controls": {
          "authRequired": true,
          "dataSensitivity": "confidential",
          "auditLogging": true,
          "regulatoryTags": [
            "GLBA Safeguards Rule",
            "NAIC Unfair Claims Settlement Practices Act",
            "State DOI Market Conduct",
            "NAIC AI/ML Model Bulletin (2023-3)",
            "NIST AI RMF",
            "FTC Red Flags Rule",
            "GLBA Privacy Rule",
            "TCPA (customer contact)"
          ]
        },
        "agent": {
          "agentMode": "autonomous",
          "agentRole": "Gathering Claim Information",
          "assertionLevel": "authoritative",
          "scope": "Collates and validates claim information provided by the policy holder",
          "runtime": "Managed agent runtime",
          "toolInvocation": "Event driven",
          "orchestrator": "Copilot Studio",
          "hosting": "Azure",
          "knowledgeRetrieval": "other",
          "confidenceThreshold": 0.85,
          "escalationPath": "Claim Handler",
          "memoryScope": "customer_scoped",
          "narrative": "This agent help policy holders create a claim and orchestrates other agents who are responsible for validating the information provided and performing preliminary checks, and generating the initial claims package"
        }
      },
      {
        "id": "N2",
        "name": "Elicit Details",
        "stepType": "agent_task",
        "capability": "Claim Capture",
        "primaryActor": "Agent",
        "scope": "Interacts with Policy Holder to verify the user and gather information about the claim",
        "pillar": "Reshape business processes",
        "dataIn": [
          "Car Telemetry",
          "Documents (PDF)",
          "Images",
          "Email",
          "Voice",
          "Witness Statements / Details",
          "Police Report",
          "Geo-Spatial Information"
        ],
        "dataOut": [
          "Claims Package"
        ],
        "integrations": [
          "Web Platform",
          "Third Party Systems",
          "Police / Accident Aervices"
        ],
        "controls": {
          "authRequired": true,
          "dataSensitivity": "confidential",
          "auditLogging": true,
          "regulatoryTags": [
            "GLBA Safeguards Rule",
            "NAIC Unfair Claims Settlement Practices Act",
            "State DOI Market Conduct",
            "NAIC AI/ML Model Bulletin (2023-3)",
            "NIST AI RMF",
            "FTC Red Flags Rule",
            "GLBA Privacy Rule",
            "TCPA (customer contact)"
          ]
        },
        "agent": {
          "agentMode": "semi_autonomous",
          "agentRole": "specialist",
          "assertionLevel": "advisory",
          "runtime": "Managed agent runtime",
          "toolInvocation": "MCP",
          "orchestrator": "Copilot Studio",
          "hosting": "Azure",
          "knowledgeRetrieval": "rag_internal",
          "confidenceThreshold": 0.85,
          "escalationPath": "Claims Handler",
          "memoryScope": "case_scoped"
        },
        "description": "Conversationally gathers first-notice-of-loss details from the policy holder — what happened, when, where and who was involved — capturing structured claim data alongside supporting documents, images and telematics."
      },
      {
        "id": "A",
        "name": "Notification of Claim",
        "stepType": "human_task",
        "capability": "Claim Capture",
        "primaryActor": "Policy Holder"
      },
      {
        "id": "N3",
        "name": "Review Details",
        "stepType": "agent_task",
        "capability": "Claim Capture",
        "pillar": "Reshape business processes",
        "controls": {
          "authRequired": true,
          "dataSensitivity": "confidential",
          "auditLogging": true,
          "regulatoryTags": [
            "GLBA Safeguards Rule",
            "NAIC Unfair Claims Settlement Practices Act",
            "State DOI Market Conduct",
            "NAIC AI/ML Model Bulletin (2023-3)",
            "NIST AI RMF",
            "FTC Red Flags Rule",
            "GLBA Privacy Rule",
            "TCPA (customer contact)"
          ]
        },
        "agent": {
          "agentMode": "semi_autonomous",
          "agentRole": "specialist",
          "assertionLevel": "advisory",
          "runtime": "Managed agent runtime",
          "toolInvocation": "MCP",
          "orchestrator": "Copilot Studio",
          "hosting": "Azure",
          "knowledgeRetrieval": "rag_internal",
          "confidenceThreshold": 0.85,
          "escalationPath": "Claims Handler",
          "memoryScope": "case_scoped"
        },
        "description": "Plays the captured claim back to the policy holder for confirmation, highlights gaps or inconsistencies, and prompts for any missing mandatory information before the claim is drafted."
      },
      {
        "id": "N4",
        "name": "Prelim Policy Check",
        "stepType": "agent_task",
        "capability": "Case Review",
        "pillar": "Reshape business processes",
        "controls": {
          "authRequired": true,
          "dataSensitivity": "confidential",
          "auditLogging": true,
          "regulatoryTags": [
            "GLBA Safeguards Rule",
            "NAIC Unfair Claims Settlement Practices Act",
            "State DOI Market Conduct",
            "NAIC AI/ML Model Bulletin (2023-3)",
            "NIST AI RMF",
            "State DOI Unfair Claims Settlement Practices",
            "NAIC Market Conduct",
            "ERISA (group policies, where applicable)"
          ]
        },
        "agent": {
          "agentMode": "supervised_autonomous",
          "agentRole": "specialist",
          "assertionLevel": "signal",
          "runtime": "Managed agent runtime",
          "toolInvocation": "MCP",
          "orchestrator": "Copilot Studio",
          "hosting": "Azure",
          "knowledgeRetrieval": "rag_internal",
          "confidenceThreshold": 0.85,
          "escalationPath": "Claims Handler",
          "memoryScope": "case_scoped"
        },
        "description": "Performs a lightweight policy lookup to confirm the policy is active and the reported loss is potentially in scope, surfacing obvious coverage problems early in intake."
      },
      {
        "id": "N5",
        "name": "Identity Confirmation",
        "stepType": "agent_task",
        "capability": "Identity Verification",
        "pillar": "Reshape business processes",
        "controls": {
          "authRequired": true,
          "dataSensitivity": "confidential",
          "auditLogging": true,
          "regulatoryTags": [
            "GLBA Safeguards Rule",
            "NAIC Unfair Claims Settlement Practices Act",
            "State DOI Market Conduct",
            "NAIC AI/ML Model Bulletin (2023-3)",
            "NIST AI RMF"
          ]
        },
        "agent": {
          "agentMode": "semi_autonomous",
          "agentRole": "specialist",
          "assertionLevel": "signal",
          "runtime": "Managed agent runtime",
          "toolInvocation": "MCP",
          "orchestrator": "Copilot Studio",
          "hosting": "Azure",
          "knowledgeRetrieval": "rag_internal",
          "confidenceThreshold": 0.85,
          "escalationPath": "Claims Handler",
          "memoryScope": "case_scoped"
        },
        "description": "Verifies the claimant's identity against policy records and KYC signals before sensitive claim details are accepted, reducing impersonation and account-takeover risk."
      },
      {
        "id": "N6",
        "name": "Pre-Intake Fraud Signals",
        "stepType": "agent_task",
        "capability": "Fraud Assessment",
        "pillar": "Reshape business processes",
        "controls": {
          "authRequired": true,
          "dataSensitivity": "confidential",
          "auditLogging": true,
          "regulatoryTags": [
            "GLBA Safeguards Rule",
            "NAIC Unfair Claims Settlement Practices Act",
            "State DOI Market Conduct",
            "NAIC AI/ML Model Bulletin (2023-3)",
            "NIST AI RMF",
            "NAIC Insurance Fraud reporting",
            "State Insurance Fraud Bureau referral",
            "FCRA adverse-action reason codes",
            "ECOA / Reg B (no prohibited-basis discrimination)",
            "Colorado SB21-169 algorithmic fairness"
          ]
        },
        "agent": {
          "agentMode": "semi_autonomous",
          "agentRole": "specialist",
          "assertionLevel": "signal",
          "runtime": "Managed agent runtime",
          "toolInvocation": "MCP",
          "orchestrator": "Copilot Studio",
          "hosting": "Azure",
          "knowledgeRetrieval": "rag_internal",
          "confidenceThreshold": 0.85,
          "escalationPath": "Claims Handler",
          "memoryScope": "case_scoped"
        },
        "description": "Screens the incoming claim for early fraud indicators such as submission velocity, known-bad devices and suspicious narrative patterns so high-risk claims can be routed for closer review."
      },
      {
        "id": "N7",
        "name": "Claim Process",
        "stepType": "orchestrator",
        "capability": "Routing",
        "pillar": "Reshape business processes",
        "dataIn": [
          "Claim intake"
        ],
        "dataOut": [
          "Claim Package",
          "Claim Summary"
        ],
        "controls": {
          "authRequired": true,
          "dataSensitivity": "confidential",
          "auditLogging": true,
          "regulatoryTags": [
            "GLBA Safeguards Rule",
            "NAIC Unfair Claims Settlement Practices Act",
            "State DOI Market Conduct",
            "NAIC AI/ML Model Bulletin (2023-3)",
            "NIST AI RMF"
          ]
        },
        "agent": {
          "agentMode": "autonomous",
          "agentRole": "specialist",
          "assertionLevel": "authoritative",
          "runtime": "Managed agent runtime",
          "toolInvocation": "MCP",
          "orchestrator": "Custom Agent",
          "hosting": "Azure",
          "knowledgeRetrieval": "rag_internal",
          "confidenceThreshold": 0.85,
          "escalationPath": "Claims Handler",
          "memoryScope": "case_scoped"
        },
        "description": "Coordinates the downstream intake agents — data checks, classification and triage — to assemble a complete, validated claims package for handoff to claims handling."
      },
      {
        "id": "N8",
        "name": "1st Pass Ext Data Checks",
        "stepType": "agent_task",
        "capability": "Investigation",
        "primaryActor": "Agent",
        "controls": {
          "dataSensitivity": "pii",
          "auditLogging": true,
          "regulatoryTags": [
            "GLBA Safeguards Rule",
            "NAIC Unfair Claims Settlement Practices Act",
            "State DOI Market Conduct",
            "NAIC AI/ML Model Bulletin (2023-3)",
            "NIST AI RMF",
            "TCPA (outbound contact consent)",
            "FDCPA (recovery contact)",
            "State fair-contact rules",
            "GLBA"
          ]
        },
        "agent": {
          "agentMode": "assistive",
          "agentRole": "specialist",
          "assertionLevel": "signal",
          "runtime": "Managed agent runtime",
          "toolInvocation": "MCP",
          "orchestrator": "Custom Agent",
          "hosting": "Azure",
          "knowledgeRetrieval": "rag_internal",
          "confidenceThreshold": 0.85,
          "escalationPath": "Claims Handler",
          "memoryScope": "case_scoped"
        },
        "description": "Runs an initial pass of external data look-ups across vehicle, address, third-party and public records to corroborate the claimant's account during intake."
      },
      {
        "id": "N9",
        "name": "Type of Claim",
        "stepType": "agent_task",
        "capability": "Claim Capture",
        "primaryActor": "Agent",
        "customerImpact": "Fewer Follow Ups",
        "pillar": "Reshape business processes",
        "dataIn": [
          "Policy Information"
        ],
        "dataOut": [
          "Policy Package"
        ],
        "controls": {
          "authRequired": true,
          "dataSensitivity": "confidential",
          "auditLogging": true,
          "regulatoryTags": [
            "GLBA Safeguards Rule",
            "NAIC Unfair Claims Settlement Practices Act",
            "State DOI Market Conduct",
            "NAIC AI/ML Model Bulletin (2023-3)",
            "NIST AI RMF",
            "FTC Red Flags Rule",
            "GLBA Privacy Rule",
            "TCPA (customer contact)"
          ]
        },
        "agent": {
          "agentMode": "semi_autonomous",
          "agentRole": "specialist",
          "assertionLevel": "advisory",
          "runtime": "Managed agent runtime",
          "toolInvocation": "MCP",
          "orchestrator": "Copilot Studio",
          "hosting": "Azure",
          "knowledgeRetrieval": "rag_internal",
          "confidenceThreshold": 0.85,
          "escalationPath": "Claims Handler",
          "memoryScope": "case_scoped"
        },
        "description": "Classifies the claim by type and peril (motor collision, theft, accidental damage and so on) so it can be routed to the correct downstream specialist workflow."
      },
      {
        "id": "N10",
        "name": "Escalation",
        "stepType": "agent_task",
        "capability": "Claim Capture",
        "primaryActor": "Agent",
        "controls": {
          "authRequired": true,
          "dataSensitivity": "confidential",
          "auditLogging": true,
          "regulatoryTags": [
            "GLBA Safeguards Rule",
            "NAIC Unfair Claims Settlement Practices Act",
            "State DOI Market Conduct",
            "NAIC AI/ML Model Bulletin (2023-3)",
            "NIST AI RMF",
            "FTC Red Flags Rule",
            "GLBA Privacy Rule",
            "TCPA (customer contact)"
          ]
        },
        "agent": {
          "agentMode": "semi_autonomous",
          "agentRole": "specialist",
          "assertionLevel": "signal",
          "runtime": "Managed agent runtime",
          "toolInvocation": "MCP",
          "orchestrator": "Copilot Studio",
          "hosting": "Azure",
          "knowledgeRetrieval": "rag_internal",
          "confidenceThreshold": 0.85,
          "escalationPath": "Claims Handler",
          "memoryScope": "case_scoped"
        },
        "description": "Detects intake situations that exceed automated handling — vulnerable customers, complex losses or low-confidence cases — and escalates to a human claims handler with full context."
      },
      {
        "id": "N11",
        "name": "Human in the Loop",
        "stepType": "human_task",
        "capability": "Claim Capture",
        "primaryActor": "Claims Handler"
      }
    ],
    "edges": [
      {
        "source": "A",
        "target": "N1"
      },
      {
        "source": "N1",
        "target": "N2"
      },
      {
        "source": "N2",
        "target": "N3"
      },
      {
        "source": "N3",
        "target": "N4"
      },
      {
        "source": "N3",
        "target": "N5"
      },
      {
        "source": "N3",
        "target": "N6"
      },
      {
        "source": "N1",
        "target": "N7"
      },
      {
        "source": "N3",
        "target": "N8"
      },
      {
        "source": "N3",
        "target": "N9"
      },
      {
        "source": "N2",
        "target": "N10"
      },
      {
        "source": "N10",
        "target": "N11"
      }
    ]
  },
  "N3": {
    "parentId": "N3",
    "rootId": "S0",
    "nodes": [
      {
        "id": "S0",
        "name": "Open Mobile App",
        "stepType": "human_task",
        "primaryActor": "Human",
        "pillar": "Reshape business processes",
        "dataIn": [
          "Loss occurrence"
        ],
        "dataOut": [
          "Session start"
        ]
      },
      {
        "id": "S1",
        "name": "Mobile Intake Assistant",
        "stepType": "orchestrator",
        "capability": "Claim Capture",
        "primaryActor": "Agent",
        "pillar": "Reshape business processes",
        "controls": {
          "authRequired": true,
          "dataSensitivity": "pii",
          "auditLogging": true,
          "regulatoryTags": [
            "GLBA Safeguards Rule",
            "NAIC Unfair Claims Settlement Practices Act",
            "State DOI Market Conduct",
            "NAIC AI/ML Model Bulletin (2023-3)",
            "NIST AI RMF",
            "FTC Red Flags Rule",
            "GLBA Privacy Rule",
            "TCPA (customer contact)"
          ]
        },
        "agent": {
          "agentMode": "autonomous",
          "agentRole": "orchestrator",
          "assertionLevel": "authoritative",
          "runtime": "Managed agent runtime",
          "toolInvocation": "MCP",
          "orchestrator": "Custom Agent",
          "hosting": "Azure",
          "knowledgeRetrieval": "rag_internal",
          "confidenceThreshold": 0.85,
          "escalationPath": "Claims Handler",
          "memoryScope": "customer_scoped",
          "decisionBoundary": "Guides mobile FNOL capture and orchestrates sub-agents; cannot approve, deny, or pay.",
          "narrative": "Conversationally guides the policyholder through mobile claim capture, gathering photos, telematics and identity, then drafts the claim."
        },
        "description": "Guides policy holders through raising a claim from the mobile app, coordinating capture, identity and draft-building agents to produce a validated claim with minimal typing."
      },
      {
        "id": "S2",
        "name": "Guided Capture Agent",
        "stepType": "agent_task",
        "capability": "Claim Capture",
        "primaryActor": "Agent",
        "pillar": "Reshape business processes",
        "controls": {
          "authRequired": true,
          "dataSensitivity": "pii",
          "auditLogging": true,
          "regulatoryTags": [
            "GLBA Safeguards Rule",
            "NAIC Unfair Claims Settlement Practices Act",
            "State DOI Market Conduct",
            "NAIC AI/ML Model Bulletin (2023-3)",
            "NIST AI RMF",
            "FTC Red Flags Rule",
            "GLBA Privacy Rule",
            "TCPA (customer contact)"
          ]
        },
        "agent": {
          "agentMode": "semi_autonomous",
          "agentRole": "specialist",
          "assertionLevel": "signal",
          "runtime": "Managed agent runtime",
          "toolInvocation": "MCP",
          "orchestrator": "Copilot Studio",
          "hosting": "Azure",
          "knowledgeRetrieval": "rag_internal",
          "confidenceThreshold": 0.85,
          "escalationPath": "Claims Handler",
          "memoryScope": "case_scoped",
          "decisionBoundary": "Elicits structured claim details via guided prompts; no decision."
        },
        "description": "Leads the claimant step-by-step through a mobile-optimised intake flow, asking adaptive questions and capturing structured loss details directly on the device."
      },
      {
        "id": "S3",
        "name": "Photo / Telematics Capture Agent",
        "stepType": "agent_task",
        "capability": "Evidence Collection",
        "primaryActor": "Agent",
        "pillar": "Reshape business processes",
        "controls": {
          "authRequired": true,
          "dataSensitivity": "confidential",
          "auditLogging": true,
          "regulatoryTags": [
            "GLBA Safeguards Rule",
            "NAIC Unfair Claims Settlement Practices Act",
            "State DOI Market Conduct",
            "NAIC AI/ML Model Bulletin (2023-3)",
            "NIST AI RMF",
            "FCRA (consumer report data)",
            "GLBA Privacy Rule",
            "State records-retention statutes"
          ]
        },
        "agent": {
          "agentMode": "semi_autonomous",
          "agentRole": "specialist",
          "assertionLevel": "signal",
          "runtime": "Managed agent runtime",
          "toolInvocation": "MCP",
          "orchestrator": "Copilot Studio",
          "hosting": "Azure",
          "knowledgeRetrieval": "rag_internal",
          "confidenceThreshold": 0.85,
          "escalationPath": "Claims Handler",
          "memoryScope": "case_scoped",
          "decisionBoundary": "Captures and quality-checks images and telematics; cannot judge validity."
        },
        "description": "Captures and validates damage photos and vehicle/device telematics from the handset, checking image quality and completeness before upload."
      },
      {
        "id": "S4",
        "name": "Identity Confirmation Agent",
        "stepType": "agent_task",
        "capability": "Claim Capture",
        "primaryActor": "Agent",
        "pillar": "Reshape business processes",
        "controls": {
          "authRequired": true,
          "dataSensitivity": "pii",
          "auditLogging": true,
          "regulatoryTags": [
            "GLBA Safeguards Rule",
            "NAIC Unfair Claims Settlement Practices Act",
            "State DOI Market Conduct",
            "NAIC AI/ML Model Bulletin (2023-3)",
            "NIST AI RMF",
            "FTC Red Flags Rule",
            "GLBA Privacy Rule",
            "TCPA (customer contact)"
          ]
        },
        "agent": {
          "agentMode": "semi_autonomous",
          "agentRole": "evaluator",
          "assertionLevel": "advisory",
          "runtime": "Managed agent runtime",
          "toolInvocation": "MCP",
          "orchestrator": "Copilot Studio",
          "hosting": "Azure",
          "knowledgeRetrieval": "rag_internal",
          "confidenceThreshold": 0.85,
          "escalationPath": "Claims Handler",
          "memoryScope": "case_scoped",
          "decisionBoundary": "Confirms claimant identity on-device; gates data disclosure."
        },
        "description": "Confirms the claimant's identity on the mobile channel using policy data and device or biometric signals before the claim is submitted."
      },
      {
        "id": "S5",
        "name": "Claim Draft Builder",
        "stepType": "agent_task",
        "capability": "Claim Capture",
        "primaryActor": "Agent",
        "pillar": "Reshape business processes",
        "dataOut": [
          "Claim Package"
        ],
        "controls": {
          "authRequired": true,
          "dataSensitivity": "confidential",
          "auditLogging": true,
          "regulatoryTags": [
            "GLBA Safeguards Rule",
            "NAIC Unfair Claims Settlement Practices Act",
            "State DOI Market Conduct",
            "NAIC AI/ML Model Bulletin (2023-3)",
            "NIST AI RMF",
            "FTC Red Flags Rule",
            "GLBA Privacy Rule",
            "TCPA (customer contact)"
          ]
        },
        "agent": {
          "agentMode": "semi_autonomous",
          "agentRole": "specialist",
          "assertionLevel": "authoritative",
          "runtime": "Managed agent runtime",
          "toolInvocation": "MCP",
          "orchestrator": "Copilot Studio",
          "hosting": "Azure",
          "knowledgeRetrieval": "rag_internal",
          "confidenceThreshold": 0.85,
          "escalationPath": "Claims Handler",
          "memoryScope": "case_scoped",
          "decisionBoundary": "Assembles the draft claim package for submission; cannot decide the claim."
        },
        "description": "Assembles the captured mobile inputs into a structured draft claim, ready for review and submission into the core claims process."
      },
      {
        "id": "S6",
        "name": "Submit to Claim Worker",
        "stepType": "human_task",
        "primaryActor": "Human",
        "pillar": "Reshape business processes",
        "dataIn": [
          "Claim Package"
        ],
        "dataOut": [
          "Submitted claim"
        ]
      }
    ],
    "edges": [
      {
        "source": "S0",
        "target": "S1"
      },
      {
        "source": "S1",
        "target": "S2"
      },
      {
        "source": "S1",
        "target": "S3"
      },
      {
        "source": "S1",
        "target": "S4"
      },
      {
        "source": "S2",
        "target": "S5"
      },
      {
        "source": "S3",
        "target": "S5"
      },
      {
        "source": "S4",
        "target": "S5"
      },
      {
        "source": "S5",
        "target": "S6"
      }
    ]
  },
  "N8": {
    "parentId": "N8",
    "rootId": "S0",
    "nodes": [
      {
        "id": "S0",
        "name": "Evidence In",
        "stepType": "human_task",
        "primaryActor": "Human",
        "pillar": "Reshape business processes",
        "dataIn": [
          "Claim package",
          "Evidence documents",
          "Images"
        ],
        "dataOut": [
          "Evidence queue"
        ]
      },
      {
        "id": "S1",
        "name": "Doc Review Orchestrator",
        "stepType": "orchestrator",
        "capability": "Evidence Collection",
        "primaryActor": "Agent",
        "pillar": "Reshape business processes",
        "controls": {
          "authRequired": true,
          "dataSensitivity": "confidential",
          "auditLogging": true,
          "regulatoryTags": [
            "GLBA Safeguards Rule",
            "NAIC Unfair Claims Settlement Practices Act",
            "State DOI Market Conduct",
            "NAIC AI/ML Model Bulletin (2023-3)",
            "NIST AI RMF",
            "FCRA (consumer report data)",
            "GLBA Privacy Rule",
            "State records-retention statutes"
          ]
        },
        "agent": {
          "agentMode": "autonomous",
          "agentRole": "orchestrator",
          "assertionLevel": "advisory",
          "runtime": "Managed agent runtime",
          "toolInvocation": "MCP",
          "orchestrator": "Custom Agent",
          "hosting": "Azure",
          "knowledgeRetrieval": "rag_internal",
          "confidenceThreshold": 0.85,
          "escalationPath": "Claims Handler",
          "memoryScope": "case_scoped",
          "decisionBoundary": "Coordinates document review sub-agents; cannot determine coverage or outcome.",
          "narrative": "Routes each document through classification, extraction, authenticity and consistency checks, then gates the validated evidence."
        },
        "description": "Coordinates the document-understanding agents — classification, extraction, authenticity and consistency — to turn unstructured claim evidence into validated, structured data."
      },
      {
        "id": "S2",
        "name": "Document Classifier",
        "stepType": "agent_task",
        "capability": "Evidence Collection",
        "primaryActor": "Agent",
        "pillar": "Reshape business processes",
        "controls": {
          "authRequired": true,
          "dataSensitivity": "confidential",
          "auditLogging": true,
          "regulatoryTags": [
            "GLBA Safeguards Rule",
            "NAIC Unfair Claims Settlement Practices Act",
            "State DOI Market Conduct",
            "NAIC AI/ML Model Bulletin (2023-3)",
            "NIST AI RMF",
            "FCRA (consumer report data)",
            "GLBA Privacy Rule",
            "State records-retention statutes"
          ]
        },
        "agent": {
          "agentMode": "semi_autonomous",
          "agentRole": "evaluator",
          "assertionLevel": "signal",
          "runtime": "Managed agent runtime",
          "toolInvocation": "MCP",
          "orchestrator": "Copilot Studio",
          "hosting": "Azure",
          "knowledgeRetrieval": "rag_internal",
          "confidenceThreshold": 0.85,
          "escalationPath": "Claims Handler",
          "memoryScope": "case_scoped",
          "decisionBoundary": "Classifies document types and routes; escalates low-confidence items."
        },
        "description": "Identifies each uploaded document type (policy, invoice, police report, medical note) so the correct extraction and validation logic is applied."
      },
      {
        "id": "S3",
        "name": "Field Extraction Agent",
        "stepType": "agent_task",
        "capability": "Evidence Collection",
        "primaryActor": "Agent",
        "pillar": "Reshape business processes",
        "controls": {
          "authRequired": true,
          "dataSensitivity": "confidential",
          "auditLogging": true,
          "regulatoryTags": [
            "GLBA Safeguards Rule",
            "NAIC Unfair Claims Settlement Practices Act",
            "State DOI Market Conduct",
            "NAIC AI/ML Model Bulletin (2023-3)",
            "NIST AI RMF",
            "FCRA (consumer report data)",
            "GLBA Privacy Rule",
            "State records-retention statutes"
          ]
        },
        "agent": {
          "agentMode": "semi_autonomous",
          "agentRole": "specialist",
          "assertionLevel": "signal",
          "runtime": "Managed agent runtime",
          "toolInvocation": "MCP",
          "orchestrator": "Copilot Studio",
          "hosting": "Azure",
          "knowledgeRetrieval": "rag_internal",
          "confidenceThreshold": 0.85,
          "escalationPath": "Claims Handler",
          "memoryScope": "case_scoped",
          "decisionBoundary": "Extracts structured fields with citations; never fabricates values."
        },
        "description": "Extracts key fields and entities from classified documents — dates, amounts, parties and reference numbers — into a structured schema for downstream checks."
      },
      {
        "id": "S4",
        "name": "Image Authenticity Agent",
        "stepType": "agent_task",
        "capability": "Evidence Collection",
        "primaryActor": "Agent",
        "pillar": "Reshape business processes",
        "controls": {
          "authRequired": true,
          "dataSensitivity": "confidential",
          "auditLogging": true,
          "regulatoryTags": [
            "GLBA Safeguards Rule",
            "NAIC Unfair Claims Settlement Practices Act",
            "State DOI Market Conduct",
            "NAIC AI/ML Model Bulletin (2023-3)",
            "NIST AI RMF",
            "FCRA (consumer report data)",
            "GLBA Privacy Rule",
            "State records-retention statutes"
          ]
        },
        "agent": {
          "agentMode": "semi_autonomous",
          "agentRole": "evaluator",
          "assertionLevel": "signal",
          "runtime": "Managed agent runtime",
          "toolInvocation": "MCP",
          "orchestrator": "Copilot Studio",
          "hosting": "Azure",
          "knowledgeRetrieval": "rag_internal",
          "confidenceThreshold": 0.85,
          "escalationPath": "Claims Handler",
          "memoryScope": "case_scoped",
          "decisionBoundary": "Flags tampered or duplicate imagery; advisory to the validation gate."
        },
        "description": "Analyses submitted images for signs of tampering, reuse or manipulation, scoring their authenticity to support evidence validation."
      },
      {
        "id": "S5",
        "name": "Consistency Agent",
        "stepType": "agent_task",
        "capability": "Evidence Collection",
        "primaryActor": "Agent",
        "pillar": "Reshape business processes",
        "controls": {
          "authRequired": true,
          "dataSensitivity": "confidential",
          "auditLogging": true,
          "regulatoryTags": [
            "GLBA Safeguards Rule",
            "NAIC Unfair Claims Settlement Practices Act",
            "State DOI Market Conduct",
            "NAIC AI/ML Model Bulletin (2023-3)",
            "NIST AI RMF",
            "FCRA (consumer report data)",
            "GLBA Privacy Rule",
            "State records-retention statutes"
          ]
        },
        "agent": {
          "agentMode": "semi_autonomous",
          "agentRole": "evaluator",
          "assertionLevel": "signal",
          "runtime": "Managed agent runtime",
          "toolInvocation": "MCP",
          "orchestrator": "Copilot Studio",
          "hosting": "Azure",
          "knowledgeRetrieval": "rag_internal",
          "confidenceThreshold": 0.85,
          "escalationPath": "Claims Handler",
          "memoryScope": "case_scoped",
          "decisionBoundary": "Cross-checks fields across documents and the SOR; raises exceptions."
        },
        "description": "Cross-checks extracted data across documents and against the claim narrative to detect contradictions, duplicates or missing evidence."
      },
      {
        "id": "S6",
        "name": "Evidence Validation Gate",
        "stepType": "agent_task",
        "capability": "Evidence Collection",
        "primaryActor": "Agent",
        "pillar": "Reshape business processes",
        "dataOut": [
          "Validated evidence",
          "Exceptions list"
        ],
        "controls": {
          "authRequired": true,
          "dataSensitivity": "confidential",
          "auditLogging": true,
          "regulatoryTags": [
            "GLBA Safeguards Rule",
            "NAIC Unfair Claims Settlement Practices Act",
            "State DOI Market Conduct",
            "NAIC AI/ML Model Bulletin (2023-3)",
            "NIST AI RMF",
            "FCRA (consumer report data)",
            "GLBA Privacy Rule",
            "State records-retention statutes"
          ]
        },
        "agent": {
          "agentMode": "semi_autonomous",
          "agentRole": "evaluator",
          "assertionLevel": "authoritative",
          "runtime": "Managed agent runtime",
          "toolInvocation": "MCP",
          "orchestrator": "Copilot Studio",
          "hosting": "Azure",
          "knowledgeRetrieval": "rag_internal",
          "confidenceThreshold": 0.85,
          "escalationPath": "Claims Handler",
          "memoryScope": "case_scoped",
          "decisionBoundary": "Passes or quarantines the evidence set; cannot decide the claim."
        },
        "description": "Applies the validation rules that decide whether the assembled evidence is sufficient and trustworthy to advance the claim, or must be returned for more information."
      },
      {
        "id": "S7",
        "name": "Human Evidence QA",
        "stepType": "human_task",
        "primaryActor": "Human",
        "pillar": "Reshape business processes",
        "dataIn": [
          "Exceptions list"
        ],
        "dataOut": [
          "QA outcome"
        ]
      }
    ],
    "edges": [
      {
        "source": "S0",
        "target": "S1"
      },
      {
        "source": "S1",
        "target": "S2"
      },
      {
        "source": "S1",
        "target": "S3"
      },
      {
        "source": "S1",
        "target": "S4"
      },
      {
        "source": "S2",
        "target": "S5"
      },
      {
        "source": "S3",
        "target": "S5"
      },
      {
        "source": "S4",
        "target": "S5"
      },
      {
        "source": "S5",
        "target": "S6"
      },
      {
        "source": "S6",
        "target": "S7"
      }
    ]
  },
  "N15": {
    "parentId": "N15",
    "rootId": "S0",
    "nodes": [
      {
        "id": "S0",
        "name": "Signals In",
        "stepType": "human_task",
        "primaryActor": "Human",
        "pillar": "Reshape business processes",
        "dataIn": [
          "Claim parties",
          "Historical claims graph"
        ],
        "dataOut": [
          "Analysis request"
        ]
      },
      {
        "id": "S1",
        "name": "Network Analysis Orchestrator",
        "stepType": "orchestrator",
        "capability": "Fraud Assessment",
        "primaryActor": "Agent",
        "pillar": "Reshape business processes",
        "controls": {
          "authRequired": true,
          "dataSensitivity": "pii",
          "auditLogging": true,
          "regulatoryTags": [
            "GLBA Safeguards Rule",
            "NAIC Unfair Claims Settlement Practices Act",
            "State DOI Market Conduct",
            "NAIC AI/ML Model Bulletin (2023-3)",
            "NIST AI RMF",
            "NAIC Insurance Fraud reporting",
            "State Insurance Fraud Bureau referral",
            "FCRA adverse-action reason codes",
            "ECOA / Reg B (no prohibited-basis discrimination)",
            "Colorado SB21-169 algorithmic fairness"
          ]
        },
        "agent": {
          "agentMode": "autonomous",
          "agentRole": "orchestrator",
          "assertionLevel": "advisory",
          "runtime": "Managed agent runtime",
          "toolInvocation": "MCP",
          "orchestrator": "Custom Agent",
          "hosting": "Azure",
          "knowledgeRetrieval": "rag_internal",
          "confidenceThreshold": 0.85,
          "escalationPath": "Claims Handler",
          "memoryScope": "case_scoped",
          "decisionBoundary": "Coordinates network analytics; advisory only, never denies a claim.",
          "narrative": "Resolves entities, runs link and ring detection, then drafts an SIU referral for human review."
        },
        "description": "Coordinates entity-resolution, graph and ring-detection agents to assess whether a claim is connected to organised or networked fraud."
      },
      {
        "id": "S2",
        "name": "Entity Resolution Agent",
        "stepType": "agent_task",
        "capability": "Fraud Assessment",
        "primaryActor": "Agent",
        "pillar": "Reshape business processes",
        "controls": {
          "authRequired": true,
          "dataSensitivity": "pii",
          "auditLogging": true,
          "regulatoryTags": [
            "GLBA Safeguards Rule",
            "NAIC Unfair Claims Settlement Practices Act",
            "State DOI Market Conduct",
            "NAIC AI/ML Model Bulletin (2023-3)",
            "NIST AI RMF",
            "NAIC Insurance Fraud reporting",
            "State Insurance Fraud Bureau referral",
            "FCRA adverse-action reason codes",
            "ECOA / Reg B (no prohibited-basis discrimination)",
            "Colorado SB21-169 algorithmic fairness"
          ]
        },
        "agent": {
          "agentMode": "semi_autonomous",
          "agentRole": "specialist",
          "assertionLevel": "signal",
          "runtime": "Managed agent runtime",
          "toolInvocation": "MCP",
          "orchestrator": "Copilot Studio",
          "hosting": "Azure",
          "knowledgeRetrieval": "rag_internal",
          "confidenceThreshold": 0.85,
          "escalationPath": "Claims Handler",
          "memoryScope": "case_scoped",
          "decisionBoundary": "Resolves parties to canonical entities; advisory."
        },
        "description": "Resolves claimants, vehicles, addresses and counterparties to canonical entities, linking records that refer to the same real-world party."
      },
      {
        "id": "S3",
        "name": "Link / Graph Analysis Agent",
        "stepType": "agent_task",
        "capability": "Fraud Assessment",
        "primaryActor": "Agent",
        "pillar": "Reshape business processes",
        "controls": {
          "authRequired": true,
          "dataSensitivity": "confidential",
          "auditLogging": true,
          "regulatoryTags": [
            "GLBA Safeguards Rule",
            "NAIC Unfair Claims Settlement Practices Act",
            "State DOI Market Conduct",
            "NAIC AI/ML Model Bulletin (2023-3)",
            "NIST AI RMF",
            "NAIC Insurance Fraud reporting",
            "State Insurance Fraud Bureau referral",
            "FCRA adverse-action reason codes",
            "ECOA / Reg B (no prohibited-basis discrimination)",
            "Colorado SB21-169 algorithmic fairness"
          ]
        },
        "agent": {
          "agentMode": "semi_autonomous",
          "agentRole": "specialist",
          "assertionLevel": "signal",
          "runtime": "Managed agent runtime",
          "toolInvocation": "MCP",
          "orchestrator": "Copilot Studio",
          "hosting": "Azure",
          "knowledgeRetrieval": "rag_internal",
          "confidenceThreshold": 0.85,
          "escalationPath": "Claims Handler",
          "memoryScope": "case_scoped",
          "decisionBoundary": "Computes graph links and centrality; advisory signals only."
        },
        "description": "Builds and analyses the relationship graph around the claim to surface suspicious connections between parties, claims and assets."
      },
      {
        "id": "S4",
        "name": "Ring Detection Agent",
        "stepType": "agent_task",
        "capability": "Fraud Assessment",
        "primaryActor": "Agent",
        "pillar": "Reshape business processes",
        "controls": {
          "authRequired": true,
          "dataSensitivity": "confidential",
          "auditLogging": true,
          "regulatoryTags": [
            "GLBA Safeguards Rule",
            "NAIC Unfair Claims Settlement Practices Act",
            "State DOI Market Conduct",
            "NAIC AI/ML Model Bulletin (2023-3)",
            "NIST AI RMF",
            "NAIC Insurance Fraud reporting",
            "State Insurance Fraud Bureau referral",
            "FCRA adverse-action reason codes",
            "ECOA / Reg B (no prohibited-basis discrimination)",
            "Colorado SB21-169 algorithmic fairness"
          ]
        },
        "agent": {
          "agentMode": "semi_autonomous",
          "agentRole": "evaluator",
          "assertionLevel": "signal",
          "runtime": "Managed agent runtime",
          "toolInvocation": "MCP",
          "orchestrator": "Copilot Studio",
          "hosting": "Azure",
          "knowledgeRetrieval": "rag_internal",
          "confidenceThreshold": 0.85,
          "escalationPath": "Claims Handler",
          "memoryScope": "case_scoped",
          "decisionBoundary": "Identifies probable organised-fraud rings; advisory."
        },
        "description": "Detects coordinated fraud rings by identifying dense or repeating patterns of shared entities across multiple claims."
      },
      {
        "id": "S5",
        "name": "SIU Referral Drafter",
        "stepType": "agent_task",
        "capability": "Fraud Assessment",
        "primaryActor": "Agent",
        "pillar": "Reshape business processes",
        "dataOut": [
          "Network links",
          "Ring indicators",
          "Draft SIU referral"
        ],
        "controls": {
          "authRequired": true,
          "dataSensitivity": "confidential",
          "auditLogging": true,
          "regulatoryTags": [
            "GLBA Safeguards Rule",
            "NAIC Unfair Claims Settlement Practices Act",
            "State DOI Market Conduct",
            "NAIC AI/ML Model Bulletin (2023-3)",
            "NIST AI RMF",
            "NAIC Insurance Fraud reporting",
            "State Insurance Fraud Bureau referral",
            "FCRA adverse-action reason codes",
            "ECOA / Reg B (no prohibited-basis discrimination)",
            "Colorado SB21-169 algorithmic fairness"
          ]
        },
        "agent": {
          "agentMode": "semi_autonomous",
          "agentRole": "specialist",
          "assertionLevel": "advisory",
          "runtime": "Managed agent runtime",
          "toolInvocation": "MCP",
          "orchestrator": "Copilot Studio",
          "hosting": "Azure",
          "knowledgeRetrieval": "rag_internal",
          "confidenceThreshold": 0.85,
          "escalationPath": "Claims Handler",
          "memoryScope": "case_scoped",
          "decisionBoundary": "Drafts an SIU referral with reason codes; a human approves the referral."
        },
        "description": "Drafts a Special Investigations Unit referral with the supporting network evidence when organised-fraud indicators exceed threshold."
      },
      {
        "id": "S6",
        "name": "SIU Investigator Handoff",
        "stepType": "human_task",
        "primaryActor": "Human",
        "pillar": "Reshape business processes",
        "dataIn": [
          "Draft SIU referral"
        ],
        "dataOut": [
          "Referral decision"
        ]
      }
    ],
    "edges": [
      {
        "source": "S0",
        "target": "S1"
      },
      {
        "source": "S1",
        "target": "S2"
      },
      {
        "source": "S1",
        "target": "S3"
      },
      {
        "source": "S1",
        "target": "S4"
      },
      {
        "source": "S2",
        "target": "S5"
      },
      {
        "source": "S3",
        "target": "S5"
      },
      {
        "source": "S4",
        "target": "S5"
      },
      {
        "source": "S5",
        "target": "S6"
      }
    ]
  },
  "N20": {
    "parentId": "N20",
    "rootId": "S0",
    "nodes": [
      {
        "id": "S0",
        "name": "Case In",
        "stepType": "human_task",
        "primaryActor": "Human",
        "pillar": "Reshape business processes",
        "dataIn": [
          "Policy reference",
          "Claim context"
        ],
        "dataOut": [
          "Review request"
        ]
      },
      {
        "id": "S1",
        "name": "Policy Review Orchestrator",
        "stepType": "orchestrator",
        "capability": "Case Review",
        "primaryActor": "Agent",
        "pillar": "Reshape business processes",
        "controls": {
          "authRequired": true,
          "dataSensitivity": "confidential",
          "auditLogging": true,
          "regulatoryTags": [
            "GLBA Safeguards Rule",
            "NAIC Unfair Claims Settlement Practices Act",
            "State DOI Market Conduct",
            "NAIC AI/ML Model Bulletin (2023-3)",
            "NIST AI RMF",
            "State DOI Unfair Claims Settlement Practices",
            "NAIC Market Conduct",
            "ERISA (group policies, where applicable)"
          ]
        },
        "agent": {
          "agentMode": "autonomous",
          "agentRole": "orchestrator",
          "assertionLevel": "advisory",
          "runtime": "Managed agent runtime",
          "toolInvocation": "MCP",
          "orchestrator": "Custom Agent",
          "hosting": "Azure",
          "knowledgeRetrieval": "rag_internal",
          "confidenceThreshold": 0.85,
          "escalationPath": "Claims Handler",
          "memoryScope": "case_scoped",
          "decisionBoundary": "Coordinates coverage review; final denials and limits require human adjuster approval.",
          "narrative": "Looks up coverage, applies clause reasoning and exclusions, then produces an explained recommendation for adjuster approval."
        },
        "description": "Coordinates coverage-lookup, clause-reasoning and exclusion agents to determine whether and how the policy responds to the loss."
      },
      {
        "id": "S2",
        "name": "Coverage Lookup Agent",
        "stepType": "agent_task",
        "capability": "Case Review",
        "primaryActor": "Agent",
        "pillar": "Reshape business processes",
        "controls": {
          "authRequired": true,
          "dataSensitivity": "confidential",
          "auditLogging": true,
          "regulatoryTags": [
            "GLBA Safeguards Rule",
            "NAIC Unfair Claims Settlement Practices Act",
            "State DOI Market Conduct",
            "NAIC AI/ML Model Bulletin (2023-3)",
            "NIST AI RMF",
            "State DOI Unfair Claims Settlement Practices",
            "NAIC Market Conduct",
            "ERISA (group policies, where applicable)"
          ]
        },
        "agent": {
          "agentMode": "semi_autonomous",
          "agentRole": "specialist",
          "assertionLevel": "signal",
          "runtime": "Managed agent runtime",
          "toolInvocation": "MCP",
          "orchestrator": "Copilot Studio",
          "hosting": "Azure",
          "knowledgeRetrieval": "rag_internal",
          "confidenceThreshold": 0.85,
          "escalationPath": "Claims Handler",
          "memoryScope": "case_scoped",
          "decisionBoundary": "Retrieves applicable coverage and limits; no decision."
        },
        "description": "Retrieves the applicable policy, sections, limits and endorsements that were in force at the date of loss for the claim under review."
      },
      {
        "id": "S3",
        "name": "Clause Reasoning Agent",
        "stepType": "agent_task",
        "capability": "Case Review",
        "primaryActor": "Agent",
        "pillar": "Reshape business processes",
        "controls": {
          "authRequired": true,
          "dataSensitivity": "confidential",
          "auditLogging": true,
          "regulatoryTags": [
            "GLBA Safeguards Rule",
            "NAIC Unfair Claims Settlement Practices Act",
            "State DOI Market Conduct",
            "NAIC AI/ML Model Bulletin (2023-3)",
            "NIST AI RMF",
            "State DOI Unfair Claims Settlement Practices",
            "NAIC Market Conduct",
            "ERISA (group policies, where applicable)"
          ]
        },
        "agent": {
          "agentMode": "semi_autonomous",
          "agentRole": "specialist",
          "assertionLevel": "signal",
          "runtime": "Managed agent runtime",
          "toolInvocation": "MCP",
          "orchestrator": "Copilot Studio",
          "hosting": "Azure",
          "knowledgeRetrieval": "rag_internal",
          "confidenceThreshold": 0.85,
          "escalationPath": "Claims Handler",
          "memoryScope": "case_scoped",
          "decisionBoundary": "Applies policy clauses to the facts; advisory reasoned position."
        },
        "description": "Interprets policy wording against the facts of the claim to assess whether the loss is covered and to what extent."
      },
      {
        "id": "S4",
        "name": "Exclusions & Endorsements Agent",
        "stepType": "agent_task",
        "capability": "Case Review",
        "primaryActor": "Agent",
        "pillar": "Reshape business processes",
        "controls": {
          "authRequired": true,
          "dataSensitivity": "confidential",
          "auditLogging": true,
          "regulatoryTags": [
            "GLBA Safeguards Rule",
            "NAIC Unfair Claims Settlement Practices Act",
            "State DOI Market Conduct",
            "NAIC AI/ML Model Bulletin (2023-3)",
            "NIST AI RMF",
            "State DOI Unfair Claims Settlement Practices",
            "NAIC Market Conduct",
            "ERISA (group policies, where applicable)"
          ]
        },
        "agent": {
          "agentMode": "semi_autonomous",
          "agentRole": "evaluator",
          "assertionLevel": "signal",
          "runtime": "Managed agent runtime",
          "toolInvocation": "MCP",
          "orchestrator": "Copilot Studio",
          "hosting": "Azure",
          "knowledgeRetrieval": "rag_internal",
          "confidenceThreshold": 0.85,
          "escalationPath": "Claims Handler",
          "memoryScope": "case_scoped",
          "decisionBoundary": "Checks exclusions and endorsements; flags coverage-limiting factors."
        },
        "description": "Checks the claim against policy exclusions, conditions and endorsements that could reduce, extend or void cover."
      },
      {
        "id": "S5",
        "name": "Coverage Decision Explainer",
        "stepType": "agent_task",
        "capability": "Case Review",
        "primaryActor": "Agent",
        "pillar": "Reshape business processes",
        "dataOut": [
          "Coverage recommendation",
          "Rationale"
        ],
        "controls": {
          "authRequired": true,
          "dataSensitivity": "confidential",
          "auditLogging": true,
          "regulatoryTags": [
            "GLBA Safeguards Rule",
            "NAIC Unfair Claims Settlement Practices Act",
            "State DOI Market Conduct",
            "NAIC AI/ML Model Bulletin (2023-3)",
            "NIST AI RMF",
            "State DOI Unfair Claims Settlement Practices",
            "NAIC Market Conduct",
            "ERISA (group policies, where applicable)"
          ]
        },
        "agent": {
          "agentMode": "semi_autonomous",
          "agentRole": "explainer",
          "assertionLevel": "advisory",
          "runtime": "Managed agent runtime",
          "toolInvocation": "MCP",
          "orchestrator": "Copilot Studio",
          "hosting": "Azure",
          "knowledgeRetrieval": "rag_internal",
          "confidenceThreshold": 0.85,
          "escalationPath": "Claims Handler",
          "memoryScope": "case_scoped",
          "decisionBoundary": "Generates a plain-language, reproducible rationale; no decision authority."
        },
        "description": "Produces a clear, auditable explanation of the coverage decision, citing the specific clauses and facts relied upon."
      },
      {
        "id": "S6",
        "name": "Adjuster Approval",
        "stepType": "human_task",
        "primaryActor": "Human",
        "pillar": "Reshape business processes",
        "dataIn": [
          "Coverage recommendation",
          "Rationale"
        ],
        "dataOut": [
          "Coverage determination"
        ]
      }
    ],
    "edges": [
      {
        "source": "S0",
        "target": "S1"
      },
      {
        "source": "S1",
        "target": "S2"
      },
      {
        "source": "S1",
        "target": "S3"
      },
      {
        "source": "S1",
        "target": "S4"
      },
      {
        "source": "S2",
        "target": "S5"
      },
      {
        "source": "S3",
        "target": "S5"
      },
      {
        "source": "S4",
        "target": "S5"
      },
      {
        "source": "S5",
        "target": "S6"
      }
    ]
  },
  "N19": {
    "parentId": "N19",
    "rootId": "A",
    "nodes": [
      {
        "id": "A",
        "name": "Data Validation",
        "stepType": "agent_task",
        "capability": "Evidence Collection",
        "primaryActor": "Agent",
        "pillar": "Reshape business processes",
        "controls": {
          "authRequired": true,
          "dataSensitivity": "confidential",
          "auditLogging": true,
          "regulatoryTags": [
            "GLBA Safeguards Rule",
            "NAIC Unfair Claims Settlement Practices Act",
            "State DOI Market Conduct",
            "NAIC AI/ML Model Bulletin (2023-3)",
            "NIST AI RMF",
            "FCRA (consumer report data)",
            "GLBA Privacy Rule",
            "State records-retention statutes"
          ]
        },
        "agent": {
          "agentMode": "semi_autonomous",
          "agentRole": "specialist",
          "assertionLevel": "signal",
          "runtime": "Managed agent runtime",
          "toolInvocation": "MCP",
          "orchestrator": "Copilot Studio",
          "hosting": "Azure",
          "knowledgeRetrieval": "other",
          "confidenceThreshold": 0.85,
          "escalationPath": "Claims Handler",
          "memoryScope": "case_scoped"
        },
        "description": "Validates the completeness, format and integrity of incoming claim data against schema and business rules before it is used downstream."
      },
      {
        "id": "N1",
        "name": "New Node",
        "stepType": "human_task"
      }
    ],
    "edges": [
      {
        "source": "A",
        "target": "N1"
      }
    ]
  },
  "N7": {
    "parentId": "N7",
    "rootId": "S0",
    "nodes": [
      {
        "id": "S0",
        "name": "Claim Received",
        "stepType": "human_task",
        "primaryActor": "Human",
        "pillar": "Reshape business processes",
        "dataIn": ["Structured claim record", "FNOL submission", "Customer identity"],
        "dataOut": ["Validated claim record"],
        "description": "Structured claim record arrives from the intake channel. The Claim Digital Worker takes ownership and begins coordinating the downstream processing pipeline."
      },
      {
        "id": "S1",
        "name": "Claim Digital Worker",
        "stepType": "orchestrator",
        "capability": "Claims Processing",
        "primaryActor": "Agent",
        "pillar": "Reshape business processes",
        "controls": {
          "authRequired": true,
          "dataSensitivity": "confidential",
          "auditLogging": true,
          "regulatoryTags": ["NAIC Unfair Claims Settlement Practices Act", "State DOI Market Conduct", "NAIC AI/ML Model Bulletin (2023-3)", "NIST AI RMF", "GLBA Safeguards Rule", "GLBA Privacy Rule"]
        },
        "agent": {
          "agentMode": "autonomous",
          "agentRole": "orchestrator",
          "assertionLevel": "authoritative",
          "runtime": "Managed agent runtime",
          "toolInvocation": "MCP",
          "orchestrator": "Custom Agent",
          "hosting": "Azure",
          "knowledgeRetrieval": "case_history",
          "confidenceThreshold": 0.85,
          "escalationPath": "Claims Handler",
          "memoryScope": "case_scoped",
          "decisionBoundary": "Orchestrates all post-intake digital workers; may not approve coverage, deny a claim, or authorise payment.",
          "narrative": "Receives the structured claim record from any intake channel and coordinates the full processing pipeline: Doc Review, Fraud, Policy, Settlement, and Compliance oversight."
        },
        "description": "Entry point for post-intake claims processing. Coordinates Doc Review, Fraud, Policy and Settlement digital workers in sequence, with Compliance running alongside the whole pipeline."
      },
      {
        "id": "S2",
        "name": "Doc Review Digital Worker",
        "stepType": "orchestrator",
        "capability": "Evidence Collection",
        "primaryActor": "Agent",
        "pillar": "Reshape business processes",
        "dataIn": ["Claim record", "Submitted documents", "Photographic evidence"],
        "dataOut": ["Validated evidence", "Extracted data"],
        "controls": {
          "authRequired": true,
          "dataSensitivity": "confidential",
          "auditLogging": true,
          "regulatoryTags": ["NAIC Unfair Claims Settlement Practices Act", "FCRA (consumer report data)", "State records-retention statutes", "GLBA Privacy Rule"]
        },
        "agent": {
          "agentMode": "autonomous",
          "agentRole": "orchestrator",
          "assertionLevel": "advisory",
          "runtime": "Managed agent runtime",
          "toolInvocation": "MCP",
          "orchestrator": "Custom Agent",
          "hosting": "Azure",
          "knowledgeRetrieval": "rag_internal",
          "confidenceThreshold": 0.80,
          "escalationPath": "Claims Handler",
          "memoryScope": "case_scoped",
          "decisionBoundary": "Classifies, extracts and validates documents. Routes low-confidence cases to human review. Cannot make coverage or liability decisions."
        },
        "description": "Ingests and understands submitted documents and evidence. Classifies, extracts and validates data, routing low-confidence cases to a human reviewer."
      },
      {
        "id": "S3",
        "name": "Fraud Digital Worker",
        "stepType": "orchestrator",
        "capability": "Fraud Assessment",
        "primaryActor": "Agent",
        "pillar": "Reshape business processes",
        "dataIn": ["Validated evidence", "Extracted data"],
        "dataOut": ["Fraud ranking", "Risk signals"],
        "controls": {
          "authRequired": true,
          "dataSensitivity": "confidential",
          "auditLogging": true,
          "regulatoryTags": ["NAIC Unfair Claims Settlement Practices Act", "FTC Red Flags Rule", "NIST AI RMF", "NAIC AI/ML Model Bulletin (2023-3)"]
        },
        "agent": {
          "agentMode": "autonomous",
          "agentRole": "evaluator",
          "assertionLevel": "advisory",
          "runtime": "Managed agent runtime",
          "toolInvocation": "MCP",
          "orchestrator": "Custom Agent",
          "hosting": "Azure",
          "knowledgeRetrieval": "rag_internal",
          "confidenceThreshold": 0.85,
          "escalationPath": "Fraud Investigation Team",
          "memoryScope": "case_scoped",
          "decisionBoundary": "Assesses fraud risk using rules, scoring, network analysis and external data. High-risk cases escalate to investigation. Cannot deny a claim."
        },
        "description": "Assesses fraud risk using rules, scoring, network analysis and external data, then ranks the claim. High-risk cases escalate to a deep fraud review or full investigation."
      },
      {
        "id": "S4",
        "name": "Policy Digital Worker",
        "stepType": "orchestrator",
        "capability": "Policy Review",
        "primaryActor": "Agent",
        "pillar": "Reshape business processes",
        "dataIn": ["Fraud ranking", "Risk signals", "Claim record"],
        "dataOut": ["Coverage decision", "Rationale"],
        "controls": {
          "authRequired": true,
          "dataSensitivity": "confidential",
          "auditLogging": true,
          "regulatoryTags": ["NAIC Unfair Claims Settlement Practices Act", "State DOI Market Conduct", "ERISA (group policies, where applicable)", "NAIC AI/ML Model Bulletin (2023-3)"]
        },
        "agent": {
          "agentMode": "autonomous",
          "agentRole": "evaluator",
          "assertionLevel": "authoritative",
          "runtime": "Managed agent runtime",
          "toolInvocation": "MCP",
          "orchestrator": "Custom Agent",
          "hosting": "Azure",
          "knowledgeRetrieval": "rag_internal",
          "confidenceThreshold": 0.85,
          "escalationPath": "Senior Adjuster",
          "memoryScope": "case_scoped",
          "decisionBoundary": "Determines coverage against the policy and produces an explainable decision. Ambiguous cases escalate. Cannot authorise payment."
        },
        "description": "Determines coverage against the policy, reasons about applicability and produces an explainable decision. Ambiguous cases escalate; claimants are kept informed."
      },
      {
        "id": "S5",
        "name": "Settlement Digital Worker",
        "stepType": "orchestrator",
        "capability": "Settlement",
        "primaryActor": "Agent",
        "pillar": "Reshape business processes",
        "dataIn": ["Coverage decision", "Rationale"],
        "dataOut": ["Paid and closed claim"],
        "controls": {
          "authRequired": true,
          "dataSensitivity": "confidential",
          "auditLogging": true,
          "regulatoryTags": ["NAIC Unfair Claims Settlement Practices Act", "Sanctions / AML regulations", "State DOI Market Conduct", "GLBA Safeguards Rule"]
        },
        "agent": {
          "agentMode": "autonomous",
          "agentRole": "specialist",
          "assertionLevel": "authoritative",
          "runtime": "Managed agent runtime",
          "toolInvocation": "MCP",
          "orchestrator": "Custom Agent",
          "hosting": "Azure",
          "knowledgeRetrieval": "case_history",
          "confidenceThreshold": 0.90,
          "escalationPath": "Claims Handler",
          "memoryScope": "case_scoped",
          "decisionBoundary": "Calculates settlement, runs sanctions/AML checks, makes payment and closes the claim. Negotiation is handled by a human where required."
        },
        "description": "Calculates the settlement, runs sanctions/AML checks, makes payment and closes the claim. Negotiation is handled by a human where required."
      },
      {
        "id": "S6",
        "name": "Compliance Agent",
        "stepType": "agent_task",
        "capability": "Compliance",
        "primaryActor": "Agent",
        "pillar": "Reshape business processes",
        "controls": {
          "authRequired": true,
          "dataSensitivity": "confidential",
          "auditLogging": true,
          "regulatoryTags": ["NAIC Model Audit Rule", "State DOI Market Conduct Annual Statement", "SOX 404 (if publicly held)", "NIST AI RMF", "Records-retention statutes"]
        },
        "agent": {
          "agentMode": "autonomous",
          "agentRole": "auditor",
          "assertionLevel": "advisory",
          "runtime": "Managed agent runtime",
          "toolInvocation": "MCP",
          "orchestrator": "Custom Agent",
          "hosting": "Azure",
          "knowledgeRetrieval": "rag_internal",
          "confidenceThreshold": 0.85,
          "escalationPath": "Compliance Officer",
          "memoryScope": "stateless",
          "decisionBoundary": "Cross-cutting oversight only. Captures telemetry, detects anomalies, samples cases and builds evidence packs. Cannot modify claims or decisions."
        },
        "description": "Cross-cutting oversight running alongside the whole process. Captures telemetry, detects anomalies, samples cases, builds evidence packs and feeds improvements back in."
      },
      {
        "id": "S7",
        "name": "Claim Closed",
        "stepType": "human_task",
        "primaryActor": "Human",
        "pillar": "Reshape business processes",
        "dataIn": ["Paid and closed claim", "Compliance oversight"],
        "dataOut": ["Closed claim record", "Audit trail"],
        "description": "Claim is fully processed, paid (where applicable) and closed. Audit trail and compliance evidence pack are archived."
      },
      {
        "id": "S8",
        "name": "Investigation Agent",
        "stepType": "agent_task",
        "capability": "Fraud Assessment",
        "primaryActor": "Agent",
        "pillar": "Reshape business processes",
        "dataIn": ["Fraud ranking", "High-risk signals", "Case file"],
        "dataOut": ["Investigation findings", "Recommended action"],
        "controls": {
          "authRequired": true,
          "dataSensitivity": "confidential",
          "auditLogging": true,
          "regulatoryTags": ["NAIC Insurance Fraud Reporting", "State Insurance Fraud Bureau referral", "FCRA adverse-action reason codes", "NIST AI RMF"]
        },
        "agent": {
          "agentMode": "semi_autonomous",
          "agentRole": "investigator",
          "assertionLevel": "advisory",
          "runtime": "Managed agent runtime",
          "toolInvocation": "MCP",
          "orchestrator": "Custom Agent",
          "hosting": "Azure",
          "knowledgeRetrieval": "rag_internal",
          "confidenceThreshold": 0.90,
          "escalationPath": "Fraud Investigation Team",
          "memoryScope": "case_scoped",
          "decisionBoundary": "Conducts deeper investigation on high-risk claims. Cannot close or deny a claim unilaterally; must escalate findings."
        },
        "description": "Triggered for high-risk claims flagged by the Fraud Digital Worker. Conducts deeper investigation, gathers additional evidence and third-party data, and produces findings for the outreach step."
      },
      {
        "id": "S9",
        "name": "Outreach Agent",
        "stepType": "agent_task",
        "capability": "Compliance",
        "primaryActor": "Agent",
        "pillar": "Reshape business processes",
        "dataIn": ["Investigation findings", "Recommended action"],
        "dataOut": ["Claimant notification", "Case closure record"],
        "controls": {
          "authRequired": true,
          "dataSensitivity": "confidential",
          "auditLogging": true,
          "regulatoryTags": ["NAIC Unfair Claims Settlement Practices Act", "TCPA (customer contact)", "GLBA Privacy Rule", "State DOI Market Conduct"]
        },
        "agent": {
          "agentMode": "semi_autonomous",
          "agentRole": "communicator",
          "assertionLevel": "advisory",
          "runtime": "Managed agent runtime",
          "toolInvocation": "MCP",
          "orchestrator": "Custom Agent",
          "hosting": "Azure",
          "knowledgeRetrieval": "case_history",
          "confidenceThreshold": 0.85,
          "escalationPath": "Claims Handler",
          "memoryScope": "case_scoped",
          "decisionBoundary": "Contacts the claimant with investigation findings and next steps. Cannot make a final claim decision."
        },
        "description": "Communicates investigation findings and next steps to the claimant. Ensures regulatory notification requirements are met and records all outreach for audit."
      }
    ],
    "edges": [
      { "source": "S0", "target": "S1" },
      { "source": "S1", "target": "S2" },
      { "source": "S1", "target": "S6" },
      { "source": "S2", "target": "S3" },
      { "source": "S3", "target": "S4", "label": "Low risk" },
      { "source": "S3", "target": "S8", "label": "High risk / fraud suspected" },
      { "source": "S4", "target": "S5" },
      { "source": "S5", "target": "S7" },
      { "source": "S6", "target": "S7" },
      { "source": "S8", "target": "S9" },
      { "source": "S8", "target": "S4", "label": "Investigation cleared" },
      { "source": "S9", "target": "S7" }
    ]
  },
"N22": {
    "parentId": "N22",
    "rootId": "S0",
    "nodes": [
      {
        "id": "S0",
        "name": "Closed Claim In",
        "stepType": "human_task",
        "primaryActor": "Human",
        "pillar": "Reshape business processes",
        "dataIn": [
          "Closed claim",
          "Decision trail"
        ],
        "dataOut": [
          "Review queue"
        ]
      },
      {
        "id": "S1",
        "name": "Compliance Orchestrator",
        "stepType": "orchestrator",
        "capability": "Compliance",
        "primaryActor": "Agent",
        "pillar": "Reshape business processes",
        "controls": {
          "authRequired": true,
          "dataSensitivity": "confidential",
          "auditLogging": true,
          "regulatoryTags": [
            "GLBA Safeguards Rule",
            "NAIC Unfair Claims Settlement Practices Act",
            "State DOI Market Conduct",
            "NAIC AI/ML Model Bulletin (2023-3)",
            "NIST AI RMF",
            "NAIC Model Audit Rule",
            "State DOI Market Conduct Annual Statement",
            "SOX 404 (if publicly held)",
            "Records-retention statutes"
          ]
        },
        "agent": {
          "agentMode": "autonomous",
          "agentRole": "orchestrator",
          "assertionLevel": "authoritative",
          "runtime": "Managed agent runtime",
          "toolInvocation": "MCP",
          "orchestrator": "Custom Agent",
          "hosting": "Azure",
          "knowledgeRetrieval": "rag_internal",
          "confidenceThreshold": 0.85,
          "escalationPath": "Claims Handler",
          "memoryScope": "stateless",
          "decisionBoundary": "Coordinates read-only post-closure review; cannot modify claims; escalates findings.",
          "narrative": "Runs control-conformance, regulatory mapping, bias monitoring and evidence assembly over closed claims, then routes findings to the Compliance Officer."
        },
        "description": "Coordinates the controls, regulatory-mapping, fairness and audit agents to ensure each automated decision is compliant and fully evidenced."
      },
      {
        "id": "S2",
        "name": "Control Conformance Agent",
        "stepType": "agent_task",
        "capability": "Compliance",
        "primaryActor": "Agent",
        "pillar": "Reshape business processes",
        "controls": {
          "authRequired": true,
          "dataSensitivity": "confidential",
          "auditLogging": true,
          "regulatoryTags": [
            "GLBA Safeguards Rule",
            "NAIC Unfair Claims Settlement Practices Act",
            "State DOI Market Conduct",
            "NAIC AI/ML Model Bulletin (2023-3)",
            "NIST AI RMF",
            "NAIC Model Audit Rule",
            "State DOI Market Conduct Annual Statement",
            "SOX 404 (if publicly held)",
            "Records-retention statutes"
          ]
        },
        "agent": {
          "agentMode": "semi_autonomous",
          "agentRole": "evaluator",
          "assertionLevel": "signal",
          "runtime": "Managed agent runtime",
          "toolInvocation": "MCP",
          "orchestrator": "Copilot Studio",
          "hosting": "Azure",
          "knowledgeRetrieval": "rag_internal",
          "confidenceThreshold": 0.85,
          "escalationPath": "Claims Handler",
          "memoryScope": "case_scoped",
          "decisionBoundary": "Tests operational controls against the catalog; flags gaps, no remediation."
        },
        "description": "Checks that the required operational and data-handling controls were applied at each step of the claim's processing."
      },
      {
        "id": "S3",
        "name": "Regulatory Mapping Agent",
        "stepType": "agent_task",
        "capability": "Compliance",
        "primaryActor": "Agent",
        "pillar": "Reshape business processes",
        "controls": {
          "authRequired": true,
          "dataSensitivity": "confidential",
          "auditLogging": true,
          "regulatoryTags": [
            "GLBA Safeguards Rule",
            "NAIC Unfair Claims Settlement Practices Act",
            "State DOI Market Conduct",
            "NAIC AI/ML Model Bulletin (2023-3)",
            "NIST AI RMF",
            "NAIC Model Audit Rule",
            "State DOI Market Conduct Annual Statement",
            "SOX 404 (if publicly held)",
            "Records-retention statutes"
          ]
        },
        "agent": {
          "agentMode": "semi_autonomous",
          "agentRole": "specialist",
          "assertionLevel": "signal",
          "runtime": "Managed agent runtime",
          "toolInvocation": "MCP",
          "orchestrator": "Copilot Studio",
          "hosting": "Azure",
          "knowledgeRetrieval": "rag_internal",
          "confidenceThreshold": 0.85,
          "escalationPath": "Claims Handler",
          "memoryScope": "case_scoped",
          "decisionBoundary": "Maps decisions to applicable regulations; advisory."
        },
        "description": "Maps the claim's processing and decisions to the applicable regulations and reporting obligations."
      },
      {
        "id": "S4",
        "name": "Bias & Fairness Monitor",
        "stepType": "agent_task",
        "capability": "Compliance",
        "primaryActor": "Agent",
        "pillar": "Reshape business processes",
        "controls": {
          "authRequired": true,
          "dataSensitivity": "confidential",
          "auditLogging": true,
          "regulatoryTags": [
            "GLBA Safeguards Rule",
            "NAIC Unfair Claims Settlement Practices Act",
            "State DOI Market Conduct",
            "NAIC AI/ML Model Bulletin (2023-3)",
            "NIST AI RMF",
            "NAIC Model Audit Rule",
            "State DOI Market Conduct Annual Statement",
            "SOX 404 (if publicly held)",
            "Records-retention statutes",
            "Colorado SB21-169 algorithmic fairness",
            "ECOA / Reg B (no prohibited-basis discrimination)"
          ]
        },
        "agent": {
          "agentMode": "semi_autonomous",
          "agentRole": "evaluator",
          "assertionLevel": "signal",
          "runtime": "Managed agent runtime",
          "toolInvocation": "MCP",
          "orchestrator": "Copilot Studio",
          "hosting": "Azure",
          "knowledgeRetrieval": "rag_internal",
          "confidenceThreshold": 0.85,
          "escalationPath": "Claims Handler",
          "memoryScope": "case_scoped",
          "decisionBoundary": "Monitors AI decisions for disparate impact; raises fairness alerts."
        },
        "description": "Monitors automated decisions for bias and disparate impact across protected groups, flagging outcomes that need human review."
      },
      {
        "id": "S5",
        "name": "Audit Evidence Assembler",
        "stepType": "agent_task",
        "capability": "Compliance",
        "primaryActor": "Agent",
        "pillar": "Reshape business processes",
        "dataOut": [
          "Compliance findings",
          "Audit evidence pack"
        ],
        "controls": {
          "authRequired": true,
          "dataSensitivity": "confidential",
          "auditLogging": true,
          "regulatoryTags": [
            "GLBA Safeguards Rule",
            "NAIC Unfair Claims Settlement Practices Act",
            "State DOI Market Conduct",
            "NAIC AI/ML Model Bulletin (2023-3)",
            "NIST AI RMF",
            "NAIC Model Audit Rule",
            "State DOI Market Conduct Annual Statement",
            "SOX 404 (if publicly held)",
            "Records-retention statutes"
          ]
        },
        "agent": {
          "agentMode": "semi_autonomous",
          "agentRole": "specialist",
          "assertionLevel": "authoritative",
          "runtime": "Managed agent runtime",
          "toolInvocation": "MCP",
          "orchestrator": "Copilot Studio",
          "hosting": "Azure",
          "knowledgeRetrieval": "rag_internal",
          "confidenceThreshold": 0.85,
          "escalationPath": "Claims Handler",
          "memoryScope": "case_scoped",
          "decisionBoundary": "Assembles immutable evidence packs for inspection; read-only."
        },
        "description": "Gathers the decisions, inputs and control checks into a tamper-evident audit trail for regulators and internal assurance."
      },
      {
        "id": "S6",
        "name": "Compliance Officer Review",
        "stepType": "human_task",
        "primaryActor": "Human",
        "pillar": "Reshape business processes",
        "dataIn": [
          "Compliance findings",
          "Audit evidence pack"
        ],
        "dataOut": [
          "Disposition / remediation order"
        ]
      }
    ],
    "edges": [
      {
        "source": "S0",
        "target": "S1"
      },
      {
        "source": "S1",
        "target": "S2"
      },
      {
        "source": "S1",
        "target": "S3"
      },
      {
        "source": "S1",
        "target": "S4"
      },
      {
        "source": "S2",
        "target": "S5"
      },
      {
        "source": "S3",
        "target": "S5"
      },
      {
        "source": "S4",
        "target": "S5"
      },
      {
        "source": "S5",
        "target": "S6"
      }
    ]
  }
};

export function getModelNode(id: string): ModelNode | undefined {
  return modelNodes[id];
}

export function getSubflow(parentId: string): Subflow | undefined {
  return subflows[parentId];
}

export function getSubflowNode(parentId: string, stepId: string): ModelNode | undefined {
  return subflows[parentId]?.nodes.find((n) => n.id === stepId);
}
