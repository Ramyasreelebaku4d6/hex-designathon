import client from "./client";

export const verifyVoucher = async (registrationId, voucherCode) => {
  const res = await client.post(
    `/api/exam/verify-voucher?registration_id=${registrationId}&voucher_code=${encodeURIComponent(voucherCode)}`
  );
  return res.data;
};

export const startExam = async (registrationId, voucherCode) => {
  const res = await client.post(
    `/api/exam/start?registration_id=${registrationId}&voucher_code=${encodeURIComponent(voucherCode)}`
  );
  return res.data;
};

export const submitExam = async (sessionId) => {
  const res = await client.post(`/api/exam/submit/${sessionId}`);
  return res.data;
};

export const getMyCertificates = async () => {
  const res = await client.get("/api/exam/certificates/my");
  return res.data;
};

export const completeCourse = async (registrationId) => {
  const res = await client.post(
    `/api/exam/complete-course?registration_id=${registrationId}`
  );
  return res.data;
};