import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import type { Product } from "@/lib/products";
import { estimatePriceCrc, formatCrc, formatHours, roundCrc } from "@/lib/pricing";

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
  "border border-(--color-border) bg-(--color-surface) px-3 py-2 text-sm text-(--color-fg) outline-none focus-visible:border-(--color-accent)";
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
  const [printTimeHours, setPrintTimeHours] = useState(
    initialProduct?.printTimeHours != null ? String(initialProduct.printTimeHours) : ""
  );
  const [filamentGrams, setFilamentGrams] = useState(
    initialProduct?.filamentGrams != null ? String(initialProduct.filamentGrams) : ""
  );
  const [price, setPrice] = useState(initialProduct?.price != null ? String(initialProduct.price) : "");
  const [featured, setFeatured] = useState(initialProduct?.featured ?? false);

  const priceTouchedByUser = useRef(false);
  const [makerWorldUrl, setMakerWorldUrl] = useState("");
  const [importing, setImporting] = useState(false);
  const [importPreviewImage, setImportPreviewImage] = useState<string | null>(null);

  const [existingPhotos, setExistingPhotos] = useState<ExistingPhoto[]>(
    (initialProduct?.photos ?? []).map((p) => ({ ...p, remove: false }))
  );
  const [newPhotos, setNewPhotos] = useState<NewPhoto[]>([]);
  const [processingFiles, setProcessingFiles] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hoursNum = parseFloat(printTimeHours);
  const gramsNum = parseFloat(filamentGrams);
  const hasEstimateInputs = !Number.isNaN(hoursNum) && hoursNum > 0 && !Number.isNaN(gramsNum) && gramsNum > 0;
  const estimate = hasEstimateInputs
    ? estimatePriceCrc({ printTimeHours: hoursNum, filamentGrams: gramsNum, material })
    : null;

  useEffect(() => {
    if (!estimate || priceTouchedByUser.current) return;
    setPrice(String(roundCrc(estimate.priceCrc)));
  }, [estimate?.priceCrc]);

  async function handleImportFromMakerWorld() {
    if (!makerWorldUrl.trim()) return;
    setImporting(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/import-makerworld", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: makerWorldUrl.trim() }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        name?: string | null;
        description?: string | null;
        image?: string | null;
        printTimeHours?: number | null;
      };
      if (!res.ok || !data.ok) {
        setError(data.error ?? "No se pudo importar desde MakerWorld.");
        return;
      }
      if (data.name) setName(data.name);
      if (data.description) {
        setShortDescription(data.description.slice(0, 140));
        setDescription(data.description);
      }
      if (data.printTimeHours) setPrintTimeHours(String(data.printTimeHours));
      if (data.image) setImportPreviewImage(data.image);
    } catch {
      setError("Error de red al importar. Probá de nuevo o cargá los datos a mano.");
    } finally {
      setImporting(false);
    }
  }

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
    formData.set("printTime", printTime || (hasEstimateInputs ? formatHours(hoursNum) : ""));
    if (hasEstimateInputs) formData.set("printTimeHours", String(hoursNum));
    if (!Number.isNaN(gramsNum) && gramsNum > 0) formData.set("filamentGrams", String(gramsNum));
    const priceNum = parseFloat(price);
    if (!Number.isNaN(priceNum) && priceNum > 0) formData.set("price", String(priceNum));
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
      <div className="border border-(--color-border) bg-(--color-surface) p-4">
        <span className={labelTextClass}>Importar desde MakerWorld</span>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row">
          <input
            className={cn(inputClass, "flex-1")}
            placeholder="https://makerworld.com/es/models/..."
            value={makerWorldUrl}
            onChange={(e) => setMakerWorldUrl(e.target.value)}
          />
          <button
            type="button"
            onClick={handleImportFromMakerWorld}
            disabled={importing || !makerWorldUrl.trim()}
            className="border border-(--color-accent) px-4 py-2 font-mono text-xs uppercase tracking-wider text-(--color-accent) hover:bg-[rgba(255,138,61,0.1)] disabled:opacity-50"
          >
            {importing ? "Importando..." : "Importar"}
          </button>
        </div>
        <p className="mt-2 text-xs text-(--color-muted)">
          Trae nombre, descripción y tiempo de impresión si están disponibles — el texto puede venir en
          inglés, revisalo/traducilo abajo antes de guardar. Las fotos las subís vos.
        </p>
        {importPreviewImage && (
          <div className="mt-3 flex items-center gap-2">
            <img src={importPreviewImage} alt="Referencia de MakerWorld" className="h-16 w-16 border border-(--color-border) object-cover" />
            <span className="text-xs text-(--color-muted)">Foto de referencia de MakerWorld — no se usa como foto del producto.</span>
          </div>
        )}
      </div>

      {error && (
        <p className="border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-400">
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
                  "border px-3 py-1 font-mono text-xs uppercase tracking-wider transition-colors",
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
          <input className={inputClass} value={material} onChange={(e) => setMaterial(e.target.value)} placeholder="PLA" />
        </label>
        <label className={labelClass}>
          <span className={labelTextClass}>Tamaño (opcional)</span>
          <input className={inputClass} value={size} onChange={(e) => setSize(e.target.value)} />
        </label>
        <label className={labelClass}>
          <span className={labelTextClass}>Tiempo de impresión (texto)</span>
          <input
            className={inputClass}
            value={printTime}
            onChange={(e) => setPrintTime(e.target.value)}
            placeholder={hasEstimateInputs ? formatHours(hoursNum) : "3 h 20 min"}
          />
        </label>
      </div>

      <div className="border border-(--color-border) bg-(--color-surface) p-4">
        <span className={labelTextClass}>Cálculo de precio</span>
        <p className="mt-1 text-xs text-(--color-muted)">
          Completá estos dos datos y el precio sugerido se calcula solo (editable abajo).
        </p>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className={labelClass}>
            <span className={labelTextClass}>Horas de impresión</span>
            <input
              type="number"
              min="0"
              step="0.1"
              className={inputClass}
              value={printTimeHours}
              onChange={(e) => setPrintTimeHours(e.target.value)}
            />
          </label>
          <label className={labelClass}>
            <span className={labelTextClass}>Gramos de filamento</span>
            <input
              type="number"
              min="0"
              step="1"
              className={inputClass}
              value={filamentGrams}
              onChange={(e) => setFilamentGrams(e.target.value)}
            />
          </label>
        </div>

        {estimate && (
          <p className="mt-3 text-xs text-(--color-muted)">
            Sugerido: máquina {formatCrc(estimate.machineCostCrc)} + material {formatCrc(estimate.materialCostCrc)} +
            electricidad {formatCrc(estimate.electricityCostCrc)}, con margen ={" "}
            <span className="text-(--color-accent)">{formatCrc(roundCrc(estimate.priceCrc))}</span>
          </p>
        )}

        <label className={cn(labelClass, "mt-3")}>
          <span className={labelTextClass}>Precio final (₡)</span>
          <input
            type="number"
            min="0"
            step="100"
            className={inputClass}
            value={price}
            onChange={(e) => {
              priceTouchedByUser.current = true;
              setPrice(e.target.value);
            }}
          />
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
                  "flex flex-col gap-2 border p-2",
                  p.remove ? "border-red-500/50 opacity-50" : "border-(--color-border)"
                )}
              >
                <img src={photoUrl(p.key)} alt={p.alt} className="aspect-[4/3] w-full object-cover" />
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
              <div key={p.previewUrl} className="flex flex-col gap-2 border border-(--color-border) p-2">
                <img src={p.previewUrl} alt="" className="aspect-[4/3] w-full object-cover" />
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
        className="mt-2 w-fit bg-(--color-accent) px-5 py-2.5 font-mono text-xs font-bold uppercase tracking-wider text-(--color-bg) hover:bg-(--color-accent-strong) disabled:opacity-50"
      >
        {submitting ? "Guardando..." : mode === "create" ? "Crear producto" : "Guardar cambios"}
      </button>
    </form>
  );
}
