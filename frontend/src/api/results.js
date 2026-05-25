import client from "./client";

export const getResults = async () => {
  const res = await client.get("/api/results/");
  return res.data;
};

export const createResult = async (data) => {
  const res = await client.post("/api/results/", data);
  return res.data;
};