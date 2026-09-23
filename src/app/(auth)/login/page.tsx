import Link from "next/link";
import { loginWithCredentials, loginWithGoogle } from "../actions";
import { env } from "@/lib/env";

function errorMessage(code?: string) {
  if (!code) return null;
  if (code === "CredentialsSignin") return "Incorrect email or password.";
  return "Something went wrong signing you in. Please try again.";
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const message = errorMessage(error);
  const googleEnabled = Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);

  return (
    <div className="auth-card">
      <h1>Sign in</h1>
      {message && <p className="auth-error">{message}</p>}

      <form action={loginWithCredentials} className="auth-form">
        <label>
          Email
          <input name="email" type="email" required autoComplete="email" />
        </label>
        <label>
          Password
          <input name="password" type="password" required autoComplete="current-password" />
        </label>
        <button type="submit">Sign in</button>
      </form>

      {googleEnabled && (
        <form action={loginWithGoogle} className="auth-form">
          <button type="submit" className="auth-secondary">
            Sign in with Google
          </button>
        </form>
      )}

      <p className="auth-footnote">
        No account? <Link href="/signup">Sign up</Link>
      </p>
    </div>
  );
}
