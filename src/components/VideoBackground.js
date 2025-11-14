import React, { useEffect, useRef, useState } from 'react';

// Video background with selectable modes and automatic jank fallback.
// Modes:
//  - 'time': scrubbing by setting currentTime (may cause seeks/jank)
//  - 'parallax': no seeking; translates the video subtly for a lightweight effect
//  - 'playbackRate': attempts to simulate scrubbing by briefly playing forward then pausing (reverse not supported broadly)
// Auto fallback: if 'time' mode produces long seek durations, switches to 'parallax'.
export default function VideoBackground({
  src = '/login-bg.mp4',
  mode = 'time',
  smoothing = 0.06,
  wheelSensitivity = 0.005,
  touchSensitivity = 0.01,
  maxWriteFps = 24,
  parallaxFactor = 60, // lower = less movement
  style = {}
}) {
  const videoRef = useRef(null);
  const [effectiveMode, setEffectiveMode] = useState(mode);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || typeof window === 'undefined') return;
    // Pause autoplay for manual control
    try { video.pause(); } catch {}

    // If parallax mode, we don't seek; we just translate the video on scroll
    if (effectiveMode === 'parallax') {
      const onScrollParallax = () => {
        const y = window.scrollY || window.pageYOffset || 0;
        // subtle inverse movement
        video.style.transform = `translateY(${-(y / parallaxFactor)}px)`;
      };
      onScrollParallax();
      window.addEventListener('scroll', onScrollParallax, { passive: true });
      return () => window.removeEventListener('scroll', onScrollParallax);
    }

    let duration = 0;
    let rafId = null;
    let targetTime = 0;
    let displayTime = 0;
    let seeking = false;
    let seekStartTime = 0;
    let seekSamples = [];

    const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
    const minStep = 0.001;
    let lastSetTime = 0;
    const targetFrameInterval = 1000 / (maxWriteFps || 24);

    const maybeFallback = () => {
      // If avg seek duration too high, fallback.
      if (seekSamples.length >= 6) {
        const avg = seekSamples.reduce((a,b)=>a+b,0)/seekSamples.length;
        if (avg > 120) { // >120ms average per seek considered janky
          setEffectiveMode('parallax');
        }
      }
    };

    const tickTimeMode = () => {
      displayTime += (targetTime - displayTime) * smoothing;
      if (Math.abs(targetTime - displayTime) < 0.0005) displayTime = targetTime;
      if (isFinite(duration) && duration > 0) displayTime = clamp(displayTime, 0, duration);
      else displayTime = Math.max(0, displayTime);

      // Throttle writes
      const now = performance.now();
      if (!seeking && Math.abs((video.currentTime || 0) - displayTime) > minStep && (now - lastSetTime) >= targetFrameInterval) {
        try {
          seeking = true;
          seekStartTime = now;
          video.currentTime = displayTime;
        } catch {}
        lastSetTime = now;
      }

      rafId = window.requestAnimationFrame(tickTimeMode);
    };

    const frameCallback = () => {
      // Seek completed when frame renders
      if (seeking) {
        const dur = performance.now() - seekStartTime;
        seekSamples.push(dur);
        if (seekSamples.length > 12) seekSamples.shift();
        seeking = false;
        maybeFallback();
      }
      video.requestVideoFrameCallback && video.requestVideoFrameCallback(frameCallback);
    };
    if (video.requestVideoFrameCallback) {
      video.requestVideoFrameCallback(frameCallback);
    }

    const ensureRaf = () => { if (!rafId) rafId = window.requestAnimationFrame(tickTimeMode); };

    const onLoadedMeta = () => {
      duration = video.duration || 0;
      targetTime = clamp(targetTime, 0, duration);
      displayTime = clamp(displayTime, 0, duration);
    };

    const onScroll = () => {
      const maxScroll = document.documentElement.scrollHeight - window.innerHeight || 0;
      if (maxScroll <= 0) return; // wheel/touch if no scroll
      const fraction = (window.scrollY || window.pageYOffset || 0) / maxScroll;
      targetTime = (duration > 0 ? fraction * duration : 0);
      ensureRaf();
    };

    const onWheel = (ev) => {
      const maxScroll = document.documentElement.scrollHeight - window.innerHeight || 0;
      if (maxScroll > 0) return; // scroll handles mapping
      ev.preventDefault && ev.preventDefault();
      const delta = ev.deltaY || 0;
      targetTime = clamp((duration > 0 ? video.currentTime || 0 : displayTime) + delta * wheelSensitivity, 0, duration || Infinity);
      ensureRaf();
    };

    let lastTouchY = null;
    const onTouchStart = (ev) => { lastTouchY = ev.touches?.[0]?.clientY; };
    const onTouchMove = (ev) => {
      if (lastTouchY == null) { lastTouchY = ev.touches?.[0]?.clientY; return; }
      const y = ev.touches?.[0]?.clientY; if (typeof y !== 'number') return;
      const dy = lastTouchY - y; lastTouchY = y;
      targetTime = clamp((duration > 0 ? video.currentTime || 0 : displayTime) + dy * touchSensitivity, 0, duration || Infinity);
      ensureRaf();
      ev.preventDefault && ev.preventDefault();
    };

    video.addEventListener('loadedmetadata', onLoadedMeta);
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: false });

    if (video.readyState >= 1) duration = video.duration || 0;
    onScroll();

    return () => {
      video.removeEventListener('loadedmetadata', onLoadedMeta);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('wheel', onWheel);
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
      if (rafId) window.cancelAnimationFrame(rafId);
    };
  }, [mode, effectiveMode, smoothing, wheelSensitivity, touchSensitivity, maxWriteFps, parallaxFactor]);

  // inject small style to hide scrollbar visually (keeps functionality)
  useEffect(() => {
    const style = document.createElement('style');
    style.id = 'video-bg-hide-scrollbar';
    style.innerHTML = `html::-webkit-scrollbar { display: none; } html { -ms-overflow-style: none; scrollbar-width: none; }`;
    document.head.appendChild(style);
    return () => { const s = document.getElementById('video-bg-hide-scrollbar'); if (s) s.remove(); };
  }, []);

  return (
    <video
      ref={videoRef}
      src={src}
      muted
      playsInline
      preload="metadata"
      aria-hidden="true"
      style={{
        position: 'fixed', top: 0, left: 0, width: '100%', height: '120%', objectFit: 'cover', zIndex: 0,
        pointerEvents: 'none', willChange: effectiveMode === 'parallax' ? 'transform' : 'auto',
        ...style
      }}
    />
  );
}
