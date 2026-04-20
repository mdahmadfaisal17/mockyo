import { useState, useRef, useEffect } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface SubItem {
  name: string;
  value: string;
}

interface CategoryItem {
  name: string;
  value: string;
}

interface Category {
  name: string;
  value: string;
  subcategories: CategoryItem[];
}

interface CategoryDropdownProps {
  value: string;
  onChange: (value: string) => void;
  categories: Category[];
}

export default function CategoryDropdown({ value, onChange, categories }: CategoryDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [hoveredMain, setHoveredMain] = useState<Category | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const resetHoverState = () => {
    setHoveredMain(null);
  };

  const handleMainAction = (main: Category) => {
    if (main.subcategories.length > 0 && hoveredMain?.value !== main.value) {
      setHoveredMain(main);
      return;
    }
    handleSelect(main.value);
  };

  const handleCategoryAction = (cat: CategoryItem) => {
    handleSelect(cat.value);
  };

  useEffect(() => {
    const handleClickOutside = (event: PointerEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        resetHoverState();
      }
    };

    document.addEventListener("pointerdown", handleClickOutside);
    return () => document.removeEventListener("pointerdown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    if (value === "all" || value.startsWith("main:")) {
      resetHoverState();
      return;
    }

    if (value.startsWith("category:")) {
      const [, rest] = value.split(":");
      const [main] = rest.split("::");
      const selectedMain = categories.find((item) => item.name === main);
      setHoveredMain(selectedMain ?? null);
      return;
    }

    resetHoverState();
  }, [isOpen, value, categories]);

  const getSelectedLabel = () => {
    if (value === "all") return "All Categories";
    if (value.startsWith("main:")) return value.slice(5);
    if (value.startsWith("category:")) {
      const [, rest] = value.split(":");
      const [main, cat] = rest.split("::");
      return `${main} / ${cat}`;
    }
    return "All Categories";
  };

  const handleSelect = (selectedValue: string) => {
    onChange(selectedValue);
    setIsOpen(false);
    resetHoverState();
  };

  return (
    <div ref={dropdownRef} className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-5 py-3.5 rounded-md bg-muted/50 border border-border/50 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all flex items-center justify-between min-w-[160px]"
      >
        <span>{getSelectedLabel()}</span>
        <ChevronDown
          className={`w-4 h-4 text-muted-foreground transition-transform ml-2 ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="absolute top-full mt-2 left-0 bg-card border border-border rounded-lg shadow-2xl overflow-hidden z-50 flex max-w-[calc(100vw-2rem)] overflow-x-auto"
          >
            {/* Panel 1: Main categories */}
            <div className="w-48 py-2 border-r border-border">
              <button
                onClick={() => handleSelect("all")}
                className={`w-full px-4 py-2.5 text-left hover:bg-muted/50 transition-colors ${
                  value === "all" ? "bg-muted/50 text-primary font-medium" : ""
                }`}
              >
                All Categories
              </button>
              {categories.map((main) => (
                <button
                  key={main.value}
                  type="button"
                  onMouseEnter={() => {
                    setHoveredMain(main);
                  }}
                  onClick={() => handleMainAction(main)}
                  className={`w-full px-4 py-2.5 text-left flex items-center justify-between hover:bg-muted/50 transition-colors ${
                    hoveredMain?.value === main.value ? "bg-muted/50" : ""
                  } ${value === main.value ? "text-primary font-medium" : ""}`}
                >
                  <span>{main.name}</span>
                  {main.subcategories.length > 0 && (
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  )}
                </button>
              ))}
            </div>

            {/* Panel 2: Category level */}
            <AnimatePresence mode="wait">
              {hoveredMain && hoveredMain.subcategories.length > 0 && (
                <motion.div
                  key={hoveredMain.value}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  transition={{ duration: 0.15 }}
                  className="w-48 py-2 border-r border-border"
                >
                  {hoveredMain.subcategories.map((cat) => (
                    <button
                      key={cat.value}
                      type="button"
                      onClick={() => handleCategoryAction(cat)}
                      className={`w-full px-4 py-2.5 text-left flex items-center justify-between hover:bg-muted/50 transition-colors ${
                        value === cat.value ? "text-primary font-medium bg-muted/50" : ""
                      }`}
                    >
                      <span>{cat.name}</span>
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
