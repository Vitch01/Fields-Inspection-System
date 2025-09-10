import { MapPin, Clock } from "lucide-react";

interface LocationData {
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: string;
}

interface InspectorLocationProps {
  location: LocationData | null;
}

export default function InspectorLocation({ location }: InspectorLocationProps) {
  if (!location) {
    return (
      <div className="bg-muted/50 border border-border rounded-lg p-3">
        <div className="flex items-center space-x-2 text-muted-foreground">
          <MapPin className="w-4 h-4" />
          <span className="text-sm">Inspector location not available</span>
        </div>
      </div>
    );
  }

  const formatCoordinates = (lat: number, lng: number) => {
    return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const openInMaps = () => {
    const url = `https://www.google.com/maps?q=${location.latitude},${location.longitude}`;
    window.open(url, '_blank');
  };

  return (
    <div className="bg-muted/50 border border-border rounded-lg p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center space-x-2">
          <MapPin className="w-4 h-4 text-blue-600" />
          <span className="text-sm font-medium">Inspector Location</span>
        </div>
        <button
          onClick={openInMaps}
          className="text-xs text-blue-600 hover:text-blue-800 underline"
          data-testid="button-view-on-maps"
        >
          View on Maps
        </button>
      </div>
      
      <div className="space-y-1 text-xs text-muted-foreground">
        <div>
          <strong>Coordinates:</strong> {formatCoordinates(location.latitude, location.longitude)}
        </div>
        <div>
          <strong>Accuracy:</strong> ±{Math.round(location.accuracy)}m
        </div>
        <div className="flex items-center space-x-1">
          <Clock className="w-3 h-3" />
          <span>Captured at {formatTimestamp(location.timestamp)}</span>
        </div>
      </div>
    </div>
  );
}