import client from "./client";

export const verifyMicrosoftToken = async (accessToken) => {
  const res = await client.post(
    "/api/auth/microsoft/verify-token",
    { access_token: accessToken }
  );
  return res.data;
};