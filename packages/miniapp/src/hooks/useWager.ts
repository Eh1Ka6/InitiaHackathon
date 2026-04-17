import { useQuery } from "@tanstack/react-query";
import { api } from "../services/api";

export function useWager(id: number) {
  return useQuery({
    queryKey: ["wager", id],
    queryFn: () => api.getWager(id),
    enabled: id > 0,
    refetchInterval: 5000,
  });
}

export function useUserWagers(telegramId: string) {
  return useQuery({
    queryKey: ["wagers", telegramId],
    queryFn: () => api.getUserWagers(telegramId),
    enabled: !!telegramId,
  });
}
