import Link from "next/link";
import { registerAction } from "../actions";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <div className="auth-card">
      <h1>Create your account</h1>
      {error && <p className="auth-error">{error}</p>}

      <form action={registerAction} className="auth-form">
        <label>
          Name
          <input name="name" type="text" required autoComplete="name" />
        </label>
        <label>
          Email
          <input name="email" type="email" required autoComplete="email" />
        </label>
        <label>
          Password
          <input
            name="password"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
          />
        </label>
        <button type="submit">Create account</button>
      </form>

      <p className="auth-footnote">
        Already have an account? <Link href="/login">Sign in</Link>
      </p>
    </div>
  );
}
