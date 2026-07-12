import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  Button,
  Column,
  Dropdown,
  Grid,
  InlineNotification,
  Search,
  SkeletonText,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeader,
  TableRow,
  Tag,
} from "@carbon/react";
import { Renew } from "@carbon/icons-react";
import { CheckmarkCircle24Regular, Clock24Regular, Gauge24Regular, Warning24Regular } from "@fluentui/react-icons";
import StatTile from "../components/StatTile";
import {
  fetchDecisions,
  lifecycleStages,
  type DecisionItem,
  type DecisionsResponse,
} from "../services/decisionsClient";
import { pct, relativeTime } from "../lib/format";

type StatusFilter = "all" | "needs-review" | "completed" | "not-run" | "failed";

const STATUS_ITEMS: { id: StatusFilter; label: string }[] = [
  { id: "all", label: "All statuses" },
  { id: "needs-review", label: "Needs review" },
  { id: "completed", label: "Completed" },
  { id: "not-run", label: "Not run" },
  { id: "failed", label: "Failed" },
];

function decisionStatus(d: DecisionItem): StatusFilter {
  if (!d.latestTrace) return "not-run";
  return d.latestTrace.status as StatusFilter;
}

function StatusTag({ d }: { d: DecisionItem }) {
  const s = decisionStatus(d);
  if (s === "needs-review") return <Tag type="magenta" size="sm">Needs review</Tag>;
  if (s === "failed") return <Tag type="red" size="sm">Failed</Tag>;
  if (s === "completed") return <Tag type="teal" size="sm">Decided</Tag>;
  return <Tag type="cool-gray" size="sm">Not run</Tag>;
}

function JourneyCell({ d, data }: { d: DecisionItem; data: DecisionsResponse | null }) {
  const stages = lifecycleStages(data?.packages ?? [], d.useCase);
  if (stages.length === 0) return <span className="adp-queue__dim">-</span>;
  const done = stages.filter((s) => d.packagesRun.includes(s.packageId)).length;
  return (
    <span className="adp-journey-progress" title={stages.map((s) => s.stage).join(" -> ")}>
      <span className="adp-journey-progress__segments">
        {stages.map((s) => (
          <span
            key={s.packageId}
            className={`adp-journey-progress__seg${d.packagesRun.includes(s.packageId) ? " adp-journey-progress__seg--done" : ""}`}
          />
        ))}
      </span>
      {done}/{stages.length}
    </span>
  );
}

function ConfidenceCell({ d }: { d: DecisionItem }) {
  const t = d.latestTrace;
  if (!t) return <span className="adp-queue__dim">-</span>;
  const v = t.minConfidence;
  const tone = v >= 0.8 ? "high" : v >= 0.6 ? "medium" : "low";
  return (
    <span className="adp-confidence">
      <span className={`adp-confidence__bar adp-confidence__bar--${tone}`}>
        <span style={{ width: pct(v) }} />
      </span>
      {pct(v)}
    </span>
  );
}

export default function DecisionQueuePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [data, setData] = useState<DecisionsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  // Deep-linkable: /?useCase=<id> lands the queue pre-filtered (Platform page links here).
  const [useCaseFilter, setUseCaseFilter] = useState<string>(searchParams.get("useCase") ?? "all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const load = useCallback(async (background = false) => {
    if (!background) setLoading(true);
    try {
      setData(await fetchDecisions());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const onFocus = () => load(true);
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [load]);

  const useCases = useMemo(() => {
    const set = new Map<string, string>();
    for (const p of data?.packages ?? []) set.set(p.useCase, p.industry);
    return [...set.keys()];
  }, [data]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (data?.decisions ?? []).filter((d) => {
      if (q && !d.subjectId.toLowerCase().includes(q)) return false;
      if (useCaseFilter !== "all" && d.useCase !== useCaseFilter) return false;
      if (statusFilter !== "all" && decisionStatus(d) !== statusFilter) return false;
      return true;
    });
  }, [data, search, useCaseFilter, statusFilter]);

  const stats = useMemo(() => {
    const all = data?.decisions ?? [];
    const traced = all.filter((d) => d.latestTrace);
    const conf = traced.map((d) => d.latestTrace!.avgConfidence);
    return {
      needsReview: all.filter((d) => decisionStatus(d) === "needs-review").length,
      notRun: all.filter((d) => !d.latestTrace).length,
      decided: all.filter((d) => decisionStatus(d) === "completed").length,
      avgConfidence: conf.length ? conf.reduce((a, b) => a + b, 0) / conf.length : 0,
    };
  }, [data]);

  return (
    <Grid fullWidth>
      <Column lg={16} md={8} sm={4}>
        <div className="adp-page-head">
          <div>
            <h2>Decision Queue</h2>
            <p className="adp-page-head__sub">
              Every decision the platform can work, across {data?.packages.length ?? "-"} digital workers and{" "}
              {useCases.length || "-"} use cases. Prioritized by what needs your judgment.
            </p>
          </div>
          <Button kind="ghost" renderIcon={Renew} onClick={() => load(true)} disabled={loading}>
            Refresh
          </Button>
        </div>

        {error && (
          <InlineNotification kind="error" title="Queue unavailable" subtitle={error} lowContrast className="adp-notification" />
        )}

        <Grid narrow className="adp-stat-row">
          <Column lg={4} md={2} sm={2}>
            <StatTile
              icon={<Warning24Regular />}
              alert
              value={loading ? <SkeletonText width="3rem" /> : stats.needsReview}
              label="Needs review"
            />
          </Column>
          <Column lg={4} md={2} sm={2}>
            <StatTile
              icon={<CheckmarkCircle24Regular />}
              value={loading ? <SkeletonText width="3rem" /> : stats.decided}
              label="Decided"
            />
          </Column>
          <Column lg={4} md={2} sm={2}>
            <StatTile
              icon={<Clock24Regular />}
              value={loading ? <SkeletonText width="3rem" /> : stats.notRun}
              label="Awaiting first run"
            />
          </Column>
          <Column lg={4} md={2} sm={2}>
            <StatTile
              icon={<Gauge24Regular />}
              value={loading ? <SkeletonText width="3rem" /> : stats.avgConfidence ? pct(stats.avgConfidence) : "-"}
              label="Avg confidence"
            />
          </Column>
        </Grid>

        <TableContainer className="adp-queue">
          <div className="adp-queue__toolbar">
            <Search
              labelText="Search decisions"
              placeholder="Search by subject id"
              size="lg"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <Dropdown
              id="usecase-filter"
              titleText=""
              label="All use cases"
              items={["all", ...useCases]}
              itemToString={(i) => (i === "all" ? "All use cases" : (i ?? ""))}
              selectedItem={useCaseFilter}
              onChange={({ selectedItem }) => setUseCaseFilter(selectedItem ?? "all")}
            />
            <Dropdown
              id="status-filter"
              titleText=""
              label="All statuses"
              items={STATUS_ITEMS}
              itemToString={(i) => i?.label ?? ""}
              selectedItem={STATUS_ITEMS.find((s) => s.id === statusFilter)}
              onChange={({ selectedItem }) => setStatusFilter(selectedItem?.id ?? "all")}
            />
          </div>
          <Table size="lg">
            <TableHead>
              <TableRow>
                <TableHeader>Subject</TableHeader>
                <TableHeader>Use case</TableHeader>
                <TableHeader>Status</TableHeader>
                <TableHeader>Confidence</TableHeader>
                <TableHeader>Journey</TableHeader>
                <TableHeader>Last activity</TableHeader>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading && (
                <TableRow>
                  <TableCell colSpan={6}>
                    <SkeletonText paragraph lineCount={3} />
                  </TableCell>
                </TableRow>
              )}
              {!loading &&
                filtered.map((d) => {
                  const t = d.latestTrace;
                  const gateOpen = decisionStatus(d) === "needs-review";
                  const open = () => navigate(`/decisions/${encodeURIComponent(d.subjectId)}`);
                  return (
                    <TableRow
                      key={d.subjectId}
                      className={`adp-queue__row${gateOpen ? " adp-queue__row--gate" : ""}`}
                      onClick={open}
                      tabIndex={0}
                      aria-label={`Open decision ${d.subjectId}`}
                      onKeyDown={(e: React.KeyboardEvent) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          open();
                        }
                      }}
                    >
                      <TableCell>
                        <span className="adp-queue__subject">{d.subjectId}</span>
                      </TableCell>
                      <TableCell>
                        <Tag type={d.industry === "banking" ? "purple" : "blue"} size="sm">
                          {d.useCase ?? "unknown"}
                        </Tag>
                      </TableCell>
                      <TableCell>
                        <StatusTag d={d} />
                        {!d.latestTrace && d.receivedAt && (
                          <Tag type="blue" size="sm">new · {d.channel ?? "web"}</Tag>
                        )}
                        {gateOpen && t?.lastActivityAt && (
                          <span className="adp-queue__aging">waiting {relativeTime(t.lastActivityAt).replace(" ago", "")}</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <ConfidenceCell d={d} />
                      </TableCell>
                      <TableCell>
                        <JourneyCell d={d} data={data} />
                      </TableCell>
                      <TableCell>
                        <span className="adp-queue__dim">{relativeTime(t?.lastActivityAt ?? d.receivedAt)}</span>
                      </TableCell>
                    </TableRow>
                  );
                })}
              {!loading && filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6}>
                    <span className="adp-queue__dim">No decisions match the current filters.</span>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Column>
    </Grid>
  );
}
