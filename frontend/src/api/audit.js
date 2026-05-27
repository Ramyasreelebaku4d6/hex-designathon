import client from "./client";

export const getAuditLogs = async (entityType = null) => {
  const url = entityType
    ? `/api/audit/logs?entity_type=${entityType}`
    : "/api/audit/logs";
  const res = await client.get(url);
  return res.data;
};

export const nlQuery = async (question) => {
  const res = await client.post("/api/audit/query", { question });
  return res.data;
};

export const draftEmail = async (registrationId, context) => {
  const res = await client.post("/api/audit/draft-email", {
    registration_id: registrationId,
    context,
  });
  return res.data;
};

export const getDriveAuditLogs = async (fromDate, toDate) => {
  const params = new URLSearchParams();
  if (fromDate) params.append("from_date", fromDate);
  if (toDate) params.append("to_date", toDate);
  const res = await client.get(`/api/audit/drive-logs?${params.toString()}`);
  return res.data;
};