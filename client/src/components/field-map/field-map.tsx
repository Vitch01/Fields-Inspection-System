import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { MapPin, Phone, X } from 'lucide-react';

interface Inspector {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  status: 'available' | 'busy' | 'offline';
  specialization?: string;
}

interface FieldMapProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectInspector: (inspector: Inspector) => void;
  currentCallInspectorId?: string;
}

const MOCK_INSPECTORS: Inspector[] = [
  {
    id: "inspector1-id",
    name: "John Martinez",
    latitude: 37.104181,
    longitude: -113.585664,
    status: 'available',
    specialization: 'Electrical Systems'
  },
  {
    id: "inspector2-id", 
    name: "Maria Garcia",
    latitude: 37.106181,
    longitude: -113.583664,
    status: 'available',
    specialization: 'Structural Engineering'
  },
  {
    id: "inspector3-id",
    name: "David Chen",
    latitude: 37.102181,
    longitude: -113.587664,
    status: 'busy',
    specialization: 'HVAC Systems'
  },
  {
    id: "inspector4-id",
    name: "Sarah Johnson",
    latitude: 37.108181,
    longitude: -113.581664,
    status: 'available',
    specialization: 'Safety Compliance'
  }
];

export function FieldMap({ isOpen, onClose, onSelectInspector, currentCallInspectorId }: FieldMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const googleMapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);
  const [selectedInspector, setSelectedInspector] = useState<Inspector | null>(null);
  const [isMapLoaded, setIsMapLoaded] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    // Load Google Maps Script
    if (!window.google) {
      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${import.meta.env.VITE_GOOGLE_MAPS_API_KEY}&libraries=geometry`;
      script.async = true;
      script.onload = initializeMap;
      document.head.appendChild(script);
    } else {
      initializeMap();
    }
  }, [isOpen]);

  const initializeMap = () => {
    if (!mapRef.current || !window.google) return;

    // Initialize map centered on the field location
    const map = new google.maps.Map(mapRef.current, {
      center: { lat: 37.104181, lng: -113.585664 },
      zoom: 15,
      mapTypeId: google.maps.MapTypeId.SATELLITE,
      styles: [
        {
          featureType: "poi",
          elementType: "labels",
          stylers: [{ visibility: "off" }]
        }
      ]
    });

    googleMapRef.current = map;

    // Add field boundary from the provided Google Maps data
    // This is a simplified version - in a real app, you'd load the actual KML/GeoJSON
    const fieldBoundary = new google.maps.Polygon({
      paths: [
        { lat: 37.103, lng: -113.588 },
        { lat: 37.105, lng: -113.588 },
        { lat: 37.105, lng: -113.583 },
        { lat: 37.103, lng: -113.583 }
      ],
      strokeColor: '#FF0000',
      strokeOpacity: 0.8,
      strokeWeight: 2,
      fillColor: '#FF0000',
      fillOpacity: 0.1,
    });

    fieldBoundary.setMap(map);

    // Add inspector markers
    addInspectorMarkers(map);
    setIsMapLoaded(true);
  };

  const addInspectorMarkers = (map: google.maps.Map) => {
    // Clear existing markers
    markersRef.current.forEach(marker => marker.setMap(null));
    markersRef.current = [];

    MOCK_INSPECTORS.forEach(inspector => {
      const isCurrentCall = inspector.id === currentCallInspectorId;
      const markerColor = isCurrentCall ? '#22c55e' : 
                         inspector.status === 'available' ? '#3b82f6' :
                         inspector.status === 'busy' ? '#ef4444' : '#6b7280';

      const marker = new google.maps.Marker({
        position: { lat: inspector.latitude, lng: inspector.longitude },
        map: map,
        title: inspector.name,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 10,
          fillColor: markerColor,
          fillOpacity: 1,
          strokeWeight: 2,
          strokeColor: '#ffffff'
        }
      });

      const infoWindow = new google.maps.InfoWindow({
        content: `
          <div style="padding: 8px; min-width: 200px;">
            <h3 style="margin: 0 0 8px 0; color: #1f2937;">${inspector.name}</h3>
            <p style="margin: 0 0 4px 0; color: #6b7280; font-size: 14px;">${inspector.specialization}</p>
            <p style="margin: 0 0 8px 0; color: ${markerColor}; font-weight: 500; font-size: 14px; text-transform: capitalize;">
              ${isCurrentCall ? 'On Current Call' : inspector.status}
            </p>
            ${!isCurrentCall && inspector.status === 'available' ? 
              '<button onclick="window.selectInspectorFromMap(\'' + inspector.id + '\')" style="background: #3b82f6; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 14px;">Start Call</button>' : 
              ''
            }
          </div>
        `
      });

      marker.addListener('click', () => {
        setSelectedInspector(inspector);
        infoWindow.open(map, marker);
      });

      markersRef.current.push(marker);
    });

    // Add global function to handle inspector selection from info window
    (window as any).selectInspectorFromMap = (inspectorId: string) => {
      const inspector = MOCK_INSPECTORS.find(i => i.id === inspectorId);
      if (inspector) {
        onSelectInspector(inspector);
        onClose();
      }
    };
  };

  const getStatusColor = (status: string, isCurrentCall: boolean) => {
    if (isCurrentCall) return 'text-green-600';
    switch (status) {
      case 'available': return 'text-blue-600';
      case 'busy': return 'text-red-600';
      case 'offline': return 'text-gray-600';
      default: return 'text-gray-600';
    }
  };

  const getStatusDot = (status: string, isCurrentCall: boolean) => {
    if (isCurrentCall) return 'bg-green-500';
    switch (status) {
      case 'available': return 'bg-blue-500';
      case 'busy': return 'bg-red-500';
      case 'offline': return 'bg-gray-500';
      default: return 'bg-gray-500';
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-6xl h-[80vh] bg-white">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle className="text-xl font-semibold text-black">Field Inspector Map</CardTitle>
          <Button
            size="icon"
            variant="ghost"
            onClick={onClose}
            className="h-8 w-8 text-black hover:bg-gray-100"
            data-testid="button-close-field-map"
          >
            <X className="w-4 h-4" />
          </Button>
        </CardHeader>
        <CardContent className="p-0 h-full">
          <div className="grid grid-cols-1 lg:grid-cols-3 h-full">
            {/* Map Area */}
            <div className="lg:col-span-2 relative">
              <div
                ref={mapRef}
                className="w-full h-full"
                data-testid="google-map-container"
              />
              {!isMapLoaded && (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                    <p className="text-gray-600">Loading field map...</p>
                  </div>
                </div>
              )}
            </div>

            {/* Inspector List */}
            <div className="border-l border-gray-200 bg-gray-50 p-4 overflow-y-auto">
              <h3 className="text-lg font-semibold text-black mb-4">Available Inspectors</h3>
              <div className="space-y-3">
                {MOCK_INSPECTORS.map(inspector => {
                  const isCurrentCall = inspector.id === currentCallInspectorId;
                  return (
                    <Card 
                      key={inspector.id} 
                      className={`p-3 cursor-pointer transition-colors hover:bg-white ${
                        selectedInspector?.id === inspector.id ? 'ring-2 ring-blue-500' : ''
                      }`}
                      onClick={() => setSelectedInspector(inspector)}
                      data-testid={`inspector-card-${inspector.id}`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-1">
                            <MapPin className="w-4 h-4 text-gray-500" />
                            <span className="font-medium text-black">{inspector.name}</span>
                          </div>
                          <p className="text-sm text-gray-600 mb-2">{inspector.specialization}</p>
                          <div className="flex items-center space-x-2">
                            <div className={`w-2 h-2 rounded-full ${getStatusDot(inspector.status, isCurrentCall)}`}></div>
                            <span className={`text-sm font-medium ${getStatusColor(inspector.status, isCurrentCall)}`}>
                              {isCurrentCall ? 'On Current Call' : inspector.status.charAt(0).toUpperCase() + inspector.status.slice(1)}
                            </span>
                          </div>
                        </div>
                        {!isCurrentCall && inspector.status === 'available' && (
                          <Button
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              onSelectInspector(inspector);
                              onClose();
                            }}
                            className="ml-2"
                            data-testid={`button-call-inspector-${inspector.id}`}
                          >
                            <Phone className="w-3 h-3 mr-1" />
                            Call
                          </Button>
                        )}
                      </div>
                    </Card>
                  );
                })}
              </div>

              {/* Map Legend */}
              <div className="mt-6 pt-4 border-t border-gray-300">
                <h4 className="font-medium text-black mb-3">Legend</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 rounded-full bg-green-500"></div>
                    <span className="text-gray-700">On Current Call</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                    <span className="text-gray-700">Available</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 rounded-full bg-red-500"></div>
                    <span className="text-gray-700">Busy</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 rounded-full bg-gray-500"></div>
                    <span className="text-gray-700">Offline</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}