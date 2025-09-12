import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { QrCode, Download, Smartphone } from "lucide-react";

interface QRCodeDisplayProps {
  url: string;
  title?: string;
  description?: string;
  size?: number;
  className?: string;
}

export default function QRCodeDisplay({
  url,
  title = "Inspector Access",
  description = "Scan with mobile device to join call",
  size = 200,
  className = "",
}: QRCodeDisplayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const generateQRCode = async () => {
      if (!canvasRef.current || !url) return;

      try {
        setIsLoading(true);
        setError(null);
        
        await QRCode.toCanvas(canvasRef.current, url, {
          width: size,
          margin: 2,
          color: {
            dark: '#000000',
            light: '#FFFFFF'
          },
          errorCorrectionLevel: 'M'
        });
        
        setIsLoading(false);
      } catch (err) {
        console.error('QR Code generation failed:', err);
        setError('Failed to generate QR code');
        setIsLoading(false);
      }
    };

    generateQRCode();
  }, [url, size]);

  const downloadQRCode = () => {
    if (!canvasRef.current) return;
    
    const link = document.createElement('a');
    link.download = 'inspector-qr-code.png';
    link.href = canvasRef.current.toDataURL();
    link.click();
  };

  return (
    <Card className={`w-fit ${className}`} data-testid="card-qr-code">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center text-sm font-medium">
          <QrCode className="w-4 h-4 mr-2" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-col items-center space-y-2">
          {isLoading && (
            <div 
              className="flex items-center justify-center bg-gray-100 rounded"
              style={{ width: size, height: size }}
              data-testid="qr-loading"
            >
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          )}
          
          {error && (
            <div 
              className="flex items-center justify-center bg-red-50 border border-red-200 rounded text-red-600 text-sm"
              style={{ width: size, height: size }}
              data-testid="qr-error"
            >
              <div className="text-center">
                <QrCode className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <div>{error}</div>
              </div>
            </div>
          )}
          
          <canvas
            ref={canvasRef}
            className={`rounded border ${isLoading || error ? 'hidden' : 'block'}`}
            data-testid="qr-canvas"
          />
        </div>
        
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center text-xs text-muted-foreground">
            <Smartphone className="w-3 h-3 mr-1" />
            {description}
          </div>
          
          {!isLoading && !error && (
            <Button
              size="sm"
              variant="outline"
              onClick={downloadQRCode}
              className="text-xs"
              data-testid="button-download-qr"
            >
              <Download className="w-3 h-3 mr-1" />
              Download QR Code
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}