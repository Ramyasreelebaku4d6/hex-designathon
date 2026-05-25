import client from "./client";

export const getDrives = async () => {
  const res = await client.get("/api/drives/");
  return res.data;
};

export const getDrive = async (id) => {
  const res = await client.get(`/api/drives/${id}`);
  return res.data;
};

export const createDrive = async (data) => {
  const res = await client.post("/api/drives/", data);
  return res.data;
};

export const updateDrive = async (id, data) => {
  const res = await client.put(`/api/drives/${id}`, data);
  return res.data;
};

export const updateDriveStatus = async (id, status) => {
  const res = await client.patch(`/api/drives/${id}/status?status=${status}`);
  return res.data;
};