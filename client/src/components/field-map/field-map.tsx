import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { MapPin, Phone, X } from 'lucide-react';

/// <reference types="google.maps" />

declare global {
  interface Window {
    google: any;
  }
}

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

// Google My Maps configuration  
const GOOGLE_MY_MAPS_ID = '18BQR9080Tx73UGM6yWqKjZ2bHWk6UZcp';
const FIELD_CENTER = { lat: 37.097178900157424, lng: -113.58888217976603 };

// Inspector data loaded from Google My Maps KML
let FIELD_INSPECTORS: Inspector[] = [];

export function FieldMap({ isOpen, onClose, onSelectInspector, currentCallInspectorId }: FieldMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const googleMapRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const kmlLayerRef = useRef<any>(null);
  const [selectedInspector, setSelectedInspector] = useState<Inspector | null>(null);
  const [isMapLoaded, setIsMapLoaded] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);
  const [inspectors, setInspectors] = useState<Inspector[]>([]);

  useEffect(() => {
    if (!isOpen) return;

    // Check if Google Maps API key is available
    if (!import.meta.env.VITE_GOOGLE_MAPS_API_KEY) {
      setMapError("Google Maps API key is not configured");
      return;
    }

    // Set up auth failure handler
    (window as any).gm_authFailure = () => {
      setMapError("Invalid or unauthorized Google Maps API key. Please check your API key and billing settings.");
      setIsMapLoaded(false);
    };

    // Load Google Maps Script
    if (!window.google) {
      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${import.meta.env.VITE_GOOGLE_MAPS_API_KEY}&libraries=geometry`;
      script.async = true;
      script.onload = () => {
        // Add a small delay to ensure Google Maps is fully initialized
        setTimeout(initializeMap, 100);
      };
      script.onerror = () => {
        setMapError("Failed to load Google Maps. Please check your internet connection and API key validity.");
      };
      document.head.appendChild(script);
    } else {
      initializeMap();
    }

    // Cleanup function
    return () => {
      // Close any open info windows
      if (googleMapRef.current) {
        // Clear markers and their listeners
        markersRef.current.forEach(marker => {
          if (marker) {
            marker.setMap(null);
          }
        });
        markersRef.current = [];
      }

      // Clear references
      googleMapRef.current = null;

      // Remove auth failure handler
      if ((window as any).gm_authFailure) {
        (window as any).gm_authFailure = undefined;
      }

      // Reset state on unmount
      setMapError(null);
      setIsMapLoaded(false);
    };
  }, [isOpen]);

  const extractInspectorsFromKML = async (kmlLayer: any) => {
    // This function would ideally parse KML data to extract inspector information
    // For now, we'll use the click events to populate inspector data dynamically
    console.log('KML layer loaded successfully');
  };

  const getMarkerColor = (status: string, isCurrentCall: boolean) => {
    if (isCurrentCall) return '#22c55e';
    switch (status) {
      case 'available': return '#3b82f6';
      case 'busy': return '#f59e0b';
      case 'offline': return '#6b7280';
      default: return '#6b7280';
    }
  };

  const showInspectorInfo = (inspector: Inspector, position: any) => {
    const isCurrentCall = inspector.id === currentCallInspectorId;
    const markerColor = getMarkerColor(inspector.status, isCurrentCall);

    // Create info window content using DOM to avoid XSS
    const infoWindowContent = document.createElement('div');
    infoWindowContent.style.cssText = 'padding: 8px; min-width: 200px;';
    
    const nameEl = document.createElement('h3');
    nameEl.style.cssText = 'margin: 0 0 8px 0; color: #1f2937;';
    nameEl.textContent = inspector.name;
    infoWindowContent.appendChild(nameEl);

    const specializationEl = document.createElement('p');
    specializationEl.style.cssText = 'margin: 0 0 4px 0; color: #6b7280; font-size: 14px;';
    specializationEl.textContent = inspector.specialization || 'Field Representative';
    infoWindowContent.appendChild(specializationEl);

    const statusEl = document.createElement('p');
    statusEl.style.cssText = `margin: 0 0 8px 0; color: ${markerColor}; font-weight: 500; font-size: 14px; text-transform: capitalize;`;
    statusEl.textContent = isCurrentCall ? 'On Current Call' : inspector.status;
    infoWindowContent.appendChild(statusEl);

    if (!isCurrentCall && inspector.status === 'available') {
      const buttonEl = document.createElement('button');
      buttonEl.style.cssText = 'background: #3b82f6; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 14px;';
      buttonEl.textContent = 'Start Call';
      buttonEl.addEventListener('click', () => {
        onSelectInspector(inspector);
        onClose();
      });
      infoWindowContent.appendChild(buttonEl);
    }

    const infoWindow = new window.google.maps.InfoWindow({
      content: infoWindowContent,
      position: position
    });

    infoWindow.open(googleMapRef.current);
    setSelectedInspector(inspector);

    // Add inspector to our list if not already present
    setInspectors(prev => {
      const exists = prev.find(i => i.id === inspector.id);
      if (!exists) {
        return [...prev, inspector];
      }
      return prev;
    });
  };

  const initializeMap = () => {
    if (!mapRef.current || !window.google) {
      setMapError("Google Maps API failed to load");
      return;
    }

    try {
      // Initialize map centered on the field location
      const map = new window.google.maps.Map(mapRef.current, {
        center: FIELD_CENTER,
        zoom: 14,
        mapTypeId: window.google.maps.MapTypeId.SATELLITE,
        styles: [
          {
            featureType: "poi",
            elementType: "labels",
            stylers: [{ visibility: "off" }]
          }
        ]
      });

      googleMapRef.current = map;

      // Load KML data from Google My Maps with your specific layer ID
      const kmlUrls = [
        `https://www.google.com/maps/d/kml?mid=${GOOGLE_MY_MAPS_ID}&forcekml=1&lid=mkit35Kg0lY`, // Your "Infini Rep. Field" layer
        `https://www.google.com/maps/d/kml?mid=${GOOGLE_MY_MAPS_ID}&forcekml=1`, // Fallback without layer ID
        `https://www.google.com/maps/d/u/0/kml?mid=${GOOGLE_MY_MAPS_ID}&forcekml=1&lid=mkit35Kg0lY`, // Try with user path
      ];
      
      // Try loading each URL until we find one that works
      let kmlLayer: any = null;
      let successfulUrl: string = '';
      
      for (const kmlUrl of kmlUrls) {
        try {
          console.log('Attempting to load KML from:', kmlUrl);
          kmlLayer = new window.google.maps.KmlLayer({
            url: kmlUrl,
            suppressInfoWindows: false, // Allow info windows temporarily to see if features load
            preserveViewport: true, // Keep the map centered on specified coordinates
            map: map
          });
          successfulUrl = kmlUrl;
          break; // Use the first URL (will check status in the status_changed listener)
        } catch (error) {
          console.warn('Failed to load KML from:', kmlUrl, error);
          continue;
        }
      }

      kmlLayerRef.current = kmlLayer;

      // Extract inspector data from KML features when clicked
      kmlLayer.addListener('click', function(event: any) {
        if (event.featureData) {
          const featureData = event.featureData;
          
          // Extract inspector information from KML data
          const inspector: Inspector = {
            id: featureData.name || `inspector-${Date.now()}`,
            name: featureData.name || 'Unknown Inspector',
            latitude: event.latLng.lat(),
            longitude: event.latLng.lng(),
            status: 'available' as const, // Default status - could be enhanced
            specialization: featureData.description || 'Field Representative'
          };

          // Show custom info window
          showInspectorInfo(inspector, event.latLng);
        }
      });

      // Monitor KML loading status
      if (kmlLayer) {
        kmlLayer.addListener('status_changed', function() {
          const status = kmlLayer.getStatus();
          console.log('KML Layer status:', status, 'URL:', successfulUrl);
          
          if (status === 'OK') {
            console.log('KML successfully loaded from:', successfulUrl);
            setIsMapLoaded(true);
            setMapError(null);
            extractInspectorsFromKML(kmlLayer);
            
            // Check if data is actually visible by examining the default viewport
            setTimeout(() => {
              try {
                const viewport = kmlLayer.getDefaultViewport();
                console.log('KML viewport:', viewport);
                if (!viewport || (!viewport.getNorthEast() && !viewport.getSouthWest())) {
                  console.warn('KML loaded but no visible features found. The map may need layer-specific access.');
                  setMapError(`Map loaded successfully, but no inspector locations are visible. This usually means we need the specific layer ID for your "Infini Rep. Field" layer.`);
                } else {
                  console.log('KML features found! Viewport bounds:', viewport.toJSON());
                }
              } catch (e) {
                console.warn('Could not check KML viewport:', e);
              }
            }, 1000); // Wait a second for KML to fully render
          } else if (status === 'DOCUMENT_NOT_FOUND') {
            setMapError("Google My Maps data not found. Please check if the map is publicly accessible.");
            setIsMapLoaded(false);
          } else if (status === 'FETCH_ERROR') {
            setMapError("Failed to load field data. Please check your internet connection.");
            setIsMapLoaded(false);
          } else if (status === 'INVALID_DOCUMENT') {
            setMapError("Invalid map data format. Please check your Google My Maps setup.");
            setIsMapLoaded(false);
          } else if (status === 'ACCESS_DENIED') {
            setMapError("Access denied to Google My Maps data. Please make sure your map is shared as 'Anyone with the link - Viewer'.");
            setIsMapLoaded(false);
          } else if (status === 'DOCUMENT_TOO_LARGE') {
            setMapError("Google My Maps data is too large to load. Please reduce the number of markers or split into multiple maps.");
            setIsMapLoaded(false);
          } else if (status === 'LIMITS_EXCEEDED') {
            setMapError("Google Maps usage limits exceeded. Please try again later.");
            setIsMapLoaded(false);
          }
        });
      }

      // Fallback timeout in case status doesn't change
      setTimeout(() => {
        if (!isMapLoaded && !mapError) {
          setIsMapLoaded(true);
          setMapError(null);
        }
      }, 5000);
    } catch (error) {
      console.error('Error initializing Google Maps:', error);
      setMapError("Failed to initialize map. This may be due to an invalid API key or quota exceeded.");
      setIsMapLoaded(false);
    }
  };


  const retryLoadMap = () => {
    setIsRetrying(true);
    setMapError(null);
    setIsMapLoaded(false);

    // Check if Google Maps API key is available
    if (!import.meta.env.VITE_GOOGLE_MAPS_API_KEY) {
      setMapError("Google Maps API key is not configured. Please set VITE_GOOGLE_MAPS_API_KEY in your environment.");
      setIsRetrying(false);
      return;
    }

    // Remove any existing Google Maps scripts
    const existingScripts = document.querySelectorAll('script[src*="maps.googleapis.com/maps/api/js"]');
    existingScripts.forEach(script => script.remove());

    // Reset google object to force reload
    if (window.google) {
      (window as any).google = undefined;
    }

    // Load fresh Google Maps script
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${import.meta.env.VITE_GOOGLE_MAPS_API_KEY}&libraries=geometry`;
    script.async = true;
    script.onload = () => {
      setIsRetrying(false);
      // Set up auth failure handler for retry
      (window as any).gm_authFailure = () => {
        setMapError("Invalid or unauthorized Google Maps API key. Please check your API key and billing settings.");
        setIsMapLoaded(false);
      };
      initializeMap();
    };
    script.onerror = () => {
      setIsRetrying(false);
      setMapError("Failed to load Google Maps. Please check your internet connection, API key validity, and try again.");
    };
    document.head.appendChild(script);
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
              {!isMapLoaded && !mapError && (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                    <p className="text-gray-600">Loading field map...</p>
                  </div>
                </div>
              )}
              {mapError && (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
                  <div className="text-center">
                    <div className="text-red-600 mb-4">
                      <p className="font-medium">Map Loading Error</p>
                      <p className="text-sm text-gray-600 mt-1">{mapError}</p>
                    </div>
                    <Button 
                      onClick={retryLoadMap} 
                      size="sm"
                      disabled={isRetrying || !import.meta.env.VITE_GOOGLE_MAPS_API_KEY}
                    >
                      {isRetrying ? "Retrying..." : "Retry"}
                    </Button>
                    {!import.meta.env.VITE_GOOGLE_MAPS_API_KEY && (
                      <p className="text-xs text-gray-500 mt-2">
                        Contact administrator to configure Google Maps API key
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Inspector List */}
            <div className="border-l border-gray-200 bg-gray-50 p-4 overflow-y-auto">
              <h3 className="text-lg font-semibold text-black mb-4">Available Inspectors</h3>
              <div className="space-y-3">
                {inspectors.map((inspector: Inspector) => {
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