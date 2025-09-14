import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MapPin, Phone, X, User, Mail, DollarSign, FileText, Loader2, MapIcon } from 'lucide-react';

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
        console.log('🔄 Loading database inspectors...');
        const response = await fetch('/api/inspectors');
        if (response.ok) {
          const inspectors = await response.json();
          setDbInspectors(inspectors);
          console.log('📋 Loaded database inspectors:', inspectors);
        } else {
          console.error('❌ Failed to load database inspectors:', response.status, response.statusText);
        }
      } catch (error) {
        console.error('❌ Failed to load database inspectors:', error);
      }
    };
    
    loadDbInspectors();
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    // Check if Google Maps API key is available
    if (!import.meta.env.VITE_GOOGLE_MAPS_API_KEY) {
      console.error('❌ Google Maps API key is not configured');
      setMapError("Google Maps API key is not configured. Please contact the administrator to set up the VITE_GOOGLE_MAPS_API_KEY environment variable.");
      return;
    }
    
    console.log('✅ Google Maps API key is available:', import.meta.env.VITE_GOOGLE_MAPS_API_KEY ? 'YES' : 'NO');

    // Set up auth failure handler
    (window as any).gm_authFailure = () => {
      console.error('❌ Google Maps authentication failed');
      setMapError("Invalid or unauthorized Google Maps API key. Please check your API key configuration and billing settings.");
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
      script.onerror = (error) => {
        console.error('❌ Google Maps script failed to load:', error);
        setMapError("Failed to load Google Maps script. Please check your internet connection and API key validity.");
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
    console.log('🗺️ Initializing Google Maps...');
    
    if (!mapRef.current) {
      console.error('❌ Map container not available');
      setMapError('Map container not available');
      return;
    }
    
    if (!window.google) {
      console.error('❌ Google Maps API not loaded');
      setMapError('Google Maps API not loaded');
      return;
    }
    
    console.log('✅ Map container and Google API are available');

    try {
      console.log('🗺️ Creating Google Maps instance...');
      
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
      console.error('Error details:', (error as Error).message, (error as Error).stack);
      setMapError(`Failed to initialize map: ${(error as Error).message || 'Unknown error'}. This may be due to an invalid API key or network issues.`);
      setIsMapLoaded(false);
    }
  };

  const loadKmlDataAsMarkers = async (map: any, kmlUrl: string) => {
    console.log('📍 Parsing KML data from Google My Maps...');
    console.log('🔍 KML URL:', kmlUrl);
    try {
      const response = await fetch(kmlUrl);
      console.log('📡 KML response status:', response.status, response.statusText);
      const kmlText = await response.text();
      console.log('📄 KML text length:', kmlText.length, 'characters');
      console.log('📄 KML snippet (first 500 chars):', kmlText.substring(0, 500));
      
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
            console.log(`🔍 Trying to map field inspector "${inspectorName}" to database user...`);
            console.log(`📋 Available database inspectors:`, dbInspectors.map(i => `${i.name} (ID: ${i.id})`));
            
            const matchingDbUser = dbInspectors.find(dbInspector => 
              dbInspector.name.toLowerCase().includes(inspectorName.toLowerCase()) ||
              inspectorName.toLowerCase().includes(dbInspector.name.toLowerCase())
            );
            
            // Use real user ID if found, otherwise skip this inspector
            if (!matchingDbUser) {
              console.warn(`⚠️ No database user found for field map inspector: ${inspectorName}. Skipping this inspector.`);
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
          console.warn('⚠️ No field representatives could be placed on the map.');
          console.warn(`Parsed ${placemarks.length} placemarks but could not create any markers`);
          console.warn(`Database inspectors available:`, dbInspectors.length);
          
          if (placemarks.length === 0) {
            setMapError('No data found in your Google My Maps layer. Please check that your map contains placemarks.');
          } else if (dbInspectors.length === 0) {
            setMapError('No inspector users found in database. Please ensure inspector users are created first.');
          } else {
            setMapError(`Found ${placemarks.length} items in Google My Maps but none match database inspector names. Please check name matching.`);
          }
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
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <Card className="w-full max-w-7xl h-[85vh] bg-card border-card-border shadow-2xl">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-6 border-b border-border bg-gradient-to-r from-primary/5 to-secondary/5">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <MapIcon className="w-5 h-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-2xl font-bold text-foreground">Field Inspector Map</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">Select an inspector to start a video call</p>
            </div>
          </div>
          <Button
            size="icon"
            variant="ghost"
            onClick={onClose}
            className="h-10 w-10 hover-elevate"
            data-testid="button-close-field-map"
          >
            <X className="w-5 h-5" />
          </Button>
        </CardHeader>
        <CardContent className="p-0 h-[calc(80vh-80px)] flex">
          <div className="flex-1 relative">
            {mapError ? (
              <div className="h-full flex items-center justify-center bg-muted/30 rounded-l-lg">
                <div className="text-center p-8 max-w-md">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-destructive/10 flex items-center justify-center">
                    <MapIcon className="w-8 h-8 text-destructive" />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">Map Loading Error</h3>
                  <p className="text-muted-foreground mb-6 leading-relaxed">{mapError}</p>
                  <Button 
                    onClick={retryLoadMap} 
                    disabled={isRetrying}
                    className="w-full"
                    data-testid="button-retry-map"
                  >
                    {isRetrying ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Retrying...
                      </>
                    ) : (
                      'Retry Loading Map'
                    )}
                  </Button>
                </div>
              </div>
            ) : (
              <div
                ref={mapRef}
                className="w-full h-full"
                data-testid="google-map-container"
              />
            )}
            {!isMapLoaded && !mapError && (
              <div className="absolute inset-0 bg-muted/50 backdrop-blur-sm flex items-center justify-center rounded-l-lg">
                <div className="text-center p-8">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary/10 flex items-center justify-center">
                    <Loader2 className="w-8 h-8 text-primary animate-spin" />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">Loading Field Map</h3>
                  <p className="text-muted-foreground">Please wait while we load your Google My Maps locations</p>
                </div>
              </div>
            )}
          </div>
          
          <div className="w-84 bg-muted/30 border-l border-border overflow-y-auto">
            <div className="p-6 bg-card border-b border-border">
              <div className="flex items-center space-x-2 mb-3">
                <User className="w-5 h-5 text-primary" />
                <h3 className="text-lg font-semibold text-foreground">Available Inspectors</h3>
              </div>
              <p className="text-sm text-muted-foreground">Click on an inspector card to start a video call</p>
            </div>
            <div className="p-6 space-y-4">
              {inspectors.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted/50 flex items-center justify-center">
                    <User className="w-8 h-8 text-muted-foreground" />
                  </div>
                  <h4 className="text-lg font-semibold text-foreground mb-2">No Inspectors Found</h4>
                  <p className="text-sm text-muted-foreground max-w-xs mx-auto leading-relaxed">
                    Make sure your Google My Maps contains field inspector locations and they match your database users
                  </p>
                </div>
              ) : (
                inspectors.map((inspector) => {
                  const isCurrentCall = inspector.id === currentCallInspectorId;
                  const isAvailable = inspector.status === 'available' && !isCurrentCall;
                  
                  return (
                    <Card
                      key={inspector.id}
                      className={`p-5 transition-all duration-200 border cursor-pointer hover-elevate ${
                        isCurrentCall 
                          ? 'bg-primary/5 border-primary/20 ring-1 ring-primary/20' 
                          : isAvailable
                          ? 'bg-card border-border hover:border-primary/30'
                          : 'bg-muted/30 border-muted cursor-not-allowed opacity-75'
                      }`}
                      onClick={() => {
                        if (isAvailable) {
                          onSelectInspector(inspector);
                          onClose();
                        } else {
                          showInspectorInfo(inspector, { lat: inspector.latitude, lng: inspector.longitude });
                        }
                      }}
                      data-testid={`inspector-card-${inspector.id}`}
                    >
                      <div className="flex items-start space-x-4">
                        <div className="flex-shrink-0">
                          <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                            isCurrentCall 
                              ? 'bg-primary text-primary-foreground' 
                              : isAvailable
                              ? 'bg-secondary/10 text-secondary'
                              : 'bg-muted text-muted-foreground'
                          }`}>
                            <User className="w-5 h-5" />
                          </div>
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-2 mb-1">
                            <h4 className="font-semibold text-foreground truncate">{inspector.name}</h4>
                            <Badge 
                              variant={isCurrentCall ? 'default' : isAvailable ? 'secondary' : 'outline'}
                              className="text-xs"
                            >
                              {isCurrentCall ? 'Active Call' : inspector.status}
                            </Badge>
                          </div>
                          
                          <p className="text-sm text-muted-foreground mb-3">
                            {inspector.specialization || 'Field Representative'}
                          </p>
                          
                          <div className="space-y-1">
                            {inspector.phone && (
                              <div className="flex items-center text-xs text-muted-foreground">
                                <Phone className="w-3 h-3 mr-2 flex-shrink-0" />
                                <span className="truncate">{inspector.phone}</span>
                              </div>
                            )}
                            {inspector.email && (
                              <div className="flex items-center text-xs text-muted-foreground">
                                <Mail className="w-3 h-3 mr-2 flex-shrink-0" />
                                <span className="truncate">{inspector.email}</span>
                              </div>
                            )}
                            {inspector.price && (
                              <div className="flex items-center text-xs text-muted-foreground">
                                <DollarSign className="w-3 h-3 mr-2 flex-shrink-0" />
                                <span className="truncate">{inspector.price}</span>
                              </div>
                            )}
                            {inspector.note && (
                              <div className="flex items-center text-xs text-muted-foreground">
                                <FileText className="w-3 h-3 mr-2 flex-shrink-0" />
                                <span className="truncate">{inspector.note}</span>
                              </div>
                            )}
                          </div>
                          
                          {isAvailable && (
                            <Button 
                              size="sm" 
                              className="w-full mt-3"
                              onClick={(e) => {
                                e.stopPropagation();
                                onSelectInspector(inspector);
                                onClose();
                              }}
                            >
                              Start Video Call
                            </Button>
                          )}
                        </div>
                      </div>
                    </Card>
                  );
                })
              )}
            </div>
            
            <div className="p-6 border-t border-border bg-muted/20">
              <h4 className="font-medium text-foreground mb-4">Status Legend</h4>
              <div className="space-y-3">
                <div className="flex items-center space-x-3">
                  <Badge variant="default" className="text-xs">Active Call</Badge>
                  <span className="text-xs text-muted-foreground">Currently on a video call</span>
                </div>
                <div className="flex items-center space-x-3">
                  <Badge variant="secondary" className="text-xs">Available</Badge>
                  <span className="text-xs text-muted-foreground">Ready to start a call</span>
                </div>
                <div className="flex items-center space-x-3">
                  <Badge variant="outline" className="text-xs">Busy</Badge>
                  <span className="text-xs text-muted-foreground">Currently unavailable</span>
                </div>
                <div className="flex items-center space-x-3">
                  <Badge variant="outline" className="text-xs opacity-60">Offline</Badge>
                  <span className="text-xs text-muted-foreground">Not connected</span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}