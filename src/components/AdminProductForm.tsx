import { useState } from "react";
import { cn } from "@/lib/utils";
import type { Product } from "@/lib/products";

interface CategoryOption {
  slug: string;
  label: string;
}

interface Props {
  mode: "create" | "edit";
  categories: readonly CategoryOption[];
  tags: readonly CategoryOption[];
  initialProduct?: Product;
}

function photoUrl(key: string): string {
  return `/img/${key}`;
}

interface ExistingPhoto {
  key: string;
  alt: string;
  remove: boolean;
}

interface NewPhoto {
  file: Blob;
  alt: string;
  previewUrl: string;
}

async function resizeImage(file: File, maxWidth = 1600, quality = 0.85): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxWidth / bitmap.width);
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No se pudo procesar la imagen.");
  ctx.drawImage(bitmap, 0, 0, width, height);
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("No se pudo procesar la imagen."))),
      "image/jpeg",
      quality
    );
  });
}

const inputClass =
  "rounded-md border border-(--color-border) bg-(--color-surface) px-3 py-2 text-sm text-(--color-fg) outline-none focus-visible:border-(--color-accent)";
const labelClass = "flex flex-col gap-1.5";
const labelTextClass = "font-mono text-xs uppercase tracking-widest text-(--color-muted)";

export default function AdminProductForm({ mode, categories, tags, initialProduct }: Props) {
  const [name, setName] = useState(initialProduct?.name ?? "");
  const [category, setCategory] = useState(initialProduct?.category ?? categories[0]?.slug ?? "");
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set(initialProduct?.tags ?? []));
  const [shortDescription, setShortDescription] = useState(initialProduct?.shortDescription ?? "");
  const [description, setDescription] = useState(initialProduct?.description ?? "");
  const [material, setMaterial] = useState(initialProduct?.material ?? "");
  const [size, setSize] = useState(initialProduct?.size ?? "");
  const [printTime, setPrintTime] = useState(initialProduct?.printTime ?? "");
  const [featured, setFeatured] = useState(initialProduct?.featured ?? false);

  const [existingPhotos, setExistingPhotos] = useState<ExistingPhoto[]>(
    (initialProduct?.photos ?? []).map((p) => ({ ...p, remove: false }))
  );
  const [newPhotos, setNewPhotos] = useState<NewPhoto[]>([]);
  const [processingFiles, setProcessingFiles] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleTag(slug: string) {
    setSelectedTags((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  }

  async function handleFilesSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (files.length === 0) return;
    setProcessingFiles(true);
    setError(null);
    try {
      const resized = await Promise.all(
        files.map(async (file) => {
          const blob = await resizeImage(file);
          return { file: blob, alt: "", previewUrl: URL.createObjectURL(blob) };
        })
      );
      setNewPhotos((prev) => [...prev, ...resized]);
    } catch {
      setError("No se pudo procesar alguna de las imágenes. Probá con otra foto.");
    } finally {
      setProcessingFiles(false);
    }
  }

  function removeNewPhoto(index: number) {
    setNewPhotos((prev) => prev.filter((_, i) => i !== index));
  }

  function toggleRemoveExisting(key: string) {
    setExistingPhotos((prev) => prev.map((p) => (p.key === key ? { ...p, remove: !p.remove } : p)));
  }

  function updateExistingAlt(key: string, alt: string) {
    setExistingPhotos((prev) => prev.map((p) => (p.key === key ? { ...p, alt } : p)));
  }

  function updateNewAlt(index: number, alt: string) {
    setNewPhotos((prev) => prev.map((p, i) => (i === index ? { ...p, alt } : p)));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const keptPhotos = existingPhotos.filter((p) => !p.remove).map((p) => ({ key: p.key, alt: p.alt }));
    const totalPhotos = keptPhotos.length + newPhotos.length;
    if (totalPhotos === 0) {
      setError("Subí al menos una foto.");
      return;
    }

    const formData = new FormData();
    formData.set("name", name);
    formData.set("category", category);
    formData.set("tagsJson", JSON.stringify(Array.from(selectedTags)));
    formData.set("shortDescription", shortDescription);
    formData.set("description", description);
    formData.set("material", material);
    formData.set("size", size);
    formData.set("printTime", printTime);
    formData.set("featured", featured ? "true" : "false");
    formData.set("altsJson", JSON.stringify(newPhotos.map((p) => p.alt || name)));
    newPhotos.forEach((p) => formData.append("photo", p.file, "photo.jpg"));

    if (mode === "edit") {
      formData.set("keptPhotosJson", JSON.stringify(keptPhotos));
    }

    setSubmitting(true);
    try {
      const url = mode === "create" ? "/api/admin/products" : `/api/admin/products/${initialProduct?.slug}`;
      const res = await fetch(url, { method: mode === "create" ? "POST" : "PUT", body: formData });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setError(data.error ?? "No se pudo guardar el producto.");
        setSubmitting(false);
        return;
      }
      window.location.href = "/admin";
    } catch {
      setError("Error de red. Probá de nuevo.");
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      {error && (
        <p className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-400">
          {error}
        </p>
      )}

      <label className={labelClass}>
        <span className={labelTextClass}>Nombre</span>
        <input
          className={inputClass}
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
      </label>

      <label className={labelClass}>
        <span className={labelTextClass}>Categoría</span>
        <select className={inputClass} value={category} onChange={(e) => setCategory(e.target.value)}>
          {categories.map((c) => (
            <option key={c.slug} value={c.slug}>
              {c.label}
            </option>
          ))}
        </select>
      </label>

      {tags.length > 0 && (
        <div className={labelClass}>
          <span className={labelTextClass}>Colecciones</span>
          <div className="flex flex-wrap gap-2">
            {tags.map((t) => (
              <button
                key={t.slug}
                type="button"
                onClick={() => toggleTag(t.slug)}
                className={cn(
                  "rounded-full border px-3 py-1 font-mono text-xs transition-colors",
                  selectedTags.has(t.slug)
                    ? "border-(--color-accent) bg-(--color-accent) text-(--color-bg)"
                    : "border-(--color-border) text-(--color-fg)"
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <label className={labelClass}>
        <span className={labelTextClass}>Descripción corta (para la tarjeta del catálogo)</span>
        <input
          className={inputClass}
          value={shortDescription}
          onChange={(e) => setShortDescription(e.target.value)}
          required
        />
      </label>

      <label className={labelClass}>
        <span className={labelTextClass}>Descripción larga</span>
        <textarea
          className={cn(inputClass, "min-h-28")}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </label>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <label className={labelClass}>
          <span className={labelTextClass}>Material (opcional)</span>
          <input className={inputClass} value={material} onChange={(e) => setMaterial(e.target.value)} />
        </label>
        <label className={labelClass}>
          <span className={labelTextClass}>Tamaño (opcional)</span>
          <input className={inputClass} value={size} onChange={(e) => setSize(e.target.value)} />
        </label>
        <label className={labelClass}>
          <span className={labelTextClass}>Tiempo de impresión (opcional)</span>
          <input className={inputClass} value={printTime} onChange={(e) => setPrintTime(e.target.value)} />
        </label>
      </div>

      <label className="flex items-center gap-2 text-sm text-(--color-fg)">
        <input type="checkbox" checked={featured} onChange={(e) => setFeatured(e.target.checked)} />
        Mostrar en la página de inicio (destacado)
      </label>

      <div className={labelClass}>
        <span className={labelTextClass}>Fotos</span>

        {existingPhotos.length > 0 && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {existingPhotos.map((p) => (
              <div
                key={p.key}
                className={cn(
                  "flex flex-col gap-2 rounded-md border p-2",
                  p.remove ? "border-red-500/50 opacity-50" : "border-(--color-border)"
                )}
              >
                <img src={photoUrl(p.key)} alt={p.alt} className="aspect-[4/3] w-full rounded object-cover" />
                <input
                  className={cn(inputClass, "text-xs")}
                  placeholder="Texto alternativo"
                  value={p.alt}
                  onChange={(e) => updateExistingAlt(p.key, e.target.value)}
                  disabled={p.remove}
                />
                <button
                  type="button"
                  onClick={() => toggleRemoveExisting(p.key)}
                  className="font-mono text-xs text-red-400 hover:underline"
                >
                  {p.remove ? "Deshacer" : "Quitar foto"}
                </button>
              </div>
            ))}
          </div>
        )}

        {newPhotos.length > 0 && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {newPhotos.map((p, i) => (
              <div key={p.previewUrl} className="flex flex-col gap-2 rounded-md border border-(--color-border) p-2">
                <img src={p.previewUrl} alt="" className="aspect-[4/3] w-full rounded object-cover" />
                <input
                  className={cn(inputClass, "text-xs")}
                  placeholder="Texto alternativo"
                  value={p.alt}
                  onChange={(e) => updateNewAlt(i, e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => removeNewPhoto(i)}
                  className="font-mono text-xs text-red-400 hover:underline"
                >
                  Quitar foto
                </button>
              </div>
            ))}
          </div>
        )}

        <input
          type="file"
          accept="image/*"
          multiple
          onChange={handleFilesSelected}
          disabled={processingFiles}
          className="text-sm text-(--color-muted)"
        />
        {processingFiles && <p className="text-xs text-(--color-muted)">Procesando imágenes...</p>}
      </div>

      <button
        type="submit"
        disabled={submitting || processingFiles}
        className="mt-2 w-fit rounded-md bg-(--color-accent) px-5 py-2.5 font-medium text-(--color-bg) hover:bg-(--color-accent-strong) disabled:opacity-50"
      >
        {submitting ? "Guardando..." : mode === "create" ? "Crear producto" : "Guardar cambios"}
      </button>
    </form>
  );
}
