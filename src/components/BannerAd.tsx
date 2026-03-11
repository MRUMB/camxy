import React, { useEffect, useRef } from 'react';

export default function BannerAd() {
  const adRef = useRef<HTMLModElement>(null);

  useEffect(() => {
    // Real Google AdSense integration hook
    try {
      if (adRef.current && !adRef.current.getAttribute('data-adsbygoogle-status')) {
        const adsbygoogle = (window as any).adsbygoogle || [];
        adsbygoogle.push({});
      }
    } catch (e: any) {
      if (e.message && e.message.includes('already have ads')) {
        // Ignore this specific error caused by React StrictMode re-renders
        return;
      }
      console.error("AdSense error", e);
    }
  }, []);

  return (
    <div className="w-full bg-zinc-900 border-b border-zinc-800 flex justify-center items-center p-2 min-h-[60px] shrink-0 z-10 relative overflow-hidden">
      <div className="text-[10px] text-zinc-600 absolute top-1 left-2 uppercase tracking-widest font-bold">Advertisement</div>
      {/* Real AdSense Ins Tag Placeholder */}
      <ins ref={adRef}
           className="adsbygoogle"
           style={{ display: 'inline-block', width: '320px', height: '50px' }}
           data-ad-client="ca-pub-3832730747850377"
           data-ad-slot="XXXXXXXXXX"></ins>
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none -z-10">
        <span className="text-zinc-500 text-sm font-medium">Discover the best new games on the App Store!</span>
      </div>
    </div>
  );
}
