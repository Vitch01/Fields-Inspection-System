import { useParams } from "wouter";

export default function TestSimpleCall() {
  console.log('🔥 TEST SIMPLE CALL COMPONENT EXECUTING!', window.location.href);
  console.log('🔥 Timestamp:', new Date().toISOString());
  
  const { callId } = useParams();
  console.log('🔥 CallId from params:', callId);
  
  // Simple test render with no complex dependencies
  return (
    <div className="flex h-screen items-center justify-center bg-background">
      <div className="text-center space-y-4">
        <h1 className="text-2xl font-bold">TEST CALL COMPONENT</h1>
        <p className="text-lg">Call ID: {callId}</p>
        <p className="text-muted-foreground">Component is working!</p>
      </div>
    </div>
  );
}