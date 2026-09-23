import { useEffect, useId, useRef, useState } from "react";
import { ArrowUpRight, MapPin, Search, X } from "lucide-react";
import { number } from "../types";

export default function ProvinceSearch({
  regions,
  ranking,
  onSelect,
}: {
  regions: string[];
  ranking: [string, number][];
  onSelect: (name: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const container = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const listId = useId();
  const counts = new Map(ranking);
  const matches = ["Indonesia", ...regions]
    .filter((name) => name.toLowerCase().includes(query.trim().toLowerCase()))
    .slice(0, 8);
  useEffect(() => {
    const dismiss = (event: PointerEvent) => {
      if (!container.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", dismiss);
    return () => document.removeEventListener("pointerdown", dismiss);
  }, []);
  const select = (name: string) => {
    onSelect(name);
    setQuery("");
    setOpen(false);
    setActive(0);
    input.current?.blur();
  };
  return (
    <div
      className="province-search"
      ref={container}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
    >
      <Search size={14} />
      <input
        ref={input}
        role="combobox"
        aria-label="Search provinces"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={
          open && matches.length ? `${listId}-${active}` : undefined
        }
        placeholder="Find a province…"
        value={query}
        onFocus={() => setOpen(true)}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
          setActive(0);
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            setOpen(false);
            input.current?.blur();
          }
          if (event.key === "ArrowDown") {
            event.preventDefault();
            setOpen(true);
            setActive((index) => Math.min(matches.length - 1, index + 1));
          }
          if (event.key === "ArrowUp") {
            event.preventDefault();
            setActive((index) => Math.max(0, index - 1));
          }
          if (event.key === "Enter" && open && matches[active]) {
            event.preventDefault();
            select(matches[active]);
          }
        }}
      />
      {query && (
        <button
          aria-label="Clear province search"
          onClick={() => {
            setQuery("");
            setActive(0);
            input.current?.focus();
          }}
        >
          <X size={12} />
        </button>
      )}
      {open && (
        <div className="province-results">
          <div className="search-caption">
            AREA OF INTEREST <span>OBSERVATIONS</span>
          </div>
          <ul id={listId} role="listbox" aria-label="Matching provinces">
            {matches.map((name, index) => (
              <li
                id={`${listId}-${index}`}
                key={name}
                role="option"
                aria-selected={active === index}
                onPointerMove={() => setActive(index)}
                onPointerDown={(event) => event.preventDefault()}
                onClick={() => select(name)}
              >
                <MapPin size={13} />
                <span>{name}</span>
                <small>
                  {name === "Indonesia"
                    ? number(ranking.reduce((sum, [, n]) => sum + n, 0))
                    : number(counts.get(name) ?? 0)}
                </small>
                <ArrowUpRight size={12} />
              </li>
            ))}
          </ul>
          {!matches.length && (
            <p className="search-empty">No province matches “{query}”.</p>
          )}
          <div className="search-hint">
            ↑ ↓ to navigate <span>↵ to select</span>
          </div>
        </div>
      )}
    </div>
  );
}
