import type { AuthConfig } from "./config";
import { getPilotAccessCookieMaxAge } from "./pilotAccess";
import { createSessionCookie, sessionCookieName } from "./sessionCookie";
import type { AppSession } from "./types";

type CookieWriter = {
  cookies: {
    set: (
      name: string,
      value: string,
      options: {
        httpOnly: boolean;
        secure: boolean;
        sameSite: "lax";
        path: string;
        maxAge: number;
      }
    ) => void;
  };
};

export function setPlatformSessionCookie(
  response: CookieWriter,
  session: AppSession,
  config: AuthConfig
) {
  response.cookies.set(
    sessionCookieName,
    createSessionCookie(session, config.sessionSecret),
    {
      httpOnly: true,
      secure: config.appUrl.startsWith("https://"),
      sameSite: "lax",
      path: "/",
      maxAge: getPilotAccessCookieMaxAge(session.expiresAt)
    }
  );
}
