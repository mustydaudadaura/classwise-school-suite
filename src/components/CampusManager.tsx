import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Pencil, Check, X } from "lucide-react";
import { toast } from "sonner";
import { requireSavedRecord } from "@/lib/registry-save";

export function CampusManager({ schoolId }: { schoolId: string }) {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editAddress, setEditAddress] = useState("");
  const [saving, setSaving] = useState(false);

  const { data } = useQuery({
    queryKey: ["campuses", schoolId],
    queryFn: async () =>
      (await supabase.from("campuses").select("*").eq("school_id", schoolId).order("name")).data ?? [],
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ["campuses", schoolId] });

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    const { data: saved, error } = await supabase
      .from("campuses")
      .insert({ school_id: schoolId, name: name.trim(), address: address.trim() || null })
      .select("id, school_id")
      .single();
    if (error) return toast.error(error.message);
    requireSavedRecord(saved, schoolId);
    setName("");
    setAddress("");
    toast.success("Campus added");
    refresh();
  };

  const saveEdit = async (campusId: string) => {
    if (!editName.trim() || saving) return;
    setSaving(true);
    try {
      const { data: saved, error } = await supabase
        .from("campuses")
        .update({ name: editName.trim(), address: editAddress.trim() || null })
        .eq("id", campusId)
        .eq("school_id", schoolId)
        .select("id, school_id, name")
        .single();
      if (error) throw error;
      requireSavedRecord(saved, schoolId);
      toast.success("Campus updated");
      setEditingId(null);
      refresh();
    } catch (err: any) {
      toast.error(err?.message || "Could not update campus");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <form onSubmit={add} className="flex flex-wrap gap-2">
        <Input
          required
          placeholder="Campus name (e.g. Main Campus)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="min-w-48 flex-1"
        />
        <Input
          placeholder="Address"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          className="min-w-48 flex-1"
        />
        <Button type="submit">Add campus</Button>
      </form>
      {data?.length ? (
        data.map((c) => {
          const isEditing = editingId === c.id;
          return (
            <div key={c.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border p-3">
              {isEditing ? (
                <div className="flex flex-1 flex-wrap items-center gap-2">
                  <Input
                    required
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    placeholder="Campus name"
                    className="h-8 min-w-40 flex-1 text-sm"
                  />
                  <Input
                    value={editAddress}
                    onChange={(e) => setEditAddress(e.target.value)}
                    placeholder="Address"
                    className="h-8 min-w-40 flex-1 text-sm"
                  />
                  <Button size="sm" disabled={saving || !editName.trim()} onClick={() => saveEdit(c.id)}>
                    <Check className="mr-1 h-3.5 w-3.5" /> Save
                  </Button>
                  <Button size="sm" variant="ghost" disabled={saving} onClick={() => setEditingId(null)}>
                    <X className="mr-1 h-3.5 w-3.5" /> Cancel
                  </Button>
                </div>
              ) : (
                <>
                  <div>
                    <p className="font-medium">{c.name}</p>
                    <p className="text-sm text-muted-foreground">{c.address ?? "—"}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="icon"
                      variant="ghost"
                      title={`Edit ${c.name}`}
                      aria-label={`Edit ${c.name}`}
                      onClick={() => {
                        setEditingId(c.id);
                        setEditName(c.name ?? "");
                        setEditAddress(c.address ?? "");
                      }}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Switch
                      checked={c.active}
                      onCheckedChange={async (v) => {
                        const { error } = await supabase
                          .from("campuses")
                          .update({ active: v })
                          .eq("id", c.id)
                          .eq("school_id", schoolId);
                        if (error) toast.error(error.message);
                        refresh();
                      }}
                    />
                  </div>
                </>
              )}
            </div>
          );
        })
      ) : (
        <p className="text-sm text-muted-foreground">No campuses yet. Single-site schools can skip this.</p>
      )}
    </div>
  );
}
