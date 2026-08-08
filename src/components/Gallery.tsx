import { useState } from "react";
import { cn } from "@/lib/utils";

interface Photo {
  src: string;
  alt: string;
}

export default function Gallery({ photos }: { photos: Photo[] }) {
  const [active, setActive] = useState(0);

  return (
    <div className="flex flex-col gap-3">
      <div className="corner-brackets overflow-hidden border border-(--color-border) bg-(--color-surface)">
        <img
          src={photos[active].src}
          alt={photos[active].alt}
          width={900}
          height={700}
          className="aspect-[4/3] w-full object-cover"
        />
      </div>

      {photos.length > 1 && (
        <div className="flex gap-2" role="tablist" aria-label="Fotos del producto">
          {photos.map((photo, i) => (
            <button
              key={photo.src}
              type="button"
              role="tab"
              aria-selected={i === active}
              aria-label={`Ver foto ${i + 1} de ${photos.length}`}
              onClick={() => setActive(i)}
              className={cn(
                "h-16 w-20 shrink-0 overflow-hidden border transition-colors",
                i === active
                  ? "border-(--color-accent)"
                  : "border-(--color-border) opacity-70 hover:opacity-100"
              )}
            >
              <img src={photo.src} alt="" width={80} height={64} className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
