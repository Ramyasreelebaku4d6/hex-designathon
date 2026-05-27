import client from "./client";

export const generateSlots = async (driveId) => {
  const res = await client.post(`/api/slots/drives/${driveId}/generate`);
  return res.data;
};

export const getDriveSlots = async (driveId) => {
  const res = await client.get(`/api/slots/drives/${driveId}`);
  return res.data;
};

export const checkAlreadyApplied = async (driveId) => {
  const res = await client.get(`/api/registrations/check/${driveId}`);
  return res.data;
};