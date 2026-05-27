export const msalConfig = {
  auth: {
    clientId: "cfb9d70e-f7bd-4a43-b6dc-a3d4e1483537",
    authority: "https://login.microsoftonline.com/f6af215d-d710-4ba0-95e8-1995245cd8cb",
    redirectUri: "http://localhost:5173/auth/callback",
    postLogoutRedirectUri: "http://localhost:5173/login",
    navigateToLoginRequestUrl: false,
  },
  cache: {
    cacheLocation: "sessionStorage",
    storeAuthStateInCookie: false,
  },
  system: {
    allowNativeBroker: false,
    windowHashTimeout: 60000,
    iframeHashTimeout: 6000,
    loadFrameTimeout: 0,
  }
};

export const loginRequest = {
  scopes: ["User.Read"],
};