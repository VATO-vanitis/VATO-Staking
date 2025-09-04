// lib/react-query.ts
import { QueryClient } from "@tanstack/react-query";

// Singleton to avoid re-creation loops
export const queryClient = new QueryClient();
