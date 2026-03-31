"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useMapsLibrary } from "@vis.gl/react-google-maps";
import { Input } from "@/components/ui/input";
import { MapPin, Loader2 } from "lucide-react";

export interface PlaceResult {
  name: string;
  lat: number;
  lng: number;
}

interface PlacesAutocompleteInputProps {
  value: string;
  onChange: (value: string) => void;
  onPlaceSelect: (place: PlaceResult) => void;
  placeholder?: string;
  id?: string;
  maxLength?: number;
}

/**
 * A controlled text input with Google Places autocomplete suggestions.
 * Uses AutocompleteService + PlacesService (not PlaceAutocompleteElement),
 * so the dropdown is rendered by us and works inside Radix Dialog portals.
 */
export function PlacesAutocompleteInput({
  value,
  onChange,
  onPlaceSelect,
  placeholder,
  id,
  maxLength,
}: PlacesAutocompleteInputProps) {
  const places = useMapsLibrary("places");
  const [predictions, setPredictions] = useState<google.maps.places.AutocompletePrediction[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const autocompleteService = useRef<google.maps.places.AutocompleteService | null>(null);
  const placesService = useRef<google.maps.places.PlacesService | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceTimer = useRef<ReturnType<typeof setTimeout>>(null);

  // Initialize services once the places library loads
  useEffect(() => {
    if (!places) return;
    autocompleteService.current = new google.maps.places.AutocompleteService();
    // PlacesService needs an element (can be a hidden div)
    const el = document.createElement("div");
    placesService.current = new google.maps.places.PlacesService(el);
  }, [places]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const fetchPredictions = useCallback(
    (input: string) => {
      if (!autocompleteService.current || input.trim().length < 2) {
        setPredictions([]);
        setIsOpen(false);
        return;
      }
      setIsLoading(true);
      autocompleteService.current.getPlacePredictions(
        { input },
        (results, status) => {
          setIsLoading(false);
          if (status === google.maps.places.PlacesServiceStatus.OK && results) {
            setPredictions(results);
            setIsOpen(true);
            setActiveIndex(-1);
          } else {
            setPredictions([]);
            setIsOpen(false);
          }
        }
      );
    },
    []
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    onChange(val);

    // Debounce API calls
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => fetchPredictions(val), 300);
  };

  const selectPrediction = (prediction: google.maps.places.AutocompletePrediction) => {
    if (!placesService.current) return;

    placesService.current.getDetails(
      { placeId: prediction.place_id, fields: ["formatted_address", "geometry"] },
      (place, status) => {
        if (status === google.maps.places.PlacesServiceStatus.OK && place?.geometry?.location) {
          const result: PlaceResult = {
            name: place.formatted_address || prediction.description,
            lat: place.geometry.location.lat(),
            lng: place.geometry.location.lng(),
          };
          onChange(result.name);
          onPlaceSelect(result);
        } else {
          onChange(prediction.description);
        }
        setPredictions([]);
        setIsOpen(false);
      }
    );
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen || predictions.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => (i < predictions.length - 1 ? i + 1 : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => (i > 0 ? i - 1 : predictions.length - 1));
    } else if (e.key === "Enter" && activeIndex >= 0) {
      e.preventDefault();
      selectPrediction(predictions[activeIndex]);
    } else if (e.key === "Escape") {
      setIsOpen(false);
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <MapPin className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
        <Input
          id={id}
          value={value}
          onChange={handleInputChange}
          onFocus={() => predictions.length > 0 && setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          maxLength={maxLength}
          className="pl-9"
          autoComplete="off"
        />
        {isLoading && (
          <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
        )}
      </div>

      {isOpen && predictions.length > 0 && (
        <div className="absolute z-[9999] mt-1 w-full rounded-md border bg-popover shadow-lg overflow-hidden">
          {predictions.map((prediction, index) => (
            <button
              key={prediction.place_id}
              type="button"
              className={`w-full text-left px-3 py-2 text-sm transition-colors hover:bg-accent ${
                index === activeIndex ? "bg-accent" : ""
              }`}
              onMouseEnter={() => setActiveIndex(index)}
              onClick={() => selectPrediction(prediction)}
            >
              <span className="flex items-start gap-2">
                <MapPin className="h-3.5 w-3.5 mt-0.5 shrink-0 text-muted-foreground" />
                <span>
                  <span className="font-medium">
                    {prediction.structured_formatting.main_text}
                  </span>
                  {prediction.structured_formatting.secondary_text && (
                    <span className="text-muted-foreground">
                      {" "}
                      {prediction.structured_formatting.secondary_text}
                    </span>
                  )}
                </span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Plain text fallback when Google Maps API is not available.
 */
export function PlainLocationInput({
  value,
  onChange,
  placeholder,
  id,
  maxLength,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  id?: string;
  maxLength?: number;
}) {
  return (
    <div className="relative">
      <MapPin className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
      <Input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        maxLength={maxLength}
        className="pl-9"
      />
    </div>
  );
}
