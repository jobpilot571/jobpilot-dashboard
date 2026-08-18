import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { withEmployeeSelectFallback, type Employee } from "@/lib/employees";

export function useEmployees() {
  return useQuery({
    queryKey: ["employees"],
    queryFn: async () =>
      withEmployeeSelectFallback(async (cols) => {
        const res = await supabase.from("employees").select(cols).order("name");
        return { data: (res.data ?? []) as Employee[], error: res.error };
      }),
  });
}
