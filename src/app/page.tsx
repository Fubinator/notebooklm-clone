import { ConfigurationRequired } from "@/components/configuration-required";
import { GuestGate } from "@/components/guest-gate";
import { NotebookWorkspace } from "@/components/notebook-workspace";
import { hasSupabaseEnvironment } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type HomeProps = {
  searchParams: Promise<{ notebook?: string | string[] }>;
};

export default async function Home({ searchParams }: HomeProps) {
  if (!hasSupabaseEnvironment()) {
    return <ConfigurationRequired />;
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return <GuestGate />;
  }

  const { data: notebooks, error } = await supabase
    .from("notebooks")
    .select("id, owner_id, is_example, title, created_at, updated_at")
    .order("updated_at", { ascending: false });
  const params = await searchParams;
  const requestedNotebook = Array.isArray(params.notebook)
    ? params.notebook[0]
    : params.notebook;

  return (
    <NotebookWorkspace
      guestId={user.id}
      initialNotebooks={notebooks ?? []}
      initialActiveId={requestedNotebook}
      initialError={
        error
          ? "Your Notebooks could not be loaded. Refresh to try again."
          : undefined
      }
    />
  );
}
