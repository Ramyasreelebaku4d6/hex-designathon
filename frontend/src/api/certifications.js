import client from "./client";

export const searchCertifications = async (search = "") => {
  const res = await client.get(`/api/certifications/?search=${search}`);
  return res.data;
};

export const getDriveCertifications = async (driveId) => {
  const res = await client.get(`/api/certifications/drives/${driveId}`);
  return res.data;
};

export const addCertificationToDrive = async (driveId, data) => {
  const res = await client.post(`/api/certifications/drives/${driveId}`, data);
  return res.data;
};

export const removeCertFromDrive = async (driveId, certId) => {
  const res = await client.delete(
    `/api/certifications/drives/${driveId}/${certId}`
  );
  return res.data;
};