"use client";

import { useEffect, useRef } from "react";
import { useMapsLibrary } from "@vis.gl/react-google-maps";
import { MapPin } from "lucide-react";

export interface LocationResult {
  name: string;
  lat: number;
  lng: number;
}

interface LocationSearchProps {
  placeholder?: string;
  onChange: (location: LocationResult | null) => void;
}

/** Uses the new PlaceAutocompleteElement API */
function PlacesAutocompleteInput({ onChange }: LocationSearchProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  // Wait for places library to load — returns null until ready
  const places = useMapsLibrary("places");

  useEffect(() => {
    if (!places || !containerRef.current) return;

    // Library is loaded — google.maps.places is now available
    const PlaceAutocomplete = (google.maps.places as any).PlaceAutocompleteElement;
    if (!PlaceAutocomplete) return;

    containerRef.current.innerHTML = "";

    const autocomplete = new PlaceAutocomplete({});

    autocomplete.addEventListener("gmp-placeselect", async (event: any) => {
      try {
        const place = event.place;
        if (place) {
          await place.fetchFields({ fields: ["displayName", "formattedAddress", "location"] });
          const location = place.location;
          if (location) {
            onChangeRef.current({
              name: place.formattedAddress || place.displayName || "",
              lat: location.lat(),
              lng: location.lng(),
            });
          } else {
            // Place selected but no coordinates — still save the name
            const name = place.formattedAddress || place.displayName || "";
            if (name) {
              onChangeRef.current({ name, lat: 0, lng: 0 });
            }
          }
        }
      } catch {
        // fetchFields failed — try to use whatever is available
        const place = event.place;
        const name = place?.formattedAddress || place?.displayName || "";
        if (name) {
          onChangeRef.current({ name, lat: 0, lng: 0 });
        }
      }
    });

    containerRef.current.appendChild(autocomplete as unknown as Node);

    return () => {
      if (containerRef.current) {
        containerRef.current.innerHTML = "";
      }
    };
  }, [places]);

  return (
    <div ref={containerRef} className="w-64" />
  );
}

/** Plain text fallback when Google Maps API isn't available */
function PlainInput({ placeholder, onChange }: LocationSearchProps) {
  return (
    <div className="relative">
      <MapPin className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
      <input
        type="text"
        placeholder={placeholder}
        className="flex h-9 w-64 rounded-md border border-input bg-transparent px-3 py-1 pl-9 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-ring"
        onChange={(e) => {
          if (e.target.value) {
            onChange({ name: e.target.value, lat: 0, lng: 0 });
          } else {
            onChange(null);
          }
        }}
      />
    </div>
  );
}

export function LocationSearch(props: LocationSearchProps) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  if (!apiKey) {
    return <PlainInput {...props} />;
  }

  return <PlacesAutocompleteInput {...props} />;
}
