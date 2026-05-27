import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getResults } from "../api/results";
import { getDrives } from "../api/drives";
import { getRegistrations } from "../api/registrations";
import {
  PieChart, Pie, Cell, Tooltip,
  ResponsiveContainer, Legend
} from "recharts";
import {
  ChevronDown, ChevronUp, 
  CheckCircle, XCircle, 
} from "lucide-react";
import { useAuth } from "../context/AuthContext";

const formatDate = (d) => {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-IN", {
    day: "numeric", month: "short", year: "numeric"
  });
};

function ResultPieChart({ passed, failed }) {
  const total = passed + failed;
  if (total === 0) return (
    <div className="flex items-center justify-center h-24 text-xs text-gray-400">
      No results yet
    </div>
  );
  const data = [
    { name: "Pass", value: passed, color: "#1D9E75" },
    { name: "Fail", value: failed, color: "#E24B4A" },
  ].filter(d => d.value > 0);

  return (
    <PieChart width={120} height={120}>
      <Pie
        data={data}
        cx={55}
        cy={55}
        innerRadius={32}
        outerRadius={52}
        dataKey="value"
        paddingAngle={2}
      >
        {data.map((entry, i) => (
          <Cell key={i} fill={entry.color} />
        ))}
      </Pie>
      <Tooltip formatter={(v, n) => [`${v}`, n]} />
    </PieChart>
  );
}

function DriveResultCard({ drive, results, registrations }) {
  const [expanded, setExpanded] = useState(false);

  // Match results to registrations for this drive
  const driveRegIds = registrations
    .filter(r => r.drive_id === drive.id)
    .map(r => r.id);

  const driveResults = results.filter(r =>
    driveRegIds.includes(r.registration_id)
  );

  const passed = driveResults.filter(r => r.outcome === "pass").length;
  const failed = driveResults.filter(r => r.outcome === "fail").length;
  const total = driveResults.length;
  const passRate = total > 0 ? Math.round(passed / total * 100) : 0;

  // Enrich results with user info from registrations
  const enriched = driveResults.map(result => {
    const reg = registrations.find(r => r.id === result.registration_id);
    return { ...result, registration: reg };
  });

  const statusBadge = {
    active: "badge-green",
    draft: "badge-gray",
    closed: "badge-red"
  };

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      {/* Header */}
      <div
        className="flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-gray-50"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-start gap-4 flex-1">
          {/* Pie chart */}
          <div className="flex-shrink-0" onClick={e => e.stopPropagation()}>
            <ResultPieChart passed={passed} failed={failed} />
          </div>

          {/* Drive info */}
          <div className="flex-1 pt-2">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-semibold text-gray-800">{drive.name}</p>
              <span className={statusBadge[drive.status] || "badge-gray"}>
                {drive.status}
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              {formatDate(drive.start_date)} → {formatDate(drive.end_date)}
            </p>
            <div className="flex items-center gap-4 mt-2">
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-green-500"></div>
                <span className="text-xs text-gray-600">
                  {passed} passed
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-red-500"></div>
                <span className="text-xs text-gray-600">
                  {failed} failed
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-gray-300"></div>
                <span className="text-xs text-gray-600">
                  {total} total
                </span>
              </div>
              {total > 0 && (
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                  passRate >= 70
                    ? "bg-green-100 text-green-700"
                    : passRate >= 50
                    ? "bg-amber-100 text-amber-700"
                    : "bg-red-100 text-red-700"
                }`}>
                  {passRate}% pass rate
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {expanded
            ? <ChevronUp size={16} className="text-gray-400" />
            : <ChevronDown size={16} className="text-gray-400" />
          }
        </div>
      </div>

      {/* Expanded — results list */}
      {expanded && (
        <div className="border-t border-gray-100 px-5 py-4">
          {driveResults.length === 0 ? (
            <div className="text-center py-6 text-gray-400 text-sm">
              No results imported for this drive yet.
            </div>
          ) : (
            <div className="space-y-3">
              {/* Pass / fail split header */}
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="bg-green-50 rounded-xl p-3 text-center border border-green-100">
                  <p className="text-2xl font-bold text-green-700">{passed}</p>
                  <p className="text-xs text-green-600 mt-0.5">Passed</p>
                </div>
                <div className="bg-red-50 rounded-xl p-3 text-center border border-red-100">
                  <p className="text-2xl font-bold text-red-600">{failed}</p>
                  <p className="text-xs text-red-500 mt-0.5">Failed</p>
                </div>
              </div>

              {/* Results table */}
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="text-left px-3 py-2 text-xs font-medium text-gray-500">
                      Registration ID
                    </th>
                    <th className="text-left px-3 py-2 text-xs font-medium text-gray-500">
                      Certification
                    </th>
                    <th className="text-center px-3 py-2 text-xs font-medium text-gray-500">
                      Score
                    </th>
                    <th className="text-center px-3 py-2 text-xs font-medium text-gray-500">
                      Outcome
                    </th>
                    <th className="text-left px-3 py-2 text-xs font-medium text-gray-500">
                      Exam Date
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {enriched
                    .sort((a, b) =>
                      a.outcome === "pass" ? -1 : 1
                    )
                    .map(result => (
                      <tr
                        key={result.id}
                        className={`hover:bg-gray-50 ${
                          result.outcome === "fail" ? "opacity-70" : ""
                        }`}
                      >
                        <td className="px-3 py-2.5 font-mono text-xs text-gray-400">
                          {result.registration_id.slice(0, 8)}...
                        </td>
                        <td className="px-3 py-2.5 text-gray-700">
                          {result.registration?.exam_track || "—"}
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          <span className={`font-semibold ${
                            result.outcome === "pass"
                              ? "text-green-700"
                              : "text-red-600"
                          }`}>
                            {result.score}%
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          <div className="flex items-center justify-center gap-1">
                            {result.outcome === "pass" ? (
                              <>
                                <CheckCircle size={13} className="text-green-600" />
                                <span className="text-xs font-medium text-green-700">
                                  Pass
                                </span>
                              </>
                            ) : (
                              <>
                                <XCircle size={13} className="text-red-500" />
                                <span className="text-xs font-medium text-red-600">
                                  Fail
                                </span>
                              </>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-2.5 text-xs text-gray-500">
                          {formatDate(result.exam_date)}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function Results() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState("active");

  const { data: results = [], isLoading: resultsLoading } = useQuery({
    queryKey: ["results"],
    queryFn: getResults,
  });

  const { data: drives = [], isLoading: drivesLoading } = useQuery({
    queryKey: ["drives"],
    queryFn: getDrives,
  });

  const { data: registrations = [] } = useQuery({
    queryKey: ["registrations"],
    queryFn: getRegistrations,
  });

  const filteredDrives = drives
    .filter(drive => {
      if (statusFilter === "all") return true;
      return drive.status === statusFilter;
    })
    .sort((a, b) => {
      if (!a.start_date) return 1;
      if (!b.start_date) return -1;
      return new Date(a.start_date) - new Date(b.start_date);
    });

  const countByStatus = drives.reduce((acc, d) => {
    acc[d.status] = (acc[d.status] || 0) + 1;
    return acc;
  }, {});

  // Overall stats
  const totalPassed = results.filter(r => r.outcome === "pass").length;
  const totalFailed = results.filter(r => r.outcome === "fail").length;

  const isLoading = resultsLoading || drivesLoading;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">
            Assessment Results
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Grouped by drive — ordered by start date
          </p>
        </div>
      </div>

      {/* Overall stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="card text-center">
          <p className="text-xs text-gray-500 mb-1">Total Results</p>
          <p className="text-2xl font-bold text-blue-600">
            {totalPassed + totalFailed}
          </p>
        </div>
        <div className="card text-center">
          <p className="text-xs text-gray-500 mb-1">Total Passed</p>
          <p className="text-2xl font-bold text-green-600">{totalPassed}</p>
        </div>
        <div className="card text-center">
          <p className="text-xs text-gray-500 mb-1">Total Failed</p>
          <p className="text-2xl font-bold text-red-500">{totalFailed}</p>
        </div>
      </div>

      {/* Status filter */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm text-gray-500 font-medium">Show:</span>
        {[
          { id: "active", label: "Active", color: "bg-green-600" },
          { id: "draft", label: "Draft", color: "bg-gray-500" },
          { id: "closed", label: "Closed", color: "bg-red-500" },
          { id: "all", label: "All", color: "bg-blue-600" },
        ].map(f => (
          <button
            key={f.id}
            onClick={() => setStatusFilter(f.id)}
            className={`flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-full border transition-colors ${
              statusFilter === f.id
                ? `${f.color} text-white border-transparent`
                : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"
            }`}
          >
            {f.label}
            <span className={`text-xs px-1.5 py-0.5 rounded-full ${
              statusFilter === f.id
                ? "bg-white bg-opacity-30 text-white"
                : "bg-gray-100 text-gray-600"
            }`}>
              {f.id === "all" ? drives.length : countByStatus[f.id] || 0}
            </span>
          </button>
        ))}
      </div>      

      {/* Drive result cards */}
      {isLoading ? (
        <div className="card text-center py-10 text-gray-500">
          Loading results...
        </div>
      ) : filteredDrives.length === 0 ? (
        <div className="card text-center py-10">
          <p className="text-gray-500 text-sm">
            No {statusFilter === "all" ? "" : statusFilter} drives found.
          </p>
          {statusFilter !== "all" && (
            <button
              onClick={() => setStatusFilter("all")}
              className="mt-2 text-xs text-blue-600 hover:underline"
            >
              Show all drives
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {filteredDrives.map(drive => (
            <DriveResultCard
              key={drive.id}
              drive={drive}
              results={results}
              registrations={registrations}
            />
          ))}
        </div>
      )}
    </div>
  );
}