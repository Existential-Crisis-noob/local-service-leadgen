import { prisma } from "@/lib/prisma";
import { confirmUnsubscribeAction } from "./actions";

async function resolveEmail(token: string): Promise<{ email: string; businessName: string | null } | null> {
  const contact = await prisma.businessContact.findUnique({
    where: { id: token },
    include: { business: true },
  });
  if (!contact) return null;

  return { email: contact.email, businessName: contact.business.name };
}

export default async function UnsubscribePage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ done?: string }>;
}) {
  const { token } = await params;
  const { done } = await searchParams;

  if (done) {
    return (
      <div className="auth-shell">
        <div className="auth-card">
          <h1>You&apos;re unsubscribed</h1>
          <p className="subtitle">You won&apos;t receive any further emails from us.</p>
        </div>
      </div>
    );
  }

  const resolved = await resolveEmail(token);

  if (!resolved) {
    return (
      <div className="auth-shell">
        <div className="auth-card">
          <h1>Link not recognized</h1>
          <p className="subtitle">This unsubscribe link doesn&apos;t match an active address.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <h1>Unsubscribe</h1>
        <p className="subtitle">
          Confirm you&apos;d like to stop receiving emails at <strong>{resolved.email}</strong>
          {resolved.businessName ? ` (${resolved.businessName})` : ""}.
        </p>
        <form action={confirmUnsubscribeAction} className="auth-form">
          <input type="hidden" name="token" value={token} />
          <button type="submit">Confirm unsubscribe</button>
        </form>
      </div>
    </div>
  );
}
