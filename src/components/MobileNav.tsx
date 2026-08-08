import { useState, useEffect } from "react";
import { Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface NavLink {
  href: string;
  label: string;
}

export default function MobileNav({ links }: { links: NavLink[] }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    document.documentElement.style.overflow = open ? "hidden" : "";
    return () => {
      document.documentElement.style.overflow = "";
    };
  }, [open]);

  return (
    <div className="md:hidden">
      <button
        type="button"
        aria-label={open ? "Cerrar menú" : "Abrir menú"}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex h-10 w-10 items-center justify-center rounded-md border border-(--color-border) text-(--color-fg) hover:border-(--color-accent) transition-colors"
      >
        {open ? <X size={20} /> : <Menu size={20} />}
      </button>

      <div
        className={cn(
          "fixed inset-x-0 top-16 bottom-0 z-40 bg-(--color-bg)/98 backdrop-blur-sm transition-opacity duration-150",
          open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        )}
      >
        <nav className="flex flex-col gap-1 p-6 font-mono text-lg" aria-label="Navegación principal">
          {links.map((link) => (
            <a
              key={link.href}
              href={link.href}
              onClick={() => setOpen(false)}
              className="border-b border-(--color-border) py-4 text-(--color-fg) hover:text-(--color-accent) transition-colors"
            >
              {link.label}
            </a>
          ))}
        </nav>
      </div>
    </div>
  );
}
