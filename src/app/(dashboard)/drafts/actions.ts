"use server";

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getCurrentWorkspaceId } from "@/lib/workspace";

async function requireDraft(draftId: string) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const workspaceId = await getCurrentWorkspaceId(session.user.id);
  const draft = await prisma.draftEmail.findFirst({
    where: { id: draftId, business: { workspaceId } },
  });
  if (!draft) redirect("/drafts");

  return draft;
}

export async function saveDraftEditAction(formData: FormData) {
  const draftId = String(formData.get("draftId"));
  const draft = await requireDraft(draftId);

  const subject = String(formData.get("subject") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();

  await prisma.draftEmail.update({
    where: { id: draft.id },
    data: { subject, body, status: draft.status === "APPROVED" ? draft.status : "EDITED" },
  });

  redirect("/drafts");
}

export async function approveDraftAction(formData: FormData) {
  const draftId = String(formData.get("draftId"));
  await requireDraft(draftId);
  await prisma.draftEmail.update({ where: { id: draftId }, data: { status: "APPROVED" } });
  redirect("/drafts");
}

export async function rejectDraftAction(formData: FormData) {
  const draftId = String(formData.get("draftId"));
  await requireDraft(draftId);
  await prisma.draftEmail.update({ where: { id: draftId }, data: { status: "REJECTED" } });
  redirect("/drafts");
}
