import client from "./client";

export const getEligibilityGrouped = async () => {
  const res = await client.get("/api/eligibility/");
  return res.data;
};

export const evaluateEligibility = async (regId) => {
  const res = await client.post(`/api/eligibility/evaluate/${regId}`);
  return res.data;
};

export const approveEligibility = async (eligId, data) => {
  const res = await client.put(`/api/eligibility/${eligId}/approve`, data);
  return res.data;
};
