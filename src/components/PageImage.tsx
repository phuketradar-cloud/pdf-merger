import { useEffect, useRef, useState } from 'react';
import { renderPageImage } from '../services/pdfRenderer';

interface PageImageProps {
  fileId: string;
  bytes: Uint8Array;
  pageIndex: number;
  rotation: number;
  width: number;
  alt: string;
  /** โหลดเมื่อเลื่อนมาเห็นเท่านั้น (Lazy Rendering) */
  lazy?: boolean;
}

export function PageImage({ fileId, bytes, pageIndex, rotation, width, alt, lazy = true }: PageImageProps) {
  const holderRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(!lazy);
  const [src, setSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (visible || !holderRef.current) return;
    if (typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: '300px' },
    );
    observer.observe(holderRef.current);
    return () => observer.disconnect();
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    setFailed(false);
    renderPageImage(fileId, bytes, pageIndex, rotation, width)
      .then((url) => !cancelled && setSrc(url))
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [visible, fileId, bytes, pageIndex, rotation, width]);

  return (
    <div ref={holderRef} className="page-image">
      {src ? (
        <img src={src} alt={alt} draggable={false} />
      ) : failed ? (
        <span className="page-image-status">แสดงตัวอย่างไม่ได้</span>
      ) : (
        <span className="page-image-status">
          <span className="spinner" aria-hidden="true" /> กำลังโหลด…
        </span>
      )}
    </div>
  );
}
