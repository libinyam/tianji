import cloudbase from "@cloudbase/js-sdk";

// CloudBase 环境配置
const ENV_ID = "tianji-d3gozv3qr802e49cb";
const REGION = "ap-shanghai";
const ACCESS_KEY =
  "eyJhbGciOiJSUzI1NiIsImtpZCI6IjlkMWRjMzFlLWI0ZDAtNDQ4Yi1hNzZmLWIwY2M2M2Q4MTQ5OCJ9.eyJpc3MiOiJodHRwczovL3RpYW5qaS1kM2dvenYzcXI4MDJlNDljYi5hcC1zaGFuZ2hhaS50Y2ItYXBpLnRlbmNlbnRjbG91ZGFwaS5jb20iLCJzdWIiOiJhbm9uIiwiYXVkIjoidGlhbmppLWQzZ296djNxcjgwMmU0OWNiIiwiZXhwIjo0MDg1NzI1MjUxLCJpYXQiOjE3ODIwNDIwNTEsIm5vbmNlIjoiZWRDSFlrTERSd3VaVUtvd2lGMjhsQSIsImF0X2hhc2giOiJlZENIWWtMRFJ3dVpVS293aUYyOGxBIiwibmFtZSI6IkFub255bW91cyIsInNjb3BlIjoiYW5vbnltb3VzIiwicHJvamVjdF9pZCI6InRpYW5qaS1kM2dvenYzcXI4MDJlNDljYiIsIm1ldGEiOnsicGxhdGZvcm0iOiJQdWJsaXNoYWJsZUtleSJ9LCJ1c2VyX3R5cGUiOiIiLCJjbGllbnRfdHlwZSI6ImNsaWVudF91c2VyIiwiaXNfc3lzdGVtX2FkbWluIjpmYWxzZX0.KczjE4Xk5ltUQvlbS6Am2Eeixdg1wyhHXOzrhZCCJNz_tLU_w9F6j21xNvwME-5II-DJOnassDJ24UZTcaLZsShfZeee4_xn0FssjfzsoBm0QVwd7lHQeEOfUhZXU3WwCfPj_X6IEZ3wVmZlI7AMPl8PzygFZj0dHK4gwU17O19VDVkjQbr8SYcrb9rRhco5VZmsG5Yg5deAEJwfSEZprLV3MEqMJHufD5PfV68arHj0yI6oogkEXD7dzxpmTj3HaPwTOkBbivhK0VFwsGSZOYRv2R9cJWy6XLV3H0Ep9Dvo5pYOlLpiyN_k6lMYuhX_viOYbVyQamWSXxQv8IMTQA";

/** CloudBase 应用单例 */
const app = cloudbase.init({
  env: ENV_ID,
  region: REGION,
  accessKey: ACCESS_KEY,
  auth: { detectSessionInUrl: true },
});

/** Auth 实例，本地持久化登录态 */
const auth = app.auth({ persistence: "local" });

export { app, auth, ENV_ID };
