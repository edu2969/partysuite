import { useAutoSaveContext as useProviderAutoSaveContext } from "@/components/form/provider/AutoSaveProvider";

export function useAutoSaveContext() {
  return useProviderAutoSaveContext();
}