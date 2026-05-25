import client from "./client";

export const login = async (email, password) => {
  const res = await client.post("/api/auth/login", { email, password });
  return res.data;
};

export const register = async (data) => {
  const res = await client.post("/api/auth/register", data);
  return res.data;
};