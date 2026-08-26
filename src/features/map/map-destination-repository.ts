import type { ApiClient } from "@/src/lib/api/api-client";

import { createMapCoordinate } from "./map-projection";
import type { DestinationSuggestion } from "./map.types";

type PlaceSuggestionResponse = Readonly<{
  id: string;
  label: string;
  name: string;
  secondaryText?: string;
  latitude: number;
  longitude: number;
  country?: string;
  countryCode?: string;
}>;

export type MapDestinationRepository = Readonly<{
  search(query: string): Promise<readonly DestinationSuggestion[]>;
}>;

export function createMapDestinationRepository(apiClient: ApiClient): MapDestinationRepository {
  return {
    async search(query: string): Promise<readonly DestinationSuggestion[]> {
      const normalizedQuery = query.trim();
      if (!normalizedQuery) return [];

      const suggestions = await apiClient.request<PlaceSuggestionResponse[]>({
        path: `/places/suggestions?q=${encodeURIComponent(normalizedQuery)}`,
        kind: "json",
        auth: "required",
      });

      return suggestions.flatMap((suggestion) => {
        const coordinate = createMapCoordinate(suggestion.latitude, suggestion.longitude);
        if (!coordinate) return [];

        return [
          Object.freeze({
            id: suggestion.id,
            label: suggestion.name.trim() || suggestion.label,
            subtitle: suggestion.secondaryText?.trim() || suggestion.country?.trim() || null,
            countryCode: suggestion.countryCode?.trim().toUpperCase() || null,
            coordinate,
          }),
        ];
      });
    },
  };
}
