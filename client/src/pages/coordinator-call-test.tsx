import { useParams } from "wouter";

// Simplified test version of coordinator call page to isolate the error
export default function CoordinatorCallTest() {
  const { callId } = useParams();

  console.log("CoordinatorCallTest rendering with callId:", callId);

  return (
    <div className="flex flex-col h-screen bg-background">
      <header className="bg-card border-b border-border px-4 py-3">
        <h1 className="text-lg font-medium">Coordinator Call Test Page</h1>
        <p>Call ID: {callId}</p>
      </header>
      <main className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl mb-4">Test Page Loading Successfully</h2>
          <p>If you can see this, the basic routing and React rendering is working.</p>
          <p className="mt-4 text-sm text-muted-foreground">
            The issue is likely in the useWebRTC or useWebSocket hooks.
          </p>
        </div>
      </main>
    </div>
  );
}