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
  const res = await client.patch(
    `/api/drives/${id}/status?status=${status}`
  );
  return res.data;
};

export const getCertVoucherStatus = async (driveId) => {
  const res = await client.get(
    `/api/drives/${driveId}/cert-voucher-status`
  );
  return res.data;
};

export const addVouchersForCert = async (driveId, certId, vouchers) => {
  const res = await client.post(
    `/api/drives/${driveId}/certifications/${certId}/vouchers`,
    { cert_id: certId, vouchers }
  );
  return res.data;
};

export const removeCertFromDrive = async (driveId, certId) => {
  const res = await client.delete(
    `/api/drives/${driveId}/certifications/${certId}`
  );
  return res.data;
};

export const addDriveBudget = async (driveId, amount) => {
  const res = await client.post(
    `/api/drives/${driveId}/budget/add`,
    { amount }
  );
  return res.data;
};