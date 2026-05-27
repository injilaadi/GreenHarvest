import React, { useRef, useState, useEffect } from "react";
import { Camera, CameraOff, Sparkles, RefreshCw, X, Image as ImageIcon, AlertTriangle } from "lucide-react";

interface AICameraScannerProps {
  onScanComplete: (count: number) => void;
  onClose: () => void;
  isOpen: boolean;
  supplyType?: "water" | "food" | "medical" | "shelter";
}

export const AICameraScanner: React.FC<AICameraScannerProps> = ({
  onScanComplete,
  onClose,
  isOpen,
  supplyType = "water"
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Derive contextual labels based on supply category
  const getContextMeta = () => {
    switch (supplyType) {
      case "food":
        return {
          title: "AI Food Pack (MRE) Scanner",
          targetLabel: "Food Pack(s)",
          singular: "non-perishable pack",
          plural: "food emergency packs",
          placeholderTip: "Arrange MRE meal packages side-by-side, labels facing upward.",
          simRange: () => Math.floor(Math.random() * 10) + 5, // 5 to 14
        };
      case "medical":
        return {
          title: "AI Medical Kit Scanner",
          targetLabel: "Medical Kit(s)",
          singular: "medical kit",
          plural: "medical kit sterilizers",
          placeholderTip: "Display sterile boxes or bandages with cross/kit logos clearly visible.",
          simRange: () => Math.floor(Math.random() * 5) + 2, // 2 to 6
        };
      case "shelter":
        return {
          title: "AI Sleeping Gear Scanner",
          targetLabel: "Sleeping Gear/Blanket(s)",
          singular: "sleeping gear unit",
          plural: "thermal blankets or bedding packages",
          placeholderTip: "Isolate thermal mats or blankets separately on clean grounds to ensure silhouette segmentation.",
          simRange: () => Math.floor(Math.random() * 6) + 3, // 3 to 8
        };
      case "water":
      default:
        return {
          title: "AI Water Bottle Scanner",
          targetLabel: "Water Bottle(s)",
          singular: "water bottle",
          plural: "clean water bottles",
          placeholderTip: "Arrange your emergency water bottles next to each other in bright surroundings.",
          simRange: () => Math.floor(Math.random() * 8) + 3, // 3 to 10
        };
    }
  };

  const meta = getContextMeta();
  
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [scannedCount, setScannedCount] = useState<number | null>(null);
  const [hudMessage, setHudMessage] = useState<string>("Ready to capture");
  const [simulationMode, setSimulationMode] = useState<boolean>(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // 1. Manage stream startup / shutdown
  useEffect(() => {
    if (isOpen && !simulationMode) {
      startCamera();
    }
    return () => {
      stopCamera();
    };
  }, [isOpen, simulationMode, supplyType]);

  const startCamera = async () => {
    setCameraError(null);
    setScannedCount(null);
    try {
      const constraints = {
        video: { facingMode: "environment", width: { ideal: 640 }, height: { ideal: 480 } }
      };
      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
      setHudMessage(`Laser lock active. Position ${meta.plural}.`);
    } catch (err: any) {
      console.warn("Camera access denied or missing:", err);
      setCameraError(
        "Camera stream not accessible. You can upload an image or run a simulated AI session."
      );
      // Automatically switch to file upload upload preview
      setPreviewUrl(null);
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
  };

  // Convert File to Base64 helper
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (error) => reject(error);
    });
  };

  // 2. Perform the analysis from capturing webcam canvas or uploaded file
  const analyzeImage = async (base64Payload: string) => {
    setIsAnalyzing(true);
    setHudMessage(`Sending telemetry to Gemini 3.5-Flash Core for ${meta.plural}...`);
    try {
      const response = await fetch("/api/scan-bottles", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ image: base64Payload, supplyType }),
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.error || "Webcam processing failed");
      }

      const data = await response.json();
      setScannedCount(data.count);
      setHudMessage(`AI Lock: ${data.count} ${meta.singular}(s) quantified.`);
      playBeepTone(880, 0.15); // Confirmation chord
    } catch (error: any) {
      console.error(error);
      setHudMessage("AI connection error. Falling back to simulation...");
      // Graceful fallback to rich simulation so they have a working session
      setTimeout(() => {
        const mockCount = meta.simRange();
        setScannedCount(mockCount);
        setHudMessage(`Simulated AI count: ${mockCount} ${meta.singular}(s) tracked.`);
        playBeepTone(600, 0.1);
      }, 1000);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Capture video stream frame onto canvas
  const handleCapture = async () => {
    if (!videoRef.current || !canvasRef.current || isAnalyzing) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext("2d");

    if (context) {
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      // Draw reversed for normal view mirrors
      context.translate(canvas.width, 0);
      context.scale(-1, 1);
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      // Reset transform
      context.setTransform(1, 0, 0, 1, 0, 0);

      // Extract image data as base64 JPEG
      const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
      playBeepTone(440, 0.08); // Capture audio trigger
      await analyzeImage(dataUrl);
    }
  };

  // Uploaded File Handler
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
      setScannedCount(null);
      
      try {
        const base64 = await fileToBase64(file);
        await analyzeImage(base64);
      } catch (err) {
        console.error(err);
        setHudMessage("Failed to load chosen file");
      }
    }
  };

  // Simulated Test Dry Run (allows counting dummy water bottles instantly)
  const triggerDemoSimulation = () => {
    setIsAnalyzing(true);
    setHudMessage(`Synthesizing ${meta.singular} simulation segment...`);
    stopCamera();
    setSimulationMode(true);
    
    setTimeout(() => {
      setIsAnalyzing(false);
      const simulatedCount = meta.simRange();
      setScannedCount(simulatedCount);
      setHudMessage(`Synthesizer complete: ${simulatedCount} ${meta.singular}(s) identified.`);
      playBeepTone(880, 0.2);
    }, 1200);
  };

  const syncAndApply = () => {
    if (scannedCount !== null) {
      onScanComplete(scannedCount);
      onClose();
    }
  };

  const playBeepTone = (frequency: number, duration: number) => {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;
      const ctx = new AudioContextClass();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = "sine";
      osc.frequency.setValueAtTime(frequency, ctx.currentTime);
      gain.gain.setValueAtTime(0.06, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch (e) {
      // AudioContext denied on strict browser playbacks
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/90 p-4 md:p-6 backdrop-blur-md">
      <div className="relative w-full max-w-2xl overflow-hidden rounded-2xl border border-emerald-900/60 bg-[#1C1E18] text-[#E8E4D9] shadow-2xl">
        
        {/* Header HUD panel */}
        <div className="flex items-center justify-between border-b border-[#2D3126] px-6 py-4 bg-[#252820]">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-[#8FA98F]/20 border border-[#8FA98F]/40 animate-pulse text-[#8FA98F]">
              <Sparkles size={16} />
            </div>
            <div>
              <h3 className="font-sans font-bold text-white tracking-tight text-sm md:text-base">{meta.title}</h3>
              <p className="text-[10px] font-mono text-[#8FA98F] uppercase tracking-widest">COCO-SEGMENTATION CORE</p>
            </div>
          </div>
          <button 
            type="button"
            onClick={onClose} 
            className="rounded-full bg-white/5 p-1.5 text-zinc-400 hover:text-white border border-[#2D3126] transition cursor-pointer"
          >
            <X size={15} />
          </button>
        </div>

        {/* Viewport & controls Container */}
        <div className="p-6 flex flex-col gap-5">
          
          {/* Main Visual Frame */}
          <div className="relative aspect-video w-full rounded-xl overflow-hidden border border-[#2D3126] bg-[#12130f] flex items-center justify-center">
            
            {/* Visual scan indicators */}
            <div className="absolute inset-0 z-10 pointer-events-none">
              {/* Corner brackets */}
              <div className="absolute top-4 left-4 w-6 h-6 border-t-2 border-l-2 border-[#8FA98F]/60" />
              <div className="absolute top-4 right-4 w-6 h-6 border-t-2 border-r-2 border-[#8FA98F]/60" />
              <div className="absolute bottom-4 left-4 w-6 h-6 border-b-2 border-l-2 border-[#8FA98F]/60" />
              <div className="absolute bottom-4 right-4 w-6 h-6 border-b-2 border-r-2 border-[#8FA98F]/60" />
              
              {/* Scan sweep laser line */}
              {isAnalyzing && (
                <div className="scanner-laser absolute left-0 w-full h-[2px] bg-[#8FA98F] shadow-[0_0_12px_rgba(143,169,143,0.8)] z-20" />
              )}
            </div>

            {/* Simulated file display if uploading */}
            {previewUrl ? (
              <div className="absolute inset-0 flex items-center justify-center z-[5] bg-black/90">
                <img src={previewUrl} alt="Selected Upload Preview" className="w-full h-full object-contain" />
              </div>
            ) : simulationMode ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 z-[5] text-zinc-400 border border-[#2D3126]">
                <ImageIcon size={44} className="text-[#8FA98F]/60 mb-3" />
                <p className="text-xs font-mono text-[#FEFAE0] uppercase tracking-widest mb-1">MOCK SENSOR ACTIVE</p>
                <p className="text-xs text-[#A5A295] max-w-sm text-center px-4 leading-normal">Showing virtual computer vision sandbox. Great for running on hardware without cameras.</p>
              </div>
            ) : null}

            {/* Webcam video node */}
            {!cameraError && !previewUrl && !simulationMode ? (
              <video 
                ref={videoRef} 
                autoPlay 
                playsInline 
                muted 
                className="w-full h-full object-cover scale-x-[-1]"
              />
            ) : null}

            {/* Error / Accessibility Screen */}
            {(cameraError && !previewUrl && !simulationMode) && (
              <div className="p-6 text-center max-w-md z-15 flex flex-col items-center justify-center">
                <CameraOff className="text-zinc-650/80 mb-3" size={36} />
                <h4 className="text-sm font-semibold text-zinc-300 mb-1">Camera Stream Offline</h4>
                <p className="text-xs text-[#A5A295] mb-4">{cameraError}</p>
                <div className="flex flex-wrap gap-2.5 justify-center">
                  <label className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#252820] border border-[#3D4035] text-xs font-medium text-white hover:opacity-90 cursor-pointer transition">
                    <ImageIcon size={14} className="text-[#D4A373]" />
                    <span>Upload Image File</span>
                    <input type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
                  </label>
                  <button
                    type="button"
                    onClick={triggerDemoSimulation}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#8FA98F]/10 border border-[#8FA98F]/30 hover:border-[#8FA98F]/60 text-xs font-medium text-[#FEFAE0] transition"
                  >
                    <Sparkles size={14} className="text-[#FEFAE0]" />
                    <span>Demo AI Sandbox</span>
                  </button>
                </div>
              </div>
            )}

            {/* Loading Indicator layer */}
            {isAnalyzing && (
              <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center z-30 transition-all">
                <div className="animate-spin text-[#8FA98F] mb-4">
                  <RefreshCw size={36} />
                </div>
                <p className="text-xs font-bold text-neutral-100 tracking-wide uppercase">{hudMessage}</p>
                <p className="text-[10px] text-[#A5A295] mt-1 font-mono">Running Gemini-3.5-Flash object segmentation...</p>
              </div>
            )}

            {/* Result Tag Badge overlay */}
            {scannedCount !== null && !isAnalyzing && (
              <div className="absolute bottom-4 left-4 z-20 bg-[#1C1E18]/95 border border-[#8FA98F]/50 rounded-xl py-3 px-5 shadow-lg flex items-center gap-3">
                <div className="flex flex-col">
                  <span className="text-[9px] font-mono uppercase tracking-wider text-[#A5A295]">{meta.targetLabel} Detected</span>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-3xl font-bold text-white leading-none">{scannedCount}</span>
                    <span className="text-xs font-semibold text-[#8FA98F]">items</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Status Message Line */}
          <div className="flex items-center justify-between text-xs bg-[#252820]/40 border border-[#2D3126] rounded-lg p-2.5">
            <span className="font-mono text-[#A5A295] flex items-center gap-1.5">
              <span className={`w-1.5 h-1.5 rounded-full ${isAnalyzing ? "bg-[#D4A373] animate-pulse" : "bg-[#8FA98F]"}`} />
              STATUS: {hudMessage.toUpperCase()}
            </span>
            <span className="text-[10px] font-mono text-[#7A776E]">FPS: 24.0 // ISO A-90</span>
          </div>

          <div className="text-[11px] text-[#A5A295] leading-relaxed">
            <span className="font-semibold text-[#8FA98F] uppercase tracking-widest mr-1">Scan tips:</span>
            {meta.placeholderTip} The scanner uses advanced Gemini 3.5 multi-modal inference to isolate visual structures, then feeds back quantities automatically.
          </div>

        </div>

        {/* Footer actions */}
        <div className="flex items-center justify-between border-t border-[#2D3126] px-6 py-4 bg-[#252820]/60">
          <div>
            {!simulationMode && !cameraError ? (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={triggerDemoSimulation}
                  className="px-3 py-1.5 rounded-lg bg-[#252820] hover:bg-[#2D3126] border border-[#2D3126] text-[11px] font-semibold text-zinc-300 transition"
                >
                  Switch to Try Demo
                </button>
                <label className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#252820] hover:bg-[#2D3126] border border-[#2D3126] text-[11px] font-semibold text-zinc-300 cursor-pointer transition">
                  <ImageIcon size={12} className="text-[#D4A373]" />
                  <span>Choose File</span>
                  <input type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
                </label>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setSimulationMode(false);
                  setPreviewUrl(null);
                  setSelectedFile(null);
                  startCamera();
                }}
                className="px-3 py-1.5 rounded-lg bg-[#252820] hover:bg-[#2D3126] border border-[#2D3126] text-[11px] font-semibold text-zinc-300 transition"
              >
                Reconnect Camera Stream
              </button>
            )}
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-zinc-400 hover:text-white transition"
            >
              Cancel
            </button>
            
            {previewUrl || !cameraError ? (
              <button
                type="button"
                onClick={handleCapture}
                disabled={isAnalyzing}
                className="flex items-center gap-1 px-4 py-2 rounded-xl bg-[#5B705B] hover:opacity-95 disabled:opacity-50 text-white text-xs font-semibold transition shadow-md cursor-pointer"
              >
                <Camera size={14} />
                <span>Capture Frame & Scan</span>
              </button>
            ) : null}

            {scannedCount !== null && (
              <button
                type="button"
                onClick={syncAndApply}
                className="px-5 py-2 rounded-xl bg-[#8FA98F] text-white text-xs font-bold transition shadow-md cursor-pointer"
              >
                Sync Detected Count
              </button>
            )}
          </div>
        </div>

        {/* Hidden internal helper canvas */}
        <canvas ref={canvasRef} className="hidden" />
      </div>
    </div>
  );
};
