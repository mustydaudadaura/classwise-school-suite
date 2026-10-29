import { useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { ACTIVE_SCHOOL_KEY } from "@/lib/school-access";
import type { Database } from "@/integrations/supabase/types";

type AppRole = Database["public"]["Enums"]["app_role"];

export interface AuthState {
  user: User | null;
  session: Session | null;
  loading: boolean;
  roles: AppRole[];
  schoolId: string | null;
  fullName: string | null;
}

export function useAuth(): AuthState {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [schoolId, setSchoolId] = useState<string | null>(null);
  const [fullName, setFullName] = useState<string | null>(null);

  useEffect(() => {
    const onAuthChange = () => checkRemoteSession();

    const checkRemoteSession = () => {
      supabase.auth.getSession().then(async ({ data }) => {
        const sess = data.session;
        setSession(sess);
        if (sess?.user) {
          await loadProfile(sess.user.id, sess.user);
        } else {
          setRoles([]);
          setSchoolId(null);
          setFullName(null);
        }
        setLoading(false);
      }).catch((err) => {
        console.warn("Supabase auth session check offline:", err);
        setLoading(false);
      });
    };

    let subscription: { unsubscribe: () => void } | undefined;
    try {
      const res = supabase.auth.onAuthStateChange((_e, s) => {
        setSession(s);
        if (s?.user) {
          setTimeout(() => loadProfile(s.user.id, s.user), 0);
        } else {
          setRoles([]); setSchoolId(null); setFullName(null);
        }
      });
      subscription = res.data.subscription;
    } catch (err) {
      console.warn("Failed to subscribe to auth state changes:", err);
    }

    checkRemoteSession();

    const refresh = () => {
      supabase.auth.getUser().then(({ data }) => {
        if (data.user) loadProfile(data.user.id, data.user);
      }).catch(() => {});
    };

    window.addEventListener("school-selection", refresh);
    window.addEventListener("eduerp-auth-change", onAuthChange);
    window.addEventListener("storage", onAuthChange);

    return () => {
      subscription?.unsubscribe();
      window.removeEventListener("school-selection", refresh);
      window.removeEventListener("eduerp-auth-change", onAuthChange);
      window.removeEventListener("storage", onAuthChange);
    };
  }, []);

  const loadProfile = async (userId: string, userObj?: User | null) => {
    try {
      const [profileResult, roleResult] = await Promise.all([
        supabase.from("profiles").select("full_name, school_id").eq("user_id", userId).maybeSingle(),
        supabase.from("user_roles").select("role, school_id").eq("user_id", userId),
      ]);

      if (profileResult.error) throw profileResult.error;
      if (roleResult.error) throw roleResult.error;
      const fetchedRoles = roleResult.data?.map((r) => r.role) ?? [];
      const isSuper = fetchedRoles.includes("super_admin");
      const selected = localStorage.getItem(ACTIVE_SCHOOL_KEY);
      let targetSchoolId = profileResult.data?.school_id ?? roleResult.data?.find((r) => r.school_id)?.school_id ?? null;
      if (isSuper && selected) {
        const { data: selectedSchool, error } = await supabase.from("schools").select("id").eq("id", selected).maybeSingle();
        if (error) throw error;
        if (selectedSchool) targetSchoolId = selectedSchool.id;
      }
      setFullName(profileResult.data?.full_name ?? userObj?.user_metadata?.full_name ?? null);
      setSchoolId(targetSchoolId);
      setRoles(fetchedRoles);
    } catch (err) {
      console.warn("Could not fetch remote profile:", err);
      setRoles([]);
      setFullName(null);
      setSchoolId(null);
    }
  };

  return { user: session?.user ?? null, session, loading, roles, schoolId, fullName };
}

export const hasRole = (roles: AppRole[], ...check: AppRole[]) =>
  roles.some((r) => check.includes(r));
