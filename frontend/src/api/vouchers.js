import client from "./client";

export const getVouchers = async () => {
  const res = await client.get("/api/vouchers/");
  return res.data;
};

export const addVoucherToPool = async (data) => {
  const res = await client.post("/api/vouchers/pool", data);
  return res.data;
};

export const revokeVoucher = async (id) => {
  const res = await client.patch(`/api/vouchers/${id}/revoke`);
  return res.data;
};

export const redeemVoucher = async (token) => {
  const res = await client.get(`/api/vouchers/redeem/${token}`);
  return res.data;
};