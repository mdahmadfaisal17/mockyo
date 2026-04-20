export default function PageLoader() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-5">
      <div className="relative h-12 w-12">
        {/* Outer ring */}
        <div className="absolute inset-0 rounded-full border-2 border-white/10" />
        {/* Spinning arc */}
        <div className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-primary" style={{ animationDuration: "0.8s" }} />
        {/* Inner glow dot */}
        <div className="absolute left-1/2 top-0 -ml-1 -mt-1 h-2 w-2 rounded-full bg-primary shadow-[0_0_8px_rgba(255,107,53,0.6)]" />
      </div>
      <span className="text-sm font-medium text-muted-foreground animate-pulse">Loading…</span>
    </div>
  );
}
