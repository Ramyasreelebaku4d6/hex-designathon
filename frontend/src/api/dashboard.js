import client from "./client";

export const getAdminDashboard = async () => {
  const res = await client.get("/api/dashboard/admin");
  return res.data;
};

export const getCoordinatorDashboard = async () => {
  const res = await client.get("/api/dashboard/coordinator");
  return res.data;
};

export const getApproverDashboard = async () => {
  const res = await client.get("/api/dashboard/approver");
  return res.data;
};

export const getCandidateDashboard = async () => {
  const res = await client.get("/api/dashboard/candidate");
  return res.data;
};

export const getDashboardStats = async () => {
  const res = await client.get("/api/dashboard/stats");
  return res.data;
};

export const getDriveFunnel = async () => {
  const res = await client.get("/api/dashboard/drive-funnel");
  return res.data;
};

export const getPassFail = async () => {
  const res = await client.get("/api/dashboard/pass-fail");
  return res.data;
};