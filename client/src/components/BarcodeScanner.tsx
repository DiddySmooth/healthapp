import { useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader, type IScannerControls } from "@zxing/browser";
import { BarcodeFormat, DecodeHintType } from "@zxing/library";
import { Button } from "./ui";

// Formats found on food packaging.
const FOOD_FORMATS = [
  BarcodeFormat.EAN_13,
  BarcodeFormat.EAN_8,
  BarcodeFormat.UPC_A,
  BarcodeFormat.UPC_E,
  BarcodeFormat.CODE_128,
];

export default function BarcodeScanner({
  onDetected,
  onClose,
}: {
  onDetected: (barcode: string) => void;
  onClose: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      setError(
        window.isSecureContext
          ? "No camera is available on this device — type the barcode instead."
          : "Camera scanning needs HTTPS (browsers block camera access on plain " +
            "HTTP). Put the app behind a reverse proxy with a certificate, or " +
            "type the barcode instead.",
      );
      return;
    }

    const hints = new Map();
    hints.set(DecodeHintType.POSSIBLE_FORMATS, FOOD_FORMATS);
    const reader = new BrowserMultiFormatReader(hints);
    let controls: IScannerControls | undefined;
    let done = false;

    reader
      .decodeFromConstraints(
        { video: { facingMode: "environment" } },
        videoRef.current!,
        (result, _err, c) => {
          if (result && !done) {
            done = true;
            c.stop();
            onDetected(result.getText());
          }
        },
      )
      .then((c) => {
        controls = c;
        if (done) c.stop();
      })
      .catch((e: unknown) => {
        const name = e instanceof Error ? e.name : "";
        setError(
          name === "NotAllowedError"
            ? "Camera permission was denied — allow camera access and try again, or type the barcode."
            : "Couldn't start the camera — type the barcode instead.",
        );
      });

    return () => controls?.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg/90 p-4">
      <div className="w-full max-w-md rounded-xl bg-surface p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold">Scan barcode</h2>
          <button onClick={onClose} className="text-muted hover:text-fg" aria-label="Close">
            ✕
          </button>
        </div>
        {error ? (
          <p className="py-6 text-center text-sm text-muted">{error}</p>
        ) : (
          <>
            <video
              ref={videoRef}
              className="aspect-[4/3] w-full rounded-lg bg-black object-cover"
              muted
              playsInline
            />
            <p className="mt-2 text-center text-xs text-muted">
              Point the camera at the barcode — it scans automatically.
            </p>
          </>
        )}
        <Button variant="ghost" className="mt-3 w-full" onClick={onClose}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
