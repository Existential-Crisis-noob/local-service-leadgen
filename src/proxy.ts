import { auth } from "@/auth";

export default auth((req) => {
  const { pathname } = req.nextUrl;

  const isPublicRoute =
    pathname.startsWith("/api/auth") || pathname.startsWith("/unsubscribe");
  const isAuthRoute = pathname.startsWith("/login") || pathname.startsWith("/signup");

  if (isPublicRoute) return;

  const isLoggedIn = !!req.auth;

  if (!isLoggedIn && !isAuthRoute) {
    const loginUrl = new URL("/login", req.nextUrl.origin);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return Response.redirect(loginUrl);
  }

  if (isLoggedIn && isAuthRoute) {
    return Response.redirect(new URL("/campaigns", req.nextUrl.origin));
  }
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
