// Microsoft Azure-branded inline-SVG service icons (used inside SVG diagrams).
// For UI elements outside diagrams (sidebars, cards, headers) use Fluent UI react-icons
// (Microsoft) and @carbon/icons-react (IBM) via the named exports at the bottom — same
// pattern as the IBM-Project-Adp portal (adp-portal).
//
// All take a size prop (default 32) and render with their canonical brand color.

interface IconProps { size?: number }

export function FunctionsIcon({ size = 32 }: IconProps) {
  return (
    <svg viewBox="0 0 32 32" width={size} height={size} xmlns="http://www.w3.org/2000/svg" aria-label="Azure Functions">
      <rect width="32" height="32" rx="4" fill="#FFD800" />
      <path d="M9 8 L23 8 L20 15 L24 15 L13 24 L16 17 L11 17 Z" fill="#1c1c1c" />
    </svg>
  );
}

export function CosmosIcon({ size = 32 }: IconProps) {
  return (
    <svg viewBox="0 0 32 32" width={size} height={size} xmlns="http://www.w3.org/2000/svg" aria-label="Azure Cosmos DB">
      <rect width="32" height="32" rx="4" fill="#0072C6" />
      <circle cx="16" cy="16" r="7" fill="none" stroke="#fff" strokeWidth="1.8" />
      <ellipse cx="16" cy="16" rx="11" ry="4" fill="none" stroke="#fff" strokeWidth="1.6" />
      <ellipse cx="16" cy="16" rx="4" ry="11" fill="none" stroke="#fff" strokeWidth="1.6" />
    </svg>
  );
}

export function SignalRIcon({ size = 32 }: IconProps) {
  return (
    <svg viewBox="0 0 32 32" width={size} height={size} xmlns="http://www.w3.org/2000/svg" aria-label="Azure SignalR Service">
      <rect width="32" height="32" rx="4" fill="#7B68EE" />
      <path d="M16 22 L16 22.5 M11 19 Q16 13 21 19 M8 17 Q16 8 24 17" stroke="#fff" strokeWidth="2" fill="none" strokeLinecap="round" />
      <circle cx="16" cy="22" r="2" fill="#fff" />
    </svg>
  );
}

export function AISearchIcon({ size = 32 }: IconProps) {
  return (
    <svg viewBox="0 0 32 32" width={size} height={size} xmlns="http://www.w3.org/2000/svg" aria-label="Azure AI Search">
      <rect width="32" height="32" rx="4" fill="#3CCBF4" />
      <circle cx="13" cy="13" r="6" stroke="#0b1220" strokeWidth="2" fill="none" />
      <line x1="18" y1="18" x2="24" y2="24" stroke="#0b1220" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="13" cy="13" r="2" fill="#0b1220" />
    </svg>
  );
}

export function FabricIcon({ size = 32 }: IconProps) {
  return (
    <svg viewBox="0 0 32 32" width={size} height={size} xmlns="http://www.w3.org/2000/svg" aria-label="Microsoft Fabric">
      <rect width="32" height="32" rx="4" fill="#0078D4" />
      <path d="M9 11 L16 7 L23 11 L23 17 L16 21 L9 17 Z" fill="#5DC2E6" stroke="#fff" strokeWidth="1.2" />
      <path d="M16 7 L16 21 M9 11 L23 17 M9 17 L23 11" stroke="#fff" strokeWidth="0.8" opacity="0.55" />
    </svg>
  );
}

export function FoundryIcon({ size = 32 }: IconProps) {
  return (
    <svg viewBox="0 0 32 32" width={size} height={size} xmlns="http://www.w3.org/2000/svg" aria-label="Azure AI Foundry">
      <rect width="32" height="32" rx="4" fill="#9D6CD6" />
      <path d="M8 22 L16 7 L24 22 Z" fill="#fff" />
      <circle cx="16" cy="17" r="2.5" fill="#9D6CD6" />
    </svg>
  );
}

export function OpenAIIcon({ size = 32 }: IconProps) {
  return (
    <svg viewBox="0 0 32 32" width={size} height={size} xmlns="http://www.w3.org/2000/svg" aria-label="Azure OpenAI">
      <rect width="32" height="32" rx="4" fill="#10A37F" />
      <path d="M16 7 C20 7 23 10 23 14 C23 17 21 19 18 20 L18 24 L14 24 L14 20 C11 19 9 17 9 14 C9 10 12 7 16 7 Z" fill="#fff" />
      <circle cx="16" cy="14" r="2.5" fill="#10A37F" />
    </svg>
  );
}

export function EventHubsIcon({ size = 32 }: IconProps) {
  return (
    <svg viewBox="0 0 32 32" width={size} height={size} xmlns="http://www.w3.org/2000/svg" aria-label="Azure Event Hubs">
      <rect width="32" height="32" rx="4" fill="#0078D4" />
      <circle cx="16" cy="16" r="3" fill="#fff" />
      {[0, 60, 120, 180, 240, 300].map((angle) => {
        const rad = (angle * Math.PI) / 180;
        const x = 16 + Math.cos(rad) * 8;
        const y = 16 + Math.sin(rad) * 8;
        return <circle key={angle} cx={x} cy={y} r="2" fill="#fff" />;
      })}
      {[0, 60, 120, 180, 240, 300].map((angle) => {
        const rad = (angle * Math.PI) / 180;
        const x = 16 + Math.cos(rad) * 5;
        const y = 16 + Math.sin(rad) * 5;
        return <line key={`l${angle}`} x1="16" y1="16" x2={x} y2={y} stroke="#fff" strokeWidth="1" />;
      })}
    </svg>
  );
}

export function EventGridIcon({ size = 32 }: IconProps) {
  return (
    <svg viewBox="0 0 32 32" width={size} height={size} xmlns="http://www.w3.org/2000/svg" aria-label="Azure Event Grid">
      <rect width="32" height="32" rx="4" fill="#0072C6" />
      <polygon points="16,6 24,11 24,21 16,26 8,21 8,11" fill="none" stroke="#fff" strokeWidth="2" />
      <line x1="16" y1="6" x2="16" y2="26" stroke="#fff" strokeWidth="1.2" />
      <line x1="8" y1="11" x2="24" y2="21" stroke="#fff" strokeWidth="1.2" />
      <line x1="24" y1="11" x2="8" y2="21" stroke="#fff" strokeWidth="1.2" />
    </svg>
  );
}

export function SwaIcon({ size = 32 }: IconProps) {
  return (
    <svg viewBox="0 0 32 32" width={size} height={size} xmlns="http://www.w3.org/2000/svg" aria-label="Static Web Apps">
      <rect width="32" height="32" rx="4" fill="#2D6FD6" />
      <rect x="7" y="9" width="18" height="14" rx="1.5" fill="#fff" />
      <rect x="7" y="9" width="18" height="3" fill="#0b1220" />
      <circle cx="9" cy="10.5" r="0.6" fill="#fff" />
      <circle cx="11" cy="10.5" r="0.6" fill="#fff" />
      <line x1="9" y1="15" x2="23" y2="15" stroke="#0b1220" strokeWidth="0.8" />
      <line x1="9" y1="17" x2="20" y2="17" stroke="#0b1220" strokeWidth="0.8" />
      <line x1="9" y1="19" x2="22" y2="19" stroke="#0b1220" strokeWidth="0.8" />
    </svg>
  );
}

export function ContainerAppsIcon({ size = 32 }: IconProps) {
  return (
    <svg viewBox="0 0 32 32" width={size} height={size} xmlns="http://www.w3.org/2000/svg" aria-label="Azure Container Apps">
      <rect width="32" height="32" rx="4" fill="#1E4D8C" />
      <rect x="7" y="9" width="8" height="6" fill="#fff" />
      <rect x="17" y="9" width="8" height="6" fill="#fff" />
      <rect x="7" y="17" width="8" height="6" fill="#fff" />
      <rect x="17" y="17" width="8" height="6" fill="#fff" />
    </svg>
  );
}

export function KeyVaultIcon({ size = 32 }: IconProps) {
  return (
    <svg viewBox="0 0 32 32" width={size} height={size} xmlns="http://www.w3.org/2000/svg" aria-label="Azure Key Vault">
      <rect width="32" height="32" rx="4" fill="#FFC107" />
      <circle cx="13" cy="14" r="4" fill="none" stroke="#0b1220" strokeWidth="2" />
      <path d="M16 14 L24 14 L24 18 L21 18 L21 21 L18 21 L18 18 L16 18 Z" fill="#0b1220" />
    </svg>
  );
}

export function EntraIcon({ size = 32 }: IconProps) {
  return (
    <svg viewBox="0 0 32 32" width={size} height={size} xmlns="http://www.w3.org/2000/svg" aria-label="Microsoft Entra">
      <rect width="32" height="32" rx="4" fill="#0078D4" />
      <path d="M16 7 L24 22 L8 22 Z" fill="#fff" />
      <path d="M16 12 L20 22 L12 22 Z" fill="#0078D4" />
    </svg>
  );
}

export function SqlIcon({ size = 32 }: IconProps) {
  return (
    <svg viewBox="0 0 32 32" width={size} height={size} xmlns="http://www.w3.org/2000/svg" aria-label="Azure SQL">
      <rect width="32" height="32" rx="4" fill="#CC2927" />
      <ellipse cx="16" cy="10" rx="8" ry="3" fill="#fff" />
      <path d="M8 10 L8 22 Q8 25 16 25 Q24 25 24 22 L24 10" fill="#fff" />
      <ellipse cx="16" cy="14" rx="8" ry="3" fill="#CC2927" />
      <ellipse cx="16" cy="18" rx="8" ry="3" fill="#CC2927" />
      <ellipse cx="16" cy="10" rx="8" ry="3" fill="none" stroke="#CC2927" strokeWidth="0.7" />
    </svg>
  );
}

export function StorageIcon({ size = 32 }: IconProps) {
  return (
    <svg viewBox="0 0 32 32" width={size} height={size} xmlns="http://www.w3.org/2000/svg" aria-label="Azure Storage">
      <rect width="32" height="32" rx="4" fill="#0078D4" />
      <ellipse cx="16" cy="9" rx="8" ry="2.5" fill="#fff" />
      <path d="M8 9 L8 23 Q8 25.5 16 25.5 Q24 25.5 24 23 L24 9" fill="#fff" />
      <ellipse cx="16" cy="9" rx="8" ry="2.5" fill="#5DC2E6" />
    </svg>
  );
}

export function LogAnalyticsIcon({ size = 32 }: IconProps) {
  return (
    <svg viewBox="0 0 32 32" width={size} height={size} xmlns="http://www.w3.org/2000/svg" aria-label="Log Analytics">
      <rect width="32" height="32" rx="4" fill="#5C2D91" />
      <polyline points="7,22 12,16 17,19 23,9" stroke="#fff" strokeWidth="2.4" fill="none" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx="12" cy="16" r="1.6" fill="#fff" />
      <circle cx="17" cy="19" r="1.6" fill="#fff" />
      <circle cx="23" cy="9" r="1.6" fill="#fff" />
    </svg>
  );
}

export function BicepIcon({ size = 32 }: IconProps) {
  return (
    <svg viewBox="0 0 32 32" width={size} height={size} xmlns="http://www.w3.org/2000/svg" aria-label="Bicep">
      <rect width="32" height="32" rx="4" fill="#0099FF" />
      <path d="M10 11 Q12 8 16 11 Q18 13 19 11 Q22 7 25 10 L25 14 Q24 16 22 15 Q19 13 17 16 Q15 19 12 17 Q9 15 9 12 Z" fill="#fff" />
      <circle cx="13" cy="20" r="2" fill="#fff" />
      <circle cx="19" cy="20" r="2" fill="#fff" />
    </svg>
  );
}

export function ReactIcon({ size = 32 }: IconProps) {
  return (
    <svg viewBox="0 0 32 32" width={size} height={size} xmlns="http://www.w3.org/2000/svg" aria-label="React">
      <rect width="32" height="32" rx="4" fill="#20232A" />
      <circle cx="16" cy="16" r="2.2" fill="#61DAFB" />
      <ellipse cx="16" cy="16" rx="10" ry="4" fill="none" stroke="#61DAFB" strokeWidth="1.4" />
      <ellipse cx="16" cy="16" rx="10" ry="4" fill="none" stroke="#61DAFB" strokeWidth="1.4" transform="rotate(60 16 16)" />
      <ellipse cx="16" cy="16" rx="10" ry="4" fill="none" stroke="#61DAFB" strokeWidth="1.4" transform="rotate(120 16 16)" />
    </svg>
  );
}

export function DotnetIcon({ size = 32 }: IconProps) {
  return (
    <svg viewBox="0 0 32 32" width={size} height={size} xmlns="http://www.w3.org/2000/svg" aria-label=".NET">
      <rect width="32" height="32" rx="4" fill="#512BD4" />
      <text x="16" y="21" fontSize="13" fontWeight="700" fill="#fff" textAnchor="middle" fontFamily="Segoe UI, sans-serif">.NET</text>
    </svg>
  );
}

export function DurableIcon({ size = 32 }: IconProps) {
  return (
    <svg viewBox="0 0 32 32" width={size} height={size} xmlns="http://www.w3.org/2000/svg" aria-label="Durable Functions">
      <rect width="32" height="32" rx="4" fill="#3FA9F5" />
      <path d="M11 11 L11 17 Q11 19 13 19 L19 19 Q21 19 21 21 L21 23" stroke="#fff" strokeWidth="2" fill="none" strokeLinecap="round" />
      <circle cx="11" cy="11" r="2.2" fill="#fff" />
      <circle cx="21" cy="23" r="2.2" fill="#fff" />
      <circle cx="16" cy="16" r="2.2" fill="#FFD800" />
    </svg>
  );
}

export function GraphIcon({ size = 32 }: IconProps) {
  return (
    <svg viewBox="0 0 32 32" width={size} height={size} xmlns="http://www.w3.org/2000/svg" aria-label="Microsoft Graph">
      <rect width="32" height="32" rx="4" fill="#0078D4" />
      <circle cx="11" cy="11" r="2.5" fill="#fff" />
      <circle cx="21" cy="11" r="2.5" fill="#fff" />
      <circle cx="16" cy="22" r="2.5" fill="#fff" />
      <line x1="11" y1="11" x2="21" y2="11" stroke="#fff" strokeWidth="1.4" />
      <line x1="11" y1="11" x2="16" y2="22" stroke="#fff" strokeWidth="1.4" />
      <line x1="21" y1="11" x2="16" y2="22" stroke="#fff" strokeWidth="1.4" />
    </svg>
  );
}

// Generic stack of named icons mapped by canonical key
export const ICONS = {
  functions: FunctionsIcon,
  cosmos: CosmosIcon,
  signalr: SignalRIcon,
  search: AISearchIcon,
  fabric: FabricIcon,
  foundry: FoundryIcon,
  openai: OpenAIIcon,
  eventhubs: EventHubsIcon,
  eventgrid: EventGridIcon,
  swa: SwaIcon,
  containers: ContainerAppsIcon,
  keyvault: KeyVaultIcon,
  entra: EntraIcon,
  sql: SqlIcon,
  storage: StorageIcon,
  logs: LogAnalyticsIcon,
  bicep: BicepIcon,
  react: ReactIcon,
  dotnet: DotnetIcon,
  durable: DurableIcon,
  graph: GraphIcon,
} as const;

export type IconKey = keyof typeof ICONS;

export function ServiceIcon({ name, size = 32 }: { name: IconKey; size?: number }) {
  const Cmp = ICONS[name];
  return <Cmp size={size} />;
}

// ============================================================
// IBM Carbon icons — same pattern as adp-portal.
// Used for nav, UI cards, and content section headers.
// ============================================================
export {
  Home as IbmHome,
  CubeView as IbmPlatform,
  Industry as IbmUseCase,
  CloudUpload as IbmDeploy,
  Document as IbmDecision,
  Catalog as IbmReference,
  ArrowRight as IbmArrowRight,
  Warning as IbmWarning,
  Information as IbmInfo,
  Checkmark as IbmCheck,
  Layers as IbmLayers,
  Settings as IbmSettings,
  Tools as IbmTools,
  DataBase as IbmDatabase,
  DataView as IbmDataView,
  DataConnected as IbmDataConnected,
  WorkflowAutomation as IbmWorkflow,
  UserMultiple as IbmPersonas,
  Bot as IbmBot,
  Watson as IbmWatson,
  Application as IbmApp,
  TimePlot as IbmTimeline,
} from "@carbon/icons-react";

// ============================================================
// Microsoft Fluent UI icons — same pattern as adp-portal.
// Used for UI controls and Microsoft-branded surfaces.
// ============================================================
export {
  Apps20Regular as MsApps,
  Book20Regular as MsBook,
  WeatherSunny20Regular as MsSun,
  WeatherMoon20Regular as MsMoon,
  Cloud20Regular as MsCloud,
  ServerMultiple20Regular as MsServers,
  BrainCircuit20Regular as MsBrain,
  Database20Regular as MsDatabase,
  Flash20Regular as MsFlash,
  Search20Regular as MsSearch,
  BuildingBank20Regular as MsBank,
  Shield20Regular as MsShield,
  Code20Regular as MsCode,
  ChevronRight20Regular as MsChevronRight,
  ChevronLeft20Regular as MsChevronLeft,
  Navigation20Regular as MsNav,
} from "@fluentui/react-icons";
