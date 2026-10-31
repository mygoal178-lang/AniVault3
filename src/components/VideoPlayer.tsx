import React, { useRef, useState, useEffect } from 'react';
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  PictureInPicture,
  Settings,
  Check,
  AlertTriangle,
  RefreshCw,
  FastForward,
  ExternalLink,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export interface VideoPlayerProps {
  videoUrl: string;
  serverUrls?: string[];
  title: string;
  animeTitle: string;
  animeMalId: number;
  episodeNumber: number;
  hasPrev: boolean;
  hasNext: boolean;
  onPrev: () => void;
  onNext: () => void;
  posterUrl?: string | null;
  thumbnailUrl?: string | null;
  subtitleUrl?: string | null;
  autoPlay?: boolean;
  autoNext?: boolean;
  autoSkip?: boolean;
  lightsOff?: boolean;
  activeServerIndex?: number;
  onServerIndexChange?: (index: number) => void;
  onFullscreenChange?: (isFullscreen: boolean) => void;
}

export function checkIsIframeEmbed(url: string): boolean {
  if (!url) return false;
  const lower = url.toLowerCase().trim();

  // Direct media files → use native <video>
  if (
    lower.endsWith('.mp4') ||
    lower.endsWith('.m3u8') ||
    lower.endsWith('.webm') ||
    lower.endsWith('.ogg') ||
    lower.includes('.m3u8?') ||
    lower.includes('.mp4?') ||
    lower.includes('mime_type=video')
  ) {
    return false;
  }

  // Any other http(s) URL is treated as an embed player (iframe).
  // This avoids missing new host domains and keeps admin-entered embed links working.
  if (lower.startsWith('http://') || lower.startsWith('https://')) {
    return true;
  }

  // Known embed providers + common patterns (fallback for non-absolute paths)
  return (
    lower.includes('player') ||
    lower.includes('embed') ||
    lower.includes('iframe') ||
    lower.includes('abyss') ||
    lower.includes('youtube.com') ||
    lower.includes('youtu.be') ||
    lower.includes('vidsrc') ||
    lower.includes('stackvid') ||
    lower.includes('streamtape') ||
    lower.includes('mixdrop') ||
    lower.includes('filemoon') ||
    lower.includes('doodstream') ||
    lower.includes('vidhide') ||
    lower.includes('streamwish') ||
    lower.includes('megacloud') ||
    lower.includes('vidstream') ||
    lower.includes('megaplay') ||
    lower.includes('zokoanime') ||
    lower.includes('megaplay.buzz') ||
    lower.includes('zokoanime.video') ||
    lower.includes('/stream/') ||
    lower.includes('/watch/') ||
    lower.includes('/v/') ||
    lower.includes('/e/') ||
    lower.includes('/player/')
  );
}

/** Detect iOS / iPadOS / Apple TV / many WebKit TV browsers where iframe embeds often fail. */
export function isAppleLikeDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  // Classic iOS + iPadOS (including desktop-class iPad)
  if (/iPhone|iPad|iPod/i.test(ua)) return true;
  // iPadOS 13+ reports as Mac but has touch
  if (navigator.platform === 'MacIntel' && (navigator as any).maxTouchPoints > 1) return true;
  // Apple TV / some smart TVs
  if (/AppleTV|Apple TV|TVOS|SmartTV|SMART-TV|Web0S|Tizen|Viera|NetCast/i.test(ua)) return true;
  return false;
}

export function VideoPlayer({
  videoUrl,
  serverUrls,
  title,
  animeTitle,
  animeMalId,
  episodeNumber,
  hasPrev,
  hasNext,
  onPrev,
  onNext,
  posterUrl,
  thumbnailUrl,
  subtitleUrl,
  autoPlay = true,
  autoNext = true,
  autoSkip = false,
  lightsOff = false,
  activeServerIndex = 0,
  onServerIndexChange,
  onFullscreenChange,
}: VideoPlayerProps) {
  const { watchHistory, saveProgress } = useAuth();
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Assemble list of available stream server links.
  // Prefer serverUrls order (must match ServerSelector / WatchPage indices).
  // Only fall back to videoUrl when no server list exists.
  const availableServers = React.useMemo(() => {
    const list: string[] = [];
    if (serverUrls && Array.isArray(serverUrls) && serverUrls.length > 0) {
      serverUrls.forEach((s) => {
        if (s && typeof s === 'string' && s.trim() && !list.includes(s.trim())) {
          list.push(s.trim());
        }
      });
      return list;
    }
    if (videoUrl && videoUrl.trim()) {
      list.push(videoUrl.trim());
    }
    return list;
  }, [videoUrl, serverUrls]);

  const [activeUrl, setActiveUrl] = useState(videoUrl || '');
  const [hasError, setHasError] = useState(false);
  const [useIframe, setUseIframe] = useState(false);
  const [iframeLoading, setIframeLoading] = useState(true);
  const [isAppleDevice] = useState(() => isAppleLikeDevice());
  const [showExternalPrompt, setShowExternalPrompt] = useState(false);
  const [iframeFailed, setIframeFailed] = useState(false);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [resumePromptTime, setResumePromptTime] = useState<number | null>(null);
  const [skippedIntro, setSkippedIntro] = useState(false);

  const controlsTimeoutRef = useRef<any>(null);
  const prevSrcRef = useRef<string>("");

  // Initialize / switch stream when server or episode changes
  useEffect(() => {
    setHasError(false);
    setIframeFailed(false);
    setShowExternalPrompt(false);

    const nextSrc =
      availableServers[activeServerIndex] ||
      availableServers[0] ||
      videoUrl ||
      "";

    setActiveUrl(nextSrc);

    const isEmbed = checkIsIframeEmbed(nextSrc);
    setUseIframe(isEmbed);

    // Only show the loading overlay when the real source URL changes
    if (nextSrc !== prevSrcRef.current) {
      setIframeLoading(true);
      prevSrcRef.current = nextSrc;
    }

    // On Apple devices / TVs, iframe embeds frequently hang or black-screen.
    // Show a clear external-player prompt after a short delay so users are not stuck.
    if (isEmbed && isAppleDevice) {
      const promptTimer = setTimeout(() => {
        setShowExternalPrompt(true);
      }, 2500);
      // Also stop the spinner earlier so the prompt is visible
      const timer = setTimeout(() => {
        setIframeLoading(false);
      }, 4000);
      return () => {
        clearTimeout(promptTimer);
        clearTimeout(timer);
      };
    }

    // Safety timeout – hide spinner after 7 seconds no matter what
    const timer = setTimeout(() => {
      setIframeLoading(false);
    }, 7000);

    // Native <video> handling
    if (!isEmbed && videoRef.current) {
      videoRef.current.load();

      if (autoPlay) {
        videoRef.current
          .play()
          .then(() => setIsPlaying(true))
          .catch(() => {
            // Autoplay blocked → try muted
            if (videoRef.current) {
              videoRef.current.muted = true;
              setIsMuted(true);
              videoRef.current
                .play()
                .then(() => setIsPlaying(true))
                .catch(() => setIsPlaying(false));
            }
          });
      }
    }

    return () => clearTimeout(timer);
  }, [activeServerIndex, episodeNumber, availableServers, videoUrl, autoPlay, isAppleDevice]);
  // Check saved progress on load
  useEffect(() => {
    const existing = watchHistory.find(
      (h) => h.anime_mal_id === animeMalId && h.episode_number === episodeNumber
    );
    if (existing && existing.progress_seconds > 10 && !existing.completed) {
      setResumePromptTime(existing.progress_seconds);
    } else {
      setResumePromptTime(null);
    }
  }, [animeMalId, episodeNumber, watchHistory]);

  // Auto skip intro if enabled
  useEffect(() => {
    if (autoSkip && !skippedIntro && currentTime >= 2 && currentTime < 85 && videoRef.current) {
      videoRef.current.currentTime = 85;
      setSkippedIntro(true);
    }
  }, [autoSkip, skippedIntro, currentTime]);

  // Last saved progress time reference
  const lastSavedTimeRef = useRef<number>(-1);

  const commitProgress = (currentSec: number, totalDur: number) => {
    if (totalDur <= 0) return;
    const flooredCur = Math.floor(currentSec);
    const flooredDur = Math.floor(totalDur);
    if (Math.abs(flooredCur - lastSavedTimeRef.current) < 3 && flooredCur < flooredDur) {
      return;
    }
    lastSavedTimeRef.current = flooredCur;
    saveProgress(animeMalId, episodeNumber, flooredCur, flooredDur);
  };

  // Periodic save progress every 12 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      if (videoRef.current && !videoRef.current.paused && duration > 0) {
        commitProgress(videoRef.current.currentTime, duration);
      }
    }, 12000);

    return () => {
      clearInterval(interval);
      if (videoRef.current && duration > 0) {
        commitProgress(videoRef.current.currentTime, duration);
      }
    };
  }, [animeMalId, episodeNumber, duration, saveProgress]);

  // ========== AUTO ROTATE / FULLSCREEN ON LANDSCAPE ==========
  useEffect(() => {
    const handleOrientationChange = () => {
      const type = screen.orientation?.type || '';
      const isLandscape = type.startsWith('landscape');

      // Only auto-enter if video is playing and not already fullscreen
      if (
        isLandscape &&
        !document.fullscreenElement &&
        containerRef.current &&
        videoRef.current &&
        !videoRef.current.paused
      ) {
        const el = containerRef.current as HTMLElement & {
          webkitRequestFullscreen?: () => Promise<void> | void;
          msRequestFullscreen?: () => Promise<void> | void;
        };

        const enterFs = async () => {
          try {
            if (el.requestFullscreen) {
              await el.requestFullscreen();
            } else if (el.webkitRequestFullscreen) {
              await el.webkitRequestFullscreen();
            } else if (el.msRequestFullscreen) {
              await el.msRequestFullscreen();
            }

            setIsFullscreen(true);
            onFullscreenChange?.(true);

            // Try lock to landscape
            try {
              const orientation = screen.orientation as ScreenOrientation & {
                lock?: (orientation: string) => Promise<void>;
              };
              if (orientation?.lock) {
                await orientation.lock('landscape');
              }
            } catch {
              // iOS Safari often blocks this
            }
          } catch (err) {
            console.error('Auto fullscreen failed:', err);
          }
        };

        enterFs();
      }
    };

    if (screen.orientation) {
      screen.orientation.addEventListener('change', handleOrientationChange);
    }
    window.addEventListener('orientationchange', handleOrientationChange);

    return () => {
      if (screen.orientation) {
        screen.orientation.removeEventListener('change', handleOrientationChange);
      }
      window.removeEventListener('orientationchange', handleOrientationChange);
    };
  }, [onFullscreenChange]);

  // Handle Play/Pause
  const togglePlay = () => {
    if (videoRef.current) {
      if (videoRef.current.paused) {
        videoRef.current
          .play()
          .then(() => {
            setIsPlaying(true);
            setHasError(false);
          })
          .catch((err) => {
            if (err.name === 'NotAllowedError') {
              if (videoRef.current) {
                videoRef.current.muted = true;
                setIsMuted(true);
                videoRef.current
                  .play()
                  .then(() => setIsPlaying(true))
                  .catch(() => setIsPlaying(false));
              }
            } else if (err.name !== 'AbortError') {
              setHasError(true);
            }
          });
      } else {
        videoRef.current.pause();
        setIsPlaying(false);
        if (duration > 0) {
          commitProgress(videoRef.current.currentTime, duration);
        }
      }
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
      setHasError(false);
    }
  };

  const handleVideoEnded = () => {
    setIsPlaying(false);
    if (duration > 0) {
      commitProgress(duration, duration);
    }
    if (autoNext && hasNext) {
      onNext();
    }
  };

  const handleVideoError = () => {
    if (activeServerIndex === 0 && availableServers.length > 1) {
      if (onServerIndexChange) {
        onServerIndexChange(1);
      }
    } else {
      setHasError(true);
    }
  };

  const skip = (seconds: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = Math.max(0, Math.min(duration, videoRef.current.currentTime + seconds));
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const target = parseFloat(e.target.value);
    setCurrentTime(target);
    if (videoRef.current) {
      videoRef.current.currentTime = target;
    }
  };

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    if (videoRef.current) {
      videoRef.current.volume = val;
      videoRef.current.muted = val === 0;
      setIsMuted(val === 0);
    }
  };

  const changeSpeed = (speed: number) => {
    setPlaybackSpeed(speed);
    if (videoRef.current) {
      videoRef.current.playbackRate = speed;
    }
    setShowSettings(false);
  };

  const toggleFullscreen = async () => {
    if (!containerRef.current) return;

    try {
      if (!document.fullscreenElement) {
        const el = containerRef.current as HTMLElement & {
          webkitRequestFullscreen?: () => Promise<void> | void;
          msRequestFullscreen?: () => Promise<void> | void;
        };

        if (el.requestFullscreen) {
          await el.requestFullscreen();
        } else if (el.webkitRequestFullscreen) {
          await el.webkitRequestFullscreen();
        } else if (el.msRequestFullscreen) {
          await el.msRequestFullscreen();
        }

        setIsFullscreen(true);
        onFullscreenChange?.(true);

        // Lock to landscape
        try {
          const orientation = screen.orientation as ScreenOrientation & {
            lock?: (orientation: string) => Promise<void>;
          };
          if (orientation?.lock) {
            await orientation.lock('landscape');
          }
        } catch {
          // ignore on iOS
        }
      } else {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        }

        setIsFullscreen(false);
        onFullscreenChange?.(false);

        try {
          screen.orientation?.unlock?.();
        } catch {
          // ignore
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    const handleFsChange = () => {
      const isFs = !!document.fullscreenElement;
      setIsFullscreen(isFs);
      onFullscreenChange?.(isFs);

      if (!isFs) {
        try {
          screen.orientation?.unlock?.();
        } catch {
          // ignore
        }
      }
    };

    document.addEventListener('fullscreenchange', handleFsChange);
    document.addEventListener('webkitfullscreenchange', handleFsChange as EventListener);

    return () => {
      document.removeEventListener('fullscreenchange', handleFsChange);
      document.removeEventListener('webkitfullscreenchange', handleFsChange as EventListener);
    };
  }, [onFullscreenChange]);

  const togglePiP = async () => {
    if (videoRef.current && document.pictureInPictureEnabled) {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else {
        await videoRef.current.requestPictureInPicture();
      }
    }
  };

  const formatTime = (time: number) => {
    if (isNaN(time)) return '00:00';
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  const handleMouseMove = () => {
    setShowControls(true);
    clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = setTimeout(() => {
      if (isPlaying && !showSettings) {
        setShowControls(false);
      }
    }, 3000);
  };

  return (
    <div className="relative w-full">
      {/* Lights Off Backdrop */}
      {lightsOff && (
        <div
          onClick={() => {}}
          className="fixed inset-0 z-40 bg-black/85 transition-opacity duration-300 pointer-events-none"
        />
      )}

      {/* Main Video Frame */}
      <div
        id="anivault-video-container"
        ref={containerRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => isPlaying && setShowControls(false)}
        className={`group relative aspect-video w-full overflow-hidden rounded-xl sm:rounded-2xl bg-black shadow-2xl border border-white/10 ${
          lightsOff ? 'z-50 ring-2 ring-purple-500/50 shadow-purple-950/50' : ''
        }`}
      >
        {/* No Server or Error Fallback State */}
        {!activeUrl ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#07070f] p-6 text-center z-30">
            <AlertTriangle className="h-12 w-12 text-amber-400 mb-3" />
            <h3 className="text-base font-bold text-white mb-1">No Streaming Server Available</h3>
            <p className="text-xs text-slate-400 max-w-md">
              No streaming server is available for this episode.
            </p>
          </div>
        ) : hasError ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 p-6 text-center z-30">
            <AlertTriangle className="h-12 w-12 text-amber-500 mb-3" />
            <h3 className="text-base font-bold text-white mb-1">Video Stream Notice</h3>
            <p className="text-xs text-slate-400 max-w-md mb-4 leading-relaxed">
              Current server stream encountered an issue or connection block. Please switch to another server below.
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setHasError(false);
                  if (onServerIndexChange) {
                    onServerIndexChange((activeServerIndex + 1) % availableServers.length);
                  }
                }}
                className="flex items-center gap-2 rounded-xl bg-purple-600 px-4 py-2 text-xs font-bold text-white shadow hover:bg-purple-500 transition-colors"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                <span>Try Next Server</span>
              </button>
            </div>
          </div>
        ) : useIframe ? (
          /* ========== IFRAME EMBED (with iOS / TV friendly fallback) ========== */
          <div className="relative h-full w-full">
            {iframeLoading && !showExternalPrompt && (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-black/90">
                <div className="h-10 w-10 animate-spin rounded-full border-4 border-purple-500 border-t-transparent" />
                <p className="mt-3 text-sm text-slate-300">Loading player...</p>
              </div>
            )}

            {/* Always-available external player button (critical for iPhone / Apple TV / smart TVs) */}
            {(showExternalPrompt || iframeFailed || isAppleDevice) && activeUrl && (
              <div className="absolute inset-x-0 bottom-0 z-20 flex flex-col items-center gap-2 bg-gradient-to-t from-black via-black/90 to-transparent px-4 pb-5 pt-10">
                <p className="text-center text-xs text-slate-300 max-w-sm leading-relaxed">
                  {isAppleDevice
                    ? "Player may not load inside the app on iPhone / Apple TV. Open it externally for best results."
                    : "Having trouble? Open the player in a new tab."}
                </p>
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <a
                    href={activeUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-xl bg-purple-600 px-4 py-2.5 text-sm font-bold text-white shadow-lg hover:bg-purple-500 active:scale-95 transition"
                  >
                    <ExternalLink className="h-4 w-4" />
                    Open Player
                  </a>
                  {availableServers.length > 1 && onServerIndexChange && (
                    <button
                      type="button"
                      onClick={() => {
                        setIframeFailed(false);
                        setShowExternalPrompt(false);
                        setIframeLoading(true);
                        onServerIndexChange((activeServerIndex + 1) % availableServers.length);
                      }}
                      className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-3 py-2.5 text-sm font-semibold text-white hover:bg-white/20 transition"
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                      Next Server
                    </button>
                  )}
                </div>
              </div>
            )}

            <iframe
              key={activeUrl}
              src={activeUrl}
              title={`${animeTitle} - Episode ${episodeNumber}`}
              className="h-full w-full border-0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen; web-share"
              allowFullScreen
              loading="eager"
              referrerPolicy="no-referrer"
              // sandbox keeps some hosts happy while still allowing the player to function
              sandbox="allow-scripts allow-same-origin allow-presentation allow-forms allow-popups allow-popups-to-escape-sandbox allow-top-navigation-by-user-activation"
              onLoad={() => {
                setIframeLoading(false);
                // Give the embed a moment; if still black many users will use the Open Player button
              }}
              onError={() => {
                setIframeLoading(false);
                setIframeFailed(true);
                setShowExternalPrompt(true);
              }}
            />
          </div>
        ) : (
          /* Native HTML5 Video Player */
          <>
            <video
              ref={videoRef}
              src={activeUrl}
              poster={posterUrl || thumbnailUrl || undefined}
              onClick={togglePlay}
              onTimeUpdate={handleTimeUpdate}
              onLoadedMetadata={handleLoadedMetadata}
              onEnded={handleVideoEnded}
              onError={handleVideoError}
              playsInline
              // @ts-expect-error legacy iOS attribute still required by older WebKit
              webkit-playsinline="true"
              x-webkit-airplay="allow"
              preload="metadata"
              className="h-full w-full object-contain cursor-pointer"
            >
              {subtitleUrl && (
                <track kind="subtitles" src={subtitleUrl} srcLang="en" label="English" default />
              )}
            </video>

            {/* Resume Prompt Toast Overlay */}
            {resumePromptTime && currentTime < 5 && (
              <div className="absolute top-4 left-4 z-30 flex items-center gap-3 rounded-xl border border-white/10 bg-black/90 p-2.5 shadow-2xl backdrop-blur-md animate-fade-in">
                <span className="text-xs text-slate-200">
                  Resume from <strong className="text-purple-400 font-bold">{formatTime(resumePromptTime)}</strong>?
                </span>
                <button
                  onClick={() => {
                    if (videoRef.current) {
                      videoRef.current.currentTime = resumePromptTime;
                    }
                    setResumePromptTime(null);
                  }}
                  className="rounded-lg bg-purple-600 px-2.5 py-1 text-xs font-bold text-white hover:bg-purple-500"
                >
                  Resume
                </button>
                <button
                  onClick={() => setResumePromptTime(null)}
                  className="text-xs text-slate-400 hover:text-white px-1"
                >
                  ✕
                </button>
              </div>
            )}

            {/* Skip Intro Overlay Button */}
            {currentTime >= 5 && currentTime <= 85 && !skippedIntro && (
              <button
                onClick={() => {
                  if (videoRef.current) {
                    videoRef.current.currentTime = 85;
                    setSkippedIntro(true);
                  }
                }}
                className="absolute bottom-20 right-4 z-20 flex items-center gap-1.5 rounded-lg bg-black/80 px-3 py-1.5 text-xs font-bold text-white border border-white/20 hover:bg-purple-600 transition-colors"
              >
                <FastForward className="h-3.5 w-3.5" />
                Skip Intro
              </button>
            )}

            {/* Custom Controls Overlay */}
            <div
              className={`absolute inset-0 z-10 flex flex-col justify-end bg-gradient-to-t from-black/90 via-black/20 to-transparent transition-opacity duration-300 ${
                showControls || !isPlaying ? 'opacity-100' : 'opacity-0 pointer-events-none'
              }`}
            >
              {/* Progress Bar */}
              <div className="px-3 pb-1">
                <input
                  type="range"
                  min={0}
                  max={duration || 100}
                  value={currentTime}
                  onChange={handleSeek}
                  className="w-full h-1 accent-purple-500 cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-between px-3 pb-3 gap-2">
                <div className="flex items-center gap-2">
                  <button onClick={togglePlay} className="p-1 text-white hover:text-purple-400">
                    {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
                  </button>
                  <button onClick={() => skip(-10)} className="p-1 text-slate-300 hover:text-white text-xs font-bold">
                    -10
                  </button>
                  <button onClick={() => skip(10)} className="p-1 text-slate-300 hover:text-white text-xs font-bold">
                    +10
                  </button>
                  <span className="text-xs text-slate-300 tabular-nums">
                    {formatTime(currentTime)} / {formatTime(duration)}
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  <button onClick={toggleMute} className="p-1 text-slate-300 hover:text-white">
                    {isMuted || volume === 0 ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                  </button>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={isMuted ? 0 : volume}
                    onChange={handleVolumeChange}
                    className="w-16 h-1 accent-purple-500 hidden sm:block"
                  />
                  <button onClick={togglePiP} className="p-1 text-slate-300 hover:text-white" title="Picture in Picture">
                    <PictureInPicture className="h-4 w-4" />
                  </button>
                  <div className="relative">
                    <button
                      onClick={() => setShowSettings(!showSettings)}
                      className="p-1 text-slate-300 hover:text-white"
                    >
                      <Settings className="h-4 w-4" />
                    </button>
                    {showSettings && (
                      <div className="absolute bottom-8 right-0 z-30 min-w-[120px] rounded-lg border border-white/10 bg-black/95 p-2 shadow-xl">
                        <p className="mb-1 px-2 text-[10px] font-bold uppercase text-slate-500">Speed</p>
                        {[0.5, 0.75, 1, 1.25, 1.5, 2].map((s) => (
                          <button
                            key={s}
                            onClick={() => changeSpeed(s)}
                            className={`flex w-full items-center justify-between rounded px-2 py-1 text-xs ${
                              playbackSpeed === s ? 'bg-purple-600/40 text-white' : 'text-slate-300 hover:bg-white/10'
                            }`}
                          >
                            <span>{s}x</span>
                            {playbackSpeed === s && <Check className="h-3 w-3" />}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={toggleFullscreen}
                    className="p-1 text-slate-300 hover:text-white"
                    title="Toggle Fullscreen"
                  >
                    {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
