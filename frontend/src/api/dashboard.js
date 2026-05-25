import client from "./client";

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