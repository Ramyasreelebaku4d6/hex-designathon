import client from "./client";

export const getRegistrations = async () => {
  const res = await client.get("/api/registrations/");
  return res.data;
};

export const createRegistration = async (data) => {
  const res = await client.post("/api/registrations/", data);
  return res.data;
};

export const getRegistrationStatus = async (id) => {
  const res = await client.get(`/api/registrations/${id}/status`);
  return res.data;
};

export const getRegistrationsByDrive = async () => {
  const res = await client.get("/api/registrations/by-drive");
  return res.data;
};