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

export const downloadCertificate = async (certificateId) => {
  const res = await client.get(
    `/api/exam/certificates/${certificateId}/download`,
    { responseType: "blob" }
  );
  // Create download link
  const url = window.URL.createObjectURL(new Blob([res.data]));
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", `certificate_${certificateId.slice(0, 8)}.pdf`);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
};