import React, { useState, useEffect, useRef } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import {
  LayoutDashboard,
  ShieldAlert,
  Search,
  ArrowLeft,
  Network,
  AlertTriangle,
  CheckCircle,
  Loader2,
  ServerCrash,
  BrainCircuit,
} from "lucide-react";
import Graph from "react-graph-vis";
import ApiService from "./services/api";

// --- Static Data for Dashboard ---
// (Based on Minor_Project_Report+.pdf, Figure 4.1)
const performanceData = [
  { name: "Random Forest", "AUC-ROC": 0.7337, "F1 Score": 0.5785 },
  { name: "DNN", "AUC-ROC": 0.7425, "F1 Score": 0.5993 },
  { name: "GCN", "AUC-ROC": 0.7743, "F1 Score": 0.6194 },
  { name: "GAT", "AUC-ROC": 0.7822, "F1 Score": 0.7003 },
  { name: "GEM", "AUC-ROC": 0.8961, "F1 Score": 0.8504 },
  { name: "HGT (Ours)", "AUC-ROC": 0.9074, "F1 Score": 0.8617 },
  { name: "RDPGL (Ours)", "AUC-ROC": 0.8958, "F1 Score": 0.8434 },
];

// --- API Service Instance ---
const api = ApiService;

// --- Main App Component ---
export default function App() {
  const [view, setView] = useState("dashboard"); // 'dashboard', 'alerts', 'investigation'
  const [selectedAlertId, setSelectedAlertId] = useState(null);

  const navigateTo = (viewName) => setView(viewName);

  const investigateAlert = (alertId) => {
    setSelectedAlertId(alertId);
    setView("investigation");
  };

  const returnToAlerts = () => {
    setSelectedAlertId(null);
    setView("alerts");
  };

  // Simple fade-in animation
  useEffect(() => {
    const style = document.createElement("style");
    style.innerHTML = `
      @keyframes fadeIn {
        from { opacity: 0; transform: translateY(10px); }
        to { opacity: 1; transform: translateY(0); }
      }
      .animate-fade-in {
        animation: fadeIn 0.3s ease-out;
      }
    `;
    document.head.appendChild(style);
  }, []);

  return (
    <div className="flex min-h-screen w-full flex-col md:flex-row bg-slate-950 text-slate-100 font-sans">
      <SidebarNav currentView={view} navigateTo={navigateTo} />
      <main className="flex-1 p-6 md:p-10 overflow-auto">
        {view === "dashboard" && <DashboardView />}
        {view === "alerts" && (
          <AlertsView investigateAlert={investigateAlert} />
        )}
        {view === "investigation" && (
          <InvestigationView
            alertId={selectedAlertId}
            returnToAlerts={returnToAlerts}
          />
        )}
      </main>
    </div>
  );
}

// --- Navigation Component ---
function SidebarNav({ currentView, navigateTo }) {
  const navItems = [
    { name: "Dashboard", view: "dashboard", icon: LayoutDashboard },
    { name: "Alerts", view: "alerts", icon: ShieldAlert },
  ];

  return (
    <nav className="w-full md:w-64 border-b md:border-r border-slate-700 bg-slate-900 p-4 md:p-6 sticky top-0 h-full">
      <div className="flex flex-row md:flex-col items-center gap-4">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2 mb-0 md:mb-6">
          <BrainCircuit className="text-cyan-400" />
          xFraud
        </h1>
        <ul className="flex flex-row md:flex-col gap-2 w-full">
          {navItems.map((item) => (
            <li key={item.view}>
              <button
                onClick={() => navigateTo(item.view)}
                className={`
                  flex w-full items-center gap-3 rounded-md px-4 py-3 text-sm font-medium transition-all
                  ${
                    currentView === item.view
                      ? "bg-cyan-500/10 text-cyan-400"
                      : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                  }
                `}
              >
                <item.icon className="h-5 w-5" />
                <span>{item.name}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
}

// --- View 1: Dashboard ---
function DashboardView() {
  return (
    <div className="animate-fade-in">
      <h2 className="text-3xl font-bold tracking-tight text-white mb-6">
        Dashboard
      </h2>
      <div className="grid grid-cols-1 gap-6">
        <div className="rounded-xl border border-slate-700 bg-slate-900 p-6 shadow-xl">
          <h3 className="text-xl font-semibold text-white mb-4">
            Model Performance Comparison (from Report)
          </h3>
          <p className="text-slate-400 mb-6 text-sm">
            This chart shows the static benchmark results from the research
            paper, comparing GNN models (HGT, RDPGL) against baselines.
          </p>
          <div style={{ width: "100%", height: 400 }}>
            <ResponsiveContainer>
              <BarChart data={performanceData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis
                  dataKey="name"
                  stroke="#94a3b8"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  stroke="#94a3b8"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#0f172a",
                    borderColor: "#334155",
                    borderRadius: "8px",
                  }}
                  labelStyle={{ color: "#ffffff" }}
                  itemStyle={{ fontWeight: "bold" }}
                />
                <Legend
                  wrapperStyle={{ fontSize: "14px", paddingTop: "20px" }}
                />
                <Bar dataKey="AUC-ROC" fill="#00c9ff" radius={[4, 4, 0, 0]} />
                <Bar dataKey="F1 Score" fill="#64ffda" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}

// --- View 2: Alerts ---
function AlertsView({ investigateAlert }) {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function fetchAlerts() {
      try {
        setLoading(true);
        const data = await api.getAlerts();
        setAlerts(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    fetchAlerts();
  }, []);

  const getStatusClass = (status) =>
    status === "Pending Review"
      ? "text-red-400 bg-red-900/50 border-red-700/50"
      : "text-green-400 bg-green-900/50 border-green-700/50";

  const getScoreClass = (score) => {
    if (score > 0.9) return "text-red-400 font-bold";
    if (score > 0.8) return "text-orange-400 font-medium";
    return "text-slate-300";
  };

  return (
    <div className="animate-fade-in">
      <h2 className="text-3xl font-bold tracking-tight text-white mb-6">
        Alert Monitoring
      </h2>
      <div className="rounded-xl border border-slate-700 bg-slate-900 shadow-xl overflow-x-auto">
        <table className="w-full min-w-max text-left text-slate-300">
          <thead>
            <tr className="border-b border-slate-700 bg-slate-800/60">
              <th className="p-4 text-sm font-semibold text-slate-100">
                Transaction ID
              </th>
              <th className="p-4 text-sm font-semibold text-slate-100">
                xFraud Score
              </th>
              <th className="p-4 text-sm font-semibold text-slate-100">
                Model
              </th>
              <th className="p-4 text-sm font-semibold text-slate-100">
                Timestamp
              </th>
              <th className="p-4 text-sm font-semibold text-slate-100">
                Status
              </th>
              <th className="p-4 text-sm font-semibold text-slate-100">
                Action
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {loading && (
              <tr>
                <td colSpan="6" className="p-4 text-center text-slate-400">
                  Loading alerts...
                </td>
              </tr>
            )}
            {error && (
              <tr>
                <td colSpan="6" className="p-4 text-center text-red-400">
                  Error: {error}
                </td>
              </tr>
            )}
            {!loading &&
              !error &&
              alerts.map((alert) => (
                <tr
                  key={alert.transaction_id}
                  className="hover:bg-slate-800 transition-colors"
                >
                  <td className="p-4 font-mono text-sm">
                    {alert.transaction_id}
                  </td>
                  <td
                    className={`p-4 font-mono text-sm ${getScoreClass(alert.xfraud_score)}`}
                  >
                    {alert.xfraud_score.toFixed(4)}
                  </td>
                  <td className="p-4 text-sm">{alert.model}</td>
                  <td className="p-4 text-sm font-mono">
                    {new Date(alert.timestamp).toLocaleString()}
                  </td>
                  <td className="p-4 text-sm">
                    <span
                      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${getStatusClass(alert.status)}`}
                    >
                      {alert.status === "Pending Review" ? (
                        <AlertTriangle className="mr-1 h-3 w-3" />
                      ) : (
                        <CheckCircle className="mr-1 h-3 w-3" />
                      )}
                      {alert.status}
                    </span>
                  </td>
                  <td className="p-4 text-sm">
                    <button
                      onClick={() => investigateAlert(alert.transaction_id)}
                      className="flex items-center gap-2 rounded-md bg-cyan-500/10 px-3 py-2 text-cyan-400 transition-all hover:bg-cyan-500/20"
                    >
                      <Search className="h-4 w-4" />
                      Investigate
                    </button>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// --- View 3: Investigation (Async) ---
function InvestigationView({ alertId, returnToAlerts }) {
  const [jobId, setJobId] = useState(null);
  const [status, setStatus] = useState("pending"); // 'pending', 'running', 'completed', 'failed'
  const [graphData, setGraphData] = useState(null);
  const [analysis, setAnalysis] = useState("Starting investigation...");
  const [error, setError] = useState(null);
  const pollIntervalRef = useRef(null);

  useEffect(() => {
    // Clear any previous polling interval
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
    }

    async function startInvestigation() {
      try {
        setStatus("pending");
        setAnalysis(`Starting investigation for ${alertId}...`);
        setError(null);
        setGraphData(null);

        const { job_id } = await api.startInvestigation(alertId);
        setJobId(job_id);
        setStatus("running");
        setAnalysis("Fetching subgraph from database...");

        // Start polling
        pollIntervalRef.current = setInterval(async () => {
          if (document.hidden) return; // Don't poll if tab is not active
          const statusResult = await api.getInvestigationStatus(job_id);

          if (statusResult.status === "running") {
            setAnalysis(
              "Running GNN explainer model... (this may take a moment)"
            );
          }

          if (statusResult.status === "completed") {
            clearInterval(pollIntervalRef.current);
            setStatus("completed");
            setAnalysis(statusResult.result.summary);
            setGraphData({
              nodes: statusResult.result.nodes,
              edges: statusResult.result.edges,
            });
          }

          if (statusResult.status === "failed") {
            clearInterval(pollIntervalRef.current);
            setStatus("failed");
            setError(statusResult.error || "The investigation task failed.");
            setAnalysis("Investigation failed.");
          }
        }, 3000); // Poll every 3 seconds
      } catch (err) {
        setStatus("failed");
        setError(err.message);
        setAnalysis("Failed to start investigation.");
      }
    }

    startInvestigation();

    // Cleanup function
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [alertId]);

  return (
    <div className="animate-fade-in">
      <button
        onClick={returnToAlerts}
        className="flex items-center gap-2 rounded-md px-3 py-2 text-slate-400 transition-all hover:bg-slate-800 hover:text-slate-200 mb-4"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Alerts
      </button>

      <h2 className="text-3xl font-bold tracking-tight text-white mb-2">
        Investigation: <span className="text-red-400">{alertId}</span>
      </h2>
      <p className="text-slate-400 mb-6">
        This is the dynamic "Explainer" view. The graph is generated in
        real-time by the xFraud Python backend.
      </p>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Graph Panel */}
        <div className="flex-1 lg:w-2/3 h-[600px] rounded-xl border border-slate-700 bg-slate-900 shadow-xl p-4 relative">
          {status === "running" || status === "pending" ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/80 z-10 rounded-lg">
              <Loader2 className="h-12 w-12 text-cyan-400 animate-spin" />
              <p className="mt-4 text-lg text-slate-300">{analysis}</p>
            </div>
          ) : null}
          {status === "failed" ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/80 z-10 rounded-lg">
              <ServerCrash className="h-12 w-12 text-red-500" />
              <p className="mt-4 text-lg text-red-400">{analysis}</p>
              <p className="mt-2 text-sm text-slate-400">{error}</p>
            </div>
          ) : null}
          {status === "completed" && graphData ? (
            <ExplainerGraph graphData={graphData} />
          ) : null}
        </div>

        {/* Details & Legend Panel */}
        <div className="w-full lg:w-1/3">
          <div className="rounded-xl border border-slate-700 bg-slate-900 shadow-xl p-6">
            <h3 className="text-xl font-semibold text-white mb-4">Legend</h3>
            <ul className="space-y-3">
              <li className="flex items-center gap-3">
                <span
                  className="h-5 w-5 rounded-full"
                  style={{ backgroundColor: "#e74c3c" }}
                ></span>
                <span className="text-sm">Transaction</span>
              </li>
              <li className="flex items-center gap-3">
                <span
                  className="h-5 w-5 rounded-full"
                  style={{ backgroundColor: "#f39c12" }}
                ></span>
                <span className="text-sm">Fraudulent Txn</span>
              </li>
              <li className="flex items-center gap-3">
                <span
                  className="h-5 w-5 rounded-full"
                  style={{ backgroundColor: "#3498db" }}
                ></span>
                <span className="text-sm">User</span>
              </li>
              <li className="flex items-center gap-3">
                <span
                  className="h-5 w-5 rounded-full"
                  style={{ backgroundColor: "#9b59b6" }}
                ></span>
                <span className="text-sm">Payment Token</span>
              </li>
              <li className="flex items-center gap-3">
                <span
                  className="h-5 w-5 rounded-full"
                  style={{ backgroundColor: "#2ecc71" }}
                ></span>
                <span className="text-sm">Email</span>
              </li>
              <li className="flex items-center gap-3">
                <span
                  className="h-5 w-5 rounded-full"
                  style={{ backgroundColor: "#1abc9c" }}
                ></span>
                <span className="text-sm">Device / IP / Address</span>
              </li>
            </ul>

            <h3 className="text-xl font-semibold text-white mt-8 mb-4">
              Analysis
            </h3>
            <p className="text-slate-300 text-sm">
              {status === "completed"
                ? analysis
                : "Analysis will appear here once the investigation is complete."}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// --- Graph Visualization Component ---
function ExplainerGraph({ graphData }) {
  const options = {
    layout: {
      hierarchical: false,
    },
    physics: {
      enabled: true,
      solver: "barnesHut",
      barnesHut: {
        gravitationalConstant: -3000,
        centralGravity: 0.1,
        springLength: 120,
      },
    },
    nodes: {
      font: {
        color: "#ffffff",
      },
      borderWidth: 2,
    },
    edges: {
      color: {
        color: "#848484",
        highlight: "#64ffda",
      },
      smooth: {
        type: "continuous",
      },
    },
    interaction: {
      hover: true,
      tooltipDelay: 200,
    },
  };

  return (
    <div className="w-full h-full bg-slate-900 rounded-lg">
      <Graph
        graph={graphData}
        options={options}
        style={{ width: "100%", height: "100%" }}
      />
    </div>
  );
}
