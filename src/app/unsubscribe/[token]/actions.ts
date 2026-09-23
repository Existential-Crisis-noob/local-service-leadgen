"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

export async function confirmUnsubscribeAction(formData: FormData) {
  const token = String(formData.get("token") ?? "");
  const contact = await prisma.businessContact.findUnique({ where: { id: token } });
  if (!contact) redirect(`/unsubscribe/${token}`);

  await prisma.unsubscribe.upsert({
    where: { email: contact.email },
    create: { email: contact.email, reason: "Recipient request" },
    update: {},
  });

  redirect(`/unsubscribe/${token}?done=1`);
}
