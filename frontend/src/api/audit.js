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