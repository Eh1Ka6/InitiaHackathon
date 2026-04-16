import { useQuery } from "@tanstack/react-query";
import { api } from "../services/api";

export function useWager(id: number) {
  return useQuery({
    queryKey: ["wager", id],
    queryFn: () => api.getWager(id),
    refetchInterval: 5000, // Poll every 5s for status updates
  });
}

export function useUserWagers(telegramId: string) {
  return useQuery({
    queryKey: ["wagers", telegramId],
    queryFn: () => api.getUserWagers(telegramId),
    enabled: !!telegramId,
  });
}
