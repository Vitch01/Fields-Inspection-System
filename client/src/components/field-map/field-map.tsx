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
  phone?: string;
  email?: string;
  price?: string;
  note?: string;
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

// Store loaded inspectors from Google My Maps
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
  const [dbInspectors, setDbInspectors] = useState<any[]>([]);

  // Load inspector users from database on component mount
  useEffect(() => {
    const loadDbInspectors = async () => {
      try {
        const response = await fetch('/api/users?role=inspector');
        if (response.ok) {
          const inspectors = await response.json();
          setDbInspectors(inspectors);
          console.log('📋 Loaded database inspectors:', inspectors);
        }
      } catch (error) {
        console.error('Failed to load database inspectors:', error);
      }
    };
    
    loadDbInspectors();
  }, []);

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

  // Function to clear existing markers
  const clearMarkers = () => {
    markersRef.current.forEach(marker => marker.setMap(null));
    markersRef.current = [];
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
    infoWindowContent.style.cssText = 'padding: 12px; min-width: 250px; max-width: 350px;';
    
    // Name
    const nameEl = document.createElement('h3');
    nameEl.style.cssText = 'margin: 0 0 8px 0; color: #1f2937; font-size: 16px; font-weight: 600;';
    nameEl.textContent = inspector.name;
    infoWindowContent.appendChild(nameEl);

    // Specialization
    const specializationEl = document.createElement('p');
    specializationEl.style.cssText = 'margin: 0 0 8px 0; color: #6b7280; font-size: 14px;';
    specializationEl.textContent = inspector.specialization || 'Field Representative';
    infoWindowContent.appendChild(specializationEl);

    // Status
    const statusEl = document.createElement('p');
    statusEl.style.cssText = `margin: 0 0 12px 0; color: ${markerColor}; font-weight: 500; font-size: 14px; text-transform: capitalize;`;
    statusEl.textContent = isCurrentCall ? 'On Current Call' : inspector.status;
    infoWindowContent.appendChild(statusEl);

    // Contact Information Section
    if (inspector.phone || inspector.email || inspector.price || inspector.note) {
      const contactSectionEl = document.createElement('div');
      contactSectionEl.style.cssText = 'border-top: 1px solid #e5e7eb; padding-top: 8px; margin-top: 8px;';
      
      // Phone
      if (inspector.phone) {
        const phoneEl = document.createElement('p');
        phoneEl.style.cssText = 'margin: 4px 0; font-size: 14px; color: #374151;';
        phoneEl.innerHTML = `<strong>Phone:</strong> ${inspector.phone}`;
        contactSectionEl.appendChild(phoneEl);
      }

      // Email
      if (inspector.email) {
        const emailEl = document.createElement('p');
        emailEl.style.cssText = 'margin: 4px 0; font-size: 14px; color: #374151;';
        emailEl.innerHTML = `<strong>Email:</strong> ${inspector.email}`;
        contactSectionEl.appendChild(emailEl);
      }

      // Price
      if (inspector.price) {
        const priceEl = document.createElement('p');
        priceEl.style.cssText = 'margin: 4px 0; font-size: 14px; color: #374151;';
        priceEl.innerHTML = `<strong>Price:</strong> ${inspector.price}`;
        contactSectionEl.appendChild(priceEl);
      }

      // Note
      if (inspector.note) {
        const noteEl = document.createElement('p');
        noteEl.style.cssText = 'margin: 4px 0; font-size: 14px; color: #374151;';
        noteEl.innerHTML = `<strong>Note:</strong> ${inspector.note}`;
        contactSectionEl.appendChild(noteEl);
      }

      infoWindowContent.appendChild(contactSectionEl);
    }

    // Action button
    if (!isCurrentCall && inspector.status === 'available') {
      const buttonEl = document.createElement('button');
      buttonEl.style.cssText = 'margin-top: 12px; padding: 8px 16px; background-color: #3b82f6; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 14px; font-weight: 500; width: 100%;';
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
  };

  const initializeMap = async () => {
    if (!mapRef.current || !window.google) {
      setMapError("Google Maps API failed to load");
      return;
    }

    try {
      console.log('🗺️ Initializing Google Maps for field representatives...');
      
      // Initialize map centered on the field location in Utah
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

      // Primary KML URL with specific layer ID for Infini Rep. Field layer
      const primaryKmlUrl = `https://www.google.com/maps/d/kml?mid=${GOOGLE_MY_MAPS_ID}&forcekml=1&lid=mkit35Kg0lY`;
      const fallbackKmlUrl = `https://www.google.com/maps/d/kml?mid=${GOOGLE_MY_MAPS_ID}&forcekml=1`;
      
      console.log('📍 Loading field representatives from Google My Maps...');
      console.log('🎯 Primary URL:', primaryKmlUrl);
      
      // Try loading from primary URL first (with layer ID)
      try {
        await loadKmlDataAsMarkers(map, primaryKmlUrl);
        console.log('✅ Successfully loaded field representatives from primary URL');
      } catch (error) {
        console.warn('⚠️ Primary URL failed, trying fallback...', error);
        try {
          await loadKmlDataAsMarkers(map, fallbackKmlUrl);
          console.log('✅ Successfully loaded field representatives from fallback URL');
        } catch (fallbackError) {
          console.error('❌ All KML loading methods failed:', fallbackError);
          setMapError('Unable to load field representative data from Google My Maps. Please ensure your map is shared as "Anyone with the link - Viewer".');
          setIsMapLoaded(false);
          return;
        }
      }
      
      setIsMapLoaded(true);
      console.log('🎉 Field map initialization complete!');

    } catch (error) {
      console.error('💥 Error initializing Google Maps:', error);
      setMapError("Failed to initialize map. This may be due to an invalid API key or network issues.");
      setIsMapLoaded(false);
    }
  };

  const loadKmlDataAsMarkers = async (map: any, kmlUrl: string) => {
    console.log('📍 Parsing KML data from Google My Maps...');
    try {
      const response = await fetch(kmlUrl);
      const kmlText = await response.text();
      
      if (kmlText.includes('<Placemark>')) {
        console.log('✅ Found Google My Maps data - parsing field representatives...');
        
        const parser = new DOMParser();
        const kmlDoc = parser.parseFromString(kmlText, 'text/xml');
        const placemarks = kmlDoc.querySelectorAll('Placemark');
        
        console.log(`📋 Found ${placemarks.length} field representatives in Google My Maps`);
        
        // Clear existing markers and inspectors
        clearMarkers();
        const loadedInspectors: Inspector[] = [];
        
        const bounds = new window.google.maps.LatLngBounds();
        let markersAdded = 0;
        
        placemarks.forEach((placemark, index) => {
          const name = placemark.querySelector('name')?.textContent || `Field Rep ${index + 1}`;
          const description = placemark.querySelector('description')?.textContent || '';
          const address = placemark.querySelector('address')?.textContent || '';
          const coordinates = placemark.querySelector('coordinates')?.textContent?.trim();
          
          console.log(`🔍 Processing placemark: ${name}`);
          console.log(`📍 Coordinates found: ${coordinates ? 'Yes' : 'No'}`);
          console.log(`📝 Description: ${description.substring(0, 100)}...`);
          console.log(`🏠 Address: ${address.substring(0, 100)}...`);
          
          let lat, lng;
          
          if (coordinates) {
            // Use actual coordinates if available
            const [lngStr, latStr] = coordinates.split(',').map(coord => coord.trim());
            lat = parseFloat(latStr);
            lng = parseFloat(lngStr);
            console.log(`📍 Using coordinates: (${lat}, ${lng})`);
          } else {
            // No coordinates - place at Utah center with small offset to avoid overlap
            lat = FIELD_CENTER.lat + (index * 0.005); // Small offset for each rep
            lng = FIELD_CENTER.lng + (index * 0.005);
            console.log(`⚠️ No coordinates found, using default Utah location with offset: (${lat}, ${lng})`);
          }
          
          if (!isNaN(lat) && !isNaN(lng)) {
            console.log(`✅ Adding field representative: ${name} at (${lat}, ${lng})`);
            
            // Extract contact info from ExtendedData first (more reliable)
            let phone = '', email = '', price = '', note = '';
            
            const extendedData = placemark.querySelector('ExtendedData');
            if (extendedData) {
              phone = extendedData.querySelector('Data[name="Phone"] value')?.textContent?.trim() || '';
              email = extendedData.querySelector('Data[name="Email"] value')?.textContent?.trim() || '';
              price = extendedData.querySelector('Data[name="Price"] value')?.textContent?.trim() || '';
              note = extendedData.querySelector('Data[name="Note"] value')?.textContent?.trim() || '';
              console.log(`📞 ExtendedData - Phone: ${phone}, Email: ${email}, Price: ${price}, Note: ${note}`);
            }
            
            // Fallback to parsing description if ExtendedData not available
            if (!phone || !email) {
              const phoneMatch = description.match(/Phone:\s*([^<\n]*)/);
              const emailMatch = description.match(/Email:\s*([^<\n]*)/);
              const priceMatch = description.match(/Price:\s*([^<\n]*)/);
              const noteMatch = description.match(/Note:\s*([^<\n]*)/);
              
              phone = phone || (phoneMatch?.[1]?.trim() ?? '');
              email = email || (emailMatch?.[1]?.trim() ?? '');
              price = price || (priceMatch?.[1]?.trim() ?? '');
              note = note || (noteMatch?.[1]?.trim() ?? '');
              console.log(`📝 Description fallback - Phone: ${phone}, Email: ${email}, Price: ${price}, Note: ${note}`);
            }

            // Map to real database user by name matching
            const inspectorName = name.trim();
            const matchingDbUser = dbInspectors.find(dbInspector => 
              dbInspector.name.toLowerCase().includes(inspectorName.toLowerCase()) ||
              inspectorName.toLowerCase().includes(dbInspector.name.toLowerCase())
            );
            
            // Use real user ID if found, otherwise skip this inspector
            if (!matchingDbUser) {
              console.warn(`⚠️ No database user found for field map inspector: ${inspectorName}`);
              return; // Skip this inspector if no matching database user
            }
            
            console.log(`✅ Mapped field inspector "${inspectorName}" to database user "${matchingDbUser.name}" (ID: ${matchingDbUser.id})`);

            // Create Inspector object with real database user ID
            const inspector: Inspector = {
              id: matchingDbUser.id, // Use real database user ID
              name: matchingDbUser.name, // Use database name for consistency
              latitude: lat,
              longitude: lng,
              status: 'available', // Default status
              specialization: 'Field Representative',
              phone: phone || undefined,
              email: email || undefined,
              price: price || undefined,
              note: note || undefined,
            };

            loadedInspectors.push(inspector);

            // Create marker
            const isCurrentCall = inspector.id === currentCallInspectorId;
            const markerColor = getMarkerColor(inspector.status, isCurrentCall);
            
            const marker = new window.google.maps.Marker({
              position: { lat, lng },
              map: map,
              title: name,
              icon: {
                path: window.google.maps.SymbolPath.CIRCLE,
                scale: 10,
                fillColor: markerColor,
                fillOpacity: 0.9,
                strokeColor: '#ffffff',
                strokeWeight: 2,
              }
            });

            // Add click listener to show inspector info
            marker.addListener('click', () => {
              showInspectorInfo(inspector, marker.getPosition());
            });

            markersRef.current.push(marker);
            bounds.extend({ lat, lng });
            markersAdded++;
          }
        });

        if (markersAdded > 0) {
          // Update component state with loaded inspectors
          setInspectors(loadedInspectors);
          FIELD_INSPECTORS = loadedInspectors;
          
          // Fit map bounds to show all markers
          map.fitBounds(bounds);
          
          console.log(`🎉 Successfully loaded ${markersAdded} field representatives from Google My Maps!`);
          setIsMapLoaded(true);
          setMapError(null);
        } else {
          console.log('⚠️ No valid field representatives found in Google My Maps');
          setMapError('No field representatives found in your Google My Maps layer.');
        }
        
      } else {
        console.log('❌ KML data does not contain location markers');
        setMapError('Your Google My Maps appears to be empty or not properly shared.');
      }
      
    } catch (error) {
      console.error('💥 Error loading Google My Maps data:', error);
      setMapError('Failed to load your Google My Maps. Please ensure it is shared as "Anyone with the link - Viewer".');
      throw error;
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
    if (isCurrentCall) return 'text-green-800';
    switch (status) {
      case 'available': return 'text-blue-800';
      case 'busy': return 'text-red-800';
      case 'offline': return 'text-muted-foreground';
      default: return 'text-muted-foreground';
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
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <Card className="w-full max-w-6xl h-[80vh] bg-white border border-gray-300">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4 bg-white border-b border-gray-300">
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
                <div className="absolute inset-0 flex items-center justify-center bg-white">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                    <p className="text-black">Loading field map...</p>
                  </div>
                </div>
              )}
              {mapError && (
                <div className="absolute inset-0 flex items-center justify-center bg-white">
                  <div className="text-center">
                    <div className="text-red-600 mb-4">
                      <p className="font-medium">Map Loading Error</p>
                      <p className="text-sm text-black mt-1">{mapError}</p>
                    </div>
                    <Button 
                      onClick={retryLoadMap} 
                      size="sm"
                      disabled={isRetrying || !import.meta.env.VITE_GOOGLE_MAPS_API_KEY}
                    >
                      {isRetrying ? "Retrying..." : "Retry"}
                    </Button>
                    {!import.meta.env.VITE_GOOGLE_MAPS_API_KEY && (
                      <p className="text-xs text-black mt-2">
                        Contact administrator to configure Google Maps API key
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Inspector List */}
            <div className="border-l border-gray-300 bg-white p-4 overflow-y-auto">
              <h3 className="text-lg font-semibold text-black mb-4">Available Inspectors</h3>
              <div className="space-y-3">
                {inspectors.map((inspector: Inspector) => {
                  const isCurrentCall = inspector.id === currentCallInspectorId;
                  return (
                    <Card 
                      key={inspector.id} 
                      className={`p-3 cursor-pointer transition-colors bg-white hover:bg-gray-50 border border-gray-200 ${
                        selectedInspector?.id === inspector.id ? 'ring-2 ring-blue-500' : ''
                      }`}
                      onClick={() => setSelectedInspector(inspector)}
                      data-testid={`inspector-card-${inspector.id}`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-1">
                            <MapPin className="w-4 h-4 text-muted-foreground" />
                            <span className="font-medium text-black">{inspector.name}</span>
                          </div>
                          <p className="text-sm text-muted-foreground mb-2">{inspector.specialization}</p>
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
              <div className="mt-6 pt-4 border-t border-border">
                <h4 className="font-medium text-black mb-3">Legend</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 rounded-full bg-green-500"></div>
                    <span className="text-black">On Current Call</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                    <span className="text-black">Available</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 rounded-full bg-red-500"></div>
                    <span className="text-black">Busy</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 rounded-full bg-gray-500"></div>
                    <span className="text-black">Offline</span>
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