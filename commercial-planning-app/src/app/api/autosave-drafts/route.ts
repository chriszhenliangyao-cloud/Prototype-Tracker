import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth/server";
import { canViewAllCountries } from "@/lib/auth/roles";
import {
  expiresAtFrom,
  isAutosaveSnapshot,
  isAutosaveWorkspace,
  normalizeAutosaveScope,
  parseAutosaveSnapshot,
  serializeAutosaveSnapshot,
  type AutosaveDraftRecord
} from "@/lib/autosaveDrafts";
import { prisma } from "@/lib/prisma";
import { getReferenceData, getUserCountryAccesses } from "@/lib/data";
import {
  getAccessibleCountryCodes,
  getEffectivePromotionPlanRole
} from "@/lib/promotionPlanAccess";
import type { AppSession } from "@/lib/auth/types";

export const dynamic = "force-dynamic";

type SaveBody = {
  workspace?: unknown;
  scope?: unknown;
  snapshot?: unknown;
  baseRevision?: unknown;
  force?: unknown;
};

function unauthorized() {
  return NextResponse.json({ message: "Your session has expired." }, { status: 401 });
}

function draftResponse(draft: {
  workspace: string;
  scope: string;
  payload: string;
  revision: number;
  updatedAt: Date;
  expiresAt: Date;
}): AutosaveDraftRecord | null {
  const snapshot = parseAutosaveSnapshot(draft.payload);
  if (!snapshot || !isAutosaveWorkspace(draft.workspace)) return null;
  return {
    workspace: draft.workspace,
    scope: draft.scope,
    snapshot,
    revision: draft.revision,
    updatedAt: draft.updatedAt.toISOString(),
    expiresAt: draft.expiresAt.toISOString()
  };
}

function readKey(searchParams: URLSearchParams) {
  const workspace = searchParams.get("workspace");
  const scope = searchParams.get("scope");
  if (!isAutosaveWorkspace(workspace)) return null;
  const normalizedScope = normalizeAutosaveScope(scope);
  return normalizedScope ? { workspace, scope: normalizedScope } : null;
}

function countriesInScopedDraft(workspace: string, scope: string) {
  if (workspace === "BUSINESS_PLAN") {
    const [, countryCode] = scope.split(":");
    return countryCode ? [countryCode] : [];
  }
  if (workspace === "PROMOTION_PLAN") {
    const [, , countryCodes] = scope.split(":");
    return countryCodes ? countryCodes.split(",").filter(Boolean) : [];
  }
  return [];
}

async function canAccessDraftScope(
  session: AppSession,
  workspace: string,
  scope: string
) {
  const requestedCountryCodes = countriesInScopedDraft(workspace, scope)
    .map((countryCode) => countryCode.toUpperCase());
  if (requestedCountryCodes.length === 0) return true;

  const [data, accessRows] = await Promise.all([
    getReferenceData(),
    getUserCountryAccesses()
  ]);
  const role = getEffectivePromotionPlanRole(session.role, session.email, accessRows);
  if (requestedCountryCodes.includes("ALL")) {
    return canViewAllCountries(role);
  }
  const accessible = new Set(
    getAccessibleCountryCodes(role, session.email, accessRows, data.countries)
  );
  return requestedCountryCodes.every((countryCode) => accessible.has(countryCode));
}

export async function GET(request: NextRequest) {
  const session = await getCurrentSession();
  if (!session?.email) return unauthorized();
  const key = readKey(request.nextUrl.searchParams);
  if (!key) return NextResponse.json({ message: "Invalid autosave draft scope." }, { status: 400 });
  if (!(await canAccessDraftScope(session, key.workspace, key.scope))) {
    return NextResponse.json({ message: "You do not have access to this autosave draft." }, { status: 403 });
  }

  const existing = await prisma.autosaveDraft.findUnique({
    where: {
      userEmail_workspace_scope: {
        userEmail: session.email.toLowerCase(),
        workspace: key.workspace,
        scope: key.scope
      }
    }
  });
  if (!existing) return NextResponse.json({ draft: null });
  if (existing.expiresAt <= new Date()) {
    await prisma.autosaveDraft.delete({ where: { id: existing.id } });
    return NextResponse.json({ draft: null });
  }

  const draft = draftResponse(existing);
  if (!draft) {
    await prisma.autosaveDraft.delete({ where: { id: existing.id } });
    return NextResponse.json({ draft: null });
  }
  return NextResponse.json({ draft });
}

export async function PUT(request: NextRequest) {
  const session = await getCurrentSession();
  if (!session?.email) return unauthorized();

  let body: SaveBody;
  try {
    body = (await request.json()) as SaveBody;
  } catch {
    return NextResponse.json({ message: "Invalid autosave draft payload." }, { status: 400 });
  }

  if (!isAutosaveWorkspace(body.workspace) || !isAutosaveSnapshot(body.snapshot)) {
    return NextResponse.json({ message: "Invalid autosave draft." }, { status: 400 });
  }
  const scope = normalizeAutosaveScope(body.scope);
  if (!scope) return NextResponse.json({ message: "Invalid autosave draft scope." }, { status: 400 });
  if (!(await canAccessDraftScope(session, body.workspace, scope))) {
    return NextResponse.json({ message: "You do not have access to this autosave draft." }, { status: 403 });
  }
  const baseRevision = Number(body.baseRevision ?? 0);
  if (!Number.isInteger(baseRevision) || baseRevision < 0) {
    return NextResponse.json({ message: "Invalid autosave draft revision." }, { status: 400 });
  }

  let payload: string;
  try {
    payload = serializeAutosaveSnapshot(body.snapshot);
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Autosave draft is too large." },
      { status: 413 }
    );
  }

  const userEmail = session.email.toLowerCase();
  const key = { userEmail, workspace: body.workspace, scope };
  let current = await prisma.autosaveDraft.findUnique({
    where: { userEmail_workspace_scope: key }
  });

  const now = new Date();
  if (current?.expiresAt && current.expiresAt <= now) {
    await prisma.autosaveDraft.delete({ where: { id: current.id } });
    current = null;
  }

  if (current && current.revision !== baseRevision && body.force !== true) {
    return NextResponse.json(
      { message: "A newer unfinished draft is available.", draft: draftResponse(current) },
      { status: 409 }
    );
  }

  const expiresAt = expiresAtFrom(now);
  if (!current) {
    try {
      const created = await prisma.autosaveDraft.create({
        data: { ...key, payload, revision: 1, expiresAt }
      });
      return NextResponse.json({ draft: draftResponse(created) });
    } catch {
      const newer = await prisma.autosaveDraft.findUnique({
        where: { userEmail_workspace_scope: key }
      });
      return NextResponse.json(
        { message: "A newer unfinished draft is available.", draft: newer ? draftResponse(newer) : null },
        { status: 409 }
      );
    }
  }

  const updated = await prisma.autosaveDraft.update({
    where: { id: current.id },
    data: { payload, revision: current.revision + 1, expiresAt, updatedAt: now }
  });
  return NextResponse.json({ draft: draftResponse(updated) });
}

export async function DELETE(request: NextRequest) {
  const session = await getCurrentSession();
  if (!session?.email) return unauthorized();
  const key = readKey(request.nextUrl.searchParams);
  if (!key) return NextResponse.json({ message: "Invalid autosave draft scope." }, { status: 400 });
  if (!(await canAccessDraftScope(session, key.workspace, key.scope))) {
    return NextResponse.json({ message: "You do not have access to this autosave draft." }, { status: 403 });
  }
  await prisma.autosaveDraft.deleteMany({
    where: {
      userEmail: session.email.toLowerCase(),
      workspace: key.workspace,
      scope: key.scope
    }
  });
  return NextResponse.json({ ok: true });
}
